const vscode = require('vscode');
const { PairProgrammingSession } = require('../models/pairSession');
const { getWebviewContent } = require('./WebviewContent');
const { validateEmail } = require('../utils/validators');
const { sendChatRequest } = require('../services/apiService');
const { formatMessage } = require('./messageFormater');
const { analyzeCode, detectCodeIssues } = require('../services/codeAnalysisService');
const { 
    trackEvent, 
    trackSessionStart, 
    trackSessionEnd, 
    trackChatInteraction,
    trackPairProgrammingEvent,
    trackTaskEvent
} = require('../services/analyticsService');

class SidebarProvider {
    /**
     * @param {vscode.Uri} _extensionUri
     * @param {vscode.Memento} _globalState
     * @param {vscode.ExtensionContext} _context
     */
    constructor(_extensionUri, _globalState, _context) {
        this._extensionUri = _extensionUri;
        this._globalState = _globalState;
        this._context = _context;
        
        // Dominios de correo permitidos
        this.ALLOWED_DOMAINS = ['@konradlorenz.edu.co', '@unab.edu.co'];
        
        // Inicializar la sesión de Pair Programming
        this.pairSession = new PairProgrammingSession();

        // Configurar callbacks para el temporizador
        this.pairSession.setTimerCallbacks({
            onTimerEnded: this._handleTimerEnded.bind(this),
            onTimerWarning: this._handleTimerWarning.bind(this)
        });
        
        // Registrar evento de inicialización del proveedor
        trackEvent('SIDEBAR_PROVIDER_INIT', {
            timestamp: new Date().toISOString()
        }, this._context);
    }

    /**
     * @param {vscode.WebviewView} webviewView
     */
    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        const nonce = this._getNonce();
        
        // Verificar si el usuario ya está autenticado
        const authenticatedEmail = this._globalState.get('authenticatedEmail');
        
        // Si hay un usuario autenticado, registrar el evento de vista
        if (authenticatedEmail) {
            trackEvent('SIDEBAR_VIEW', {
                email: authenticatedEmail,
                view_time: new Date().toISOString()
            }, this._context);
        }
        
        // Obtener la ruta del recurso de la imagen
        const leiaImagePath = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'leia.jpg')
        );
        
        // Pasar el estado de autenticación al HTML
        webviewView.webview.html = getWebviewContent(
            webviewView.webview, 
            nonce, 
            !!authenticatedEmail, 
            authenticatedEmail,
            leiaImagePath
        );

        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case 'VERIFY_EMAIL':
                        await this._verificarEmail(webviewView, message.email);
                        break;
                    case 'LOGOUT':
                        await this._logout(webviewView);
                        break;
                    case 'SEND_MESSAGE':
                        await this._procesarMensaje(webviewView, message);
                        break;
                    case 'PP_COMANDO':
                        // Procesar comandos de Pair Programming
                        await this._procesarComandoPP(webviewView, message.comando, message.params || {});
                        break;
                }
            } catch (error) {
                console.error('Error procesando mensaje:', error);
                this._mostrarError(webviewView, error instanceof Error ? error.message : 'Error desconocido');
            }
        });
    }

    /**
     * @private
     * @param {vscode.WebviewView} webviewView
     * @param {string} email
     */
    async _verificarEmail(webviewView, email) {
        try {
            // Verificar formato de correo
            if (!validateEmail(email)) {
                // Registrar intento fallido
                trackEvent('USER_LOGIN_ATTEMPT', {
                    email: email,
                    status: 'failed',
                    reason: 'invalid_format'
                }, this._context);
                
                throw new Error('Formato de correo electrónico inválido');
            }

            // Verificar dominio permitido
            if (!this._validarDominioEmail(email)) {
                // Registrar intento fallido
                trackEvent('USER_LOGIN_ATTEMPT', {
                    email: email,
                    status: 'failed',
                    reason: 'unauthorized_domain',
                    domain: email.split('@')[1]
                }, this._context);
                
                throw new Error('Dominio de correo no autorizado. Solo se permiten correos de las universidades aliadas.');
            }

            // Guardar el email autenticado
            await this._globalState.update('authenticatedEmail', email);

            // Iniciar sesión de analytics
            trackSessionStart(email, this._context);
            
            // Registrar login exitoso
            trackEvent('USER_LOGIN', {
                email: email,
                domain: email.split('@')[1],
                login_time: new Date().toISOString()
            }, this._context);

            // Notificar al webview que la autenticación fue exitosa
            webviewView.webview.postMessage({
                type: 'AUTH_SUCCESS',
                email: email
            });

        } catch (error) {
            throw new Error(`Error al verificar email: ${error.message}`);
        }
    }

    /**
     * @private
     * @param {vscode.WebviewView} webviewView
     */
    async _logout(webviewView) {
        // Obtener email antes de eliminarlo
        const email = this._globalState.get('authenticatedEmail');
        
        // Registrar evento de logout
        if (email) {
            trackEvent('USER_LOGOUT', {
                email: email,
                logout_time: new Date().toISOString()
            }, this._context);
            
            // Finalizar sesión de usuario
            trackSessionEnd(this._context);
        }
        
        // Eliminar el email autenticado
        await this._globalState.update('authenticatedEmail', undefined);
        
        // Notificar al webview que se cerró la sesión
        webviewView.webview.postMessage({
            type: 'LOGOUT_SUCCESS'
        });
    }

    /**
     * @private
     * @param {Object} notification - Notificación del temporizador
     */
    _handleTimerEnded(notification) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'TIMER_ENDED',
                message: notification.message
            });
        }
    }

    /**
     * @private
     * @param {Object} warning - Advertencia del temporizador
     */
    _handleTimerWarning(warning) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'TIMER_WARNING',
                message: warning.message,
                timeRemaining: warning.timeRemaining
            });
        }
    }

    /**
     * @private
     * @param {string} email
     * @returns {boolean}
     */
    _validarDominioEmail(email) {
        return this.ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
    }
    
    /**
     * Método para procesar comandos de Pair Programming
     * @param {vscode.WebviewView} webviewView - Vista de webview
     * @param {string} comando - Comando a ejecutar
     * @param {Object} params - Parámetros del comando
     */
    async _procesarComandoPP(webviewView, comando, params) {
        const authenticatedEmail = this._globalState.get('authenticatedEmail');
        if (!authenticatedEmail) {
            throw new Error('No estás autenticado. Por favor, inicia sesión primero.');
        }
        
        let resultado;
        switch (comando) {
            case 'INICIAR_SESION':
                if (!params.navigatorEmail) {
                    throw new Error('Se requiere el correo del navegante para iniciar la sesión.');
                }
                
                // Registrar inicio de sesión de pair programming
                trackPairProgrammingEvent('SESSION_START', {
                    driver_email: authenticatedEmail,
                    navigator_email: params.navigatorEmail,
                    start_time: new Date().toISOString()
                }, this._context);
                
                resultado = this.pairSession.startSession(authenticatedEmail, params.navigatorEmail);
                break;
                
            case 'CAMBIAR_ROLES':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para cambiar roles.');
                }
                
                // Registrar cambio de roles
                trackPairProgrammingEvent('ROLE_SWITCH', {
                    previous_driver: this.pairSession.driver,
                    previous_navigator: this.pairSession.navigator,
                    switch_time: new Date().toISOString()
                }, this._context);
                
                resultado = this.pairSession.switchRoles();
                break;
                
            case 'FINALIZAR_SESION':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para finalizar.');
                }
                
                // Datos para el analytics antes de finalizar la sesión
                const sessionDataForAnalytics = {
                    driver_email: this.pairSession.driver,
                    navigator_email: this.pairSession.navigator,
                    duration_ms: this.pairSession.turnStartTime ? (Date.now() - this.pairSession.turnStartTime) : 0,
                    completed_tasks: this.pairSession.completedTasks.length,
                    pending_tasks: this.pairSession.sessionTasks.length,
                    end_time: new Date().toISOString()
                };
                
                resultado = this.pairSession.endSession();
                
                // Registrar finalización de sesión de pair programming
                trackPairProgrammingEvent('SESSION_END', sessionDataForAnalytics, this._context);
                break;
                
            case 'AGREGAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para agregar tareas.');
                }
                if (!params.descripcion) {
                    throw new Error('Se requiere una descripción para la tarea.');
                }
                
                // Registrar creación de tarea
                trackTaskEvent('CREATE', {
                    description: params.descripcion,
                    created_by: authenticatedEmail,
                    session_id: this._context.globalState.get('current-session-id'),
                    pair_session_active: true
                }, this._context);
                
                resultado = this.pairSession.addTask(params.descripcion);
                break;
                
            case 'COMPLETAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para completar tareas.');
                }
                if (!params.taskId) {
                    throw new Error('Se requiere el ID de la tarea a completar.');
                }
                
                // Encontrar la tarea para registrar sus datos en analytics
                const taskToComplete = this.pairSession.sessionTasks.find(task => task.id === params.taskId);
                
                resultado = this.pairSession.completeTask(params.taskId);
                
                // Registrar finalización de tarea
                if (taskToComplete) {
                    trackTaskEvent('COMPLETE', {
                        task_id: params.taskId,
                        description: taskToComplete.description,
                        completed_by: authenticatedEmail,
                        time_to_complete: new Date().getTime() - new Date(taskToComplete.createdAt).getTime(),
                        pair_session_active: true
                    }, this._context);
                }
                break;
                
            case 'OBTENER_ESTADO':
                resultado = this.pairSession.getSessionStatus();
                
                // Registrar consulta de estado si hay una sesión activa
                if (this.pairSession.sessionActive) {
                    trackEvent('PAIR_SESSION_STATUS_CHECK', {
                        driver: this.pairSession.driver,
                        navigator: this.pairSession.navigator,
                        session_duration_so_far: Date.now() - this.pairSession.turnStartTime
                    }, this._context);
                }
                break;
                
            default:
                throw new Error(`Comando desconocido: ${comando}`);
        }
        
        // Notificar al webview del resultado
        webviewView.webview.postMessage({
            type: 'PP_RESULTADO',
            comando,
            resultado
        });
        
        return resultado;
    }

    /**
     * @private
     * @param {vscode.WebviewView} webviewView
     * @param {{ texto: string, incluirCodigo: boolean }} message
     */
async _procesarMensaje(webviewView, message) {
    try {
        // Verificar si el usuario está autenticado
        const authenticatedEmail = this._globalState.get('authenticatedEmail');
        if (!authenticatedEmail) {
            throw new Error('No estás autenticado. Por favor, inicia sesión primero.');
        }

        let codigo = '';
        let lenguaje = '';
        
        if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
            codigo = vscode.window.activeTextEditor.document.getText();
            lenguaje = vscode.window.activeTextEditor.document.languageId || 'unknown';
            
            // Analizar código para métricas y problemas potenciales
            const codeMetrics = analyzeCode(codigo, lenguaje, this._context);
            const codeIssues = detectCodeIssues(codigo, lenguaje, this._context);
            
            // Registrar resultados del análisis
            trackEvent('CODE_ANALYSIS_RESULT', {
                language: lenguaje,
                metrics: codeMetrics,
                issues_count: codeIssues.length,
                issues_summary: codeIssues.map(issue => issue.type),
                timestamp: new Date().toISOString()
            }, this._context);
        }
        
        // Registrar evento de consulta del usuario con el mensaje completo
        trackChatInteraction('user_query', message.texto, !!codigo, this._context);

        const startTime = Date.now();
        
        const response = await sendChatRequest({
            message: message.texto,
            code: codigo || undefined,
            metadata: {
                userEmail: authenticatedEmail,
                pairProgramming: this.pairSession.sessionActive ? {
                    isActive: true,
                    driver: this.pairSession.driver,
                    navigator: this.pairSession.navigator
                } : {
                    isActive: false
                }
            }
        });

        const responseTime = Date.now() - startTime;

        if (response && typeof response === 'object' && response !== null && 'response' in response) {
            // Registrar evento de respuesta con el contenido completo
            trackChatInteraction('bot_response', response.response, false, this._context);
            
            // Registrar tiempo de respuesta
            trackEvent('API_RESPONSE_TIME', {
                endpoint: 'chat',
                response_time_ms: responseTime,
                status: 'success'
            }, this._context);
            
            // Formatear el mensaje para resaltar código, etc.
            const formattedMessage = formatMessage(response.response);
            this._enviarRespuesta(webviewView, formattedMessage);
        } else {
            throw new Error('Respuesta inválida del servidor');
        }

    } catch (error) {
        console.error('Error completo:', error);
        
        // Registrar error
        trackEvent('API_ERROR', {
            endpoint: 'chat',
            error_message: error.message,
            timestamp: new Date().toISOString()
        }, this._context);
        
        throw new Error(`Error al procesar mensaje: ${error.message}`);
    }
}
    /*async   _procesarMensaje(webviewView, message) {
        try {
            // Verificar si el usuario está autenticado
            const authenticatedEmail = this._globalState.get('authenticatedEmail');
            if (!authenticatedEmail) {
                throw new Error('No estás autenticado. Por favor, inicia sesión primero.');
            }

            let codigo = '';
            let lenguaje = '';
            
            if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
                codigo = vscode.window.activeTextEditor.document.getText();
                lenguaje = vscode.window.activeTextEditor.document.languageId || 'unknown';
                
                // Analizar código para métricas y problemas potenciales
                const codeMetrics = analyzeCode(codigo, lenguaje, this._context);
                const codeIssues = detectCodeIssues(codigo, lenguaje, this._context);
                
                // Registrar resultados del análisis
                trackEvent('CODE_ANALYSIS_RESULT', {
                    language: lenguaje,
                    metrics: codeMetrics,
                    issues_count: codeIssues.length,
                    issues_summary: codeIssues.map(issue => issue.type),
                    timestamp: new Date().toISOString()
                }, this._context);
            }
            
            // Registrar evento de consulta del usuario
            trackChatInteraction('user_query', message.texto, !!codigo, this._context);

            const startTime = Date.now();
            
            const response = await sendChatRequest({
                message: message.texto,
                code: codigo || undefined,
                metadata: {
                    userEmail: authenticatedEmail,
                    pairProgramming: this.pairSession.sessionActive ? {
                        isActive: true,
                        driver: this.pairSession.driver,
                        navigator: this.pairSession.navigator
                    } : {
                        isActive: false
                    }
                }
            });

            const responseTime = Date.now() - startTime;

            if (response && typeof response === 'object' && response !== null && 'response' in response) {
                // Registrar evento de respuesta
                trackChatInteraction('bot_response', response.response, false, this._context);
                
                // Registrar tiempo de respuesta
                trackEvent('API_RESPONSE_TIME', {
                    endpoint: 'chat',
                    response_time_ms: responseTime,
                    status: 'success'
                }, this._context);
                
                // Formatear el mensaje para resaltar código, etc.
                const formattedMessage = formatMessage(response.response);
                this._enviarRespuesta(webviewView, formattedMessage);
            } else {
                throw new Error('Respuesta inválida del servidor');
            }

        } catch (error) {
            console.error('Error completo:', error);
            
            // Registrar error
            trackEvent('API_ERROR', {
                endpoint: 'chat',
                error_message: error.message,
                timestamp: new Date().toISOString()
            }, this._context);
            
            throw new Error(`Error al procesar mensaje: ${error.message}`);
        }
    }*/

    /**
     * @private
     * @param {vscode.WebviewView} webviewView
     * @param {string} mensaje
     */
    _enviarRespuesta(webviewView, mensaje) {
        webviewView.webview.postMessage({
            type: 'BOT_RESPONSE',
            mensaje
        });
    }

    /**
     * @private
     * @param {vscode.WebviewView} webviewView
     * @param {string} error
     */
    _mostrarError(webviewView, error) {
        webviewView.webview.postMessage({
            type: 'ERROR',
            mensaje: error
        });
    }

    /**
     * @private
     * @returns {string}
     */
    _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

module.exports = { SidebarProvider };