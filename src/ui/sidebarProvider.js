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
        constructor(_extensionUri, _globalState, _context) {
            this._extensionUri = _extensionUri;
            this._globalState = _globalState;
            this._context = _context;
            
            // Dominios permitidos
            this.ALLOWED_DOMAINS = ['@konradlorenz.edu.co', '@unab.edu.co'];
            
            this.pairSession = new PairProgrammingSession();

            this.pairSession.setTimerCallbacks({
                onTimerEnded: this._handleTimerEnded.bind(this),
                onTimerWarning: this._handleTimerWarning.bind(this)
            });
            
            trackEvent('SIDEBAR_PROVIDER_INIT', { timestamp: new Date().toISOString() }, this._context);
        }

        resolveWebviewView(webviewView) {
            this._view = webviewView;

            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri]
            };

            const nonce = this._getNonce();
            const authenticatedEmail = this._globalState.get('authenticatedEmail');
            
            if (authenticatedEmail) {
                trackEvent('SIDEBAR_VIEW', {
                    email: authenticatedEmail,
                    view_time: new Date().toISOString()
                }, this._context);
            }
            
            const leiaImagePath = webviewView.webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'resources', 'leia.jpg')
            );
            
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
                        case 'VERIFY_EMAIL': // validar piloto
                            await this._verificarEmail(webviewView, message.email);
                            break;
                        case 'LOGOUT':
                            await this._logout(webviewView);
                            break;
                        case 'SEND_MESSAGE':
                            await this._procesarMensaje(webviewView, message);
                            break;
                        case 'PP_COMANDO': // pair programming
                            await this._procesarComandoPP(webviewView, message.comando, message.params || {});
                            break;
                    }
                } catch (error) {
                    console.error('Error procesando mensaje:', error);
                    this._mostrarError(webviewView, error instanceof Error ? error.message : 'Error desconocido');
                }
            });
        }

        async _verificarEmail(webviewView, email) {
            try {
                if (!validateEmail(email)) {
                    throw new Error('Formato de correo electrónico inválido');
                }

                if (!this._validarDominioEmail(email)) {
                    throw new Error('Dominio no autorizado. Solo se permiten correos de universidades aliadas.');
                }

                // Guardar el piloto
                await this._globalState.update('authenticatedEmail', email);

                trackSessionStart(email, this._context);
                trackEvent('USER_LOGIN', {
                    email,
                    domain: email.split('@')[1],
                    login_time: new Date().toISOString(),
                    role: 'driver'
                }, this._context);

                // Notificar éxito al webview
                webviewView.webview.postMessage({
                    type: 'AUTH_SUCCESS',
                    email,
                    role: 'driver'
                });
            } catch (error) {
                throw new Error(`Error al verificar email: ${error.message}`);
            }
        }

        async _logout(webviewView) {
            const email = this._globalState.get('authenticatedEmail');
            
            if (email) {
                trackEvent('USER_LOGOUT', {
                    email,
                    logout_time: new Date().toISOString()
                }, this._context);
                trackSessionEnd(this._context);
            }
            
            await this._globalState.update('authenticatedEmail', undefined);
            
            webviewView.webview.postMessage({ type: 'LOGOUT_SUCCESS' });
        }

        _handleTimerEnded(notification) {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'TIMER_ENDED',
                    message: notification.message
                });
            }
        }

        _handleTimerWarning(warning) {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'TIMER_WARNING',
                    message: warning.message,
                    timeRemaining: warning.timeRemaining
                });
            }
        }

        _validarDominioEmail(email) {
            return this.ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
        }
        
        async _procesarComandoPP(webviewView, comando, params) {
            const authenticatedEmail = this._globalState.get('authenticatedEmail');
            if (!authenticatedEmail) {
                throw new Error('No estás autenticado. Ingresa el correo del piloto primero.');
            }
            
            let resultado;
            switch (comando) {
                case 'INICIAR_SESION':
                    if (!params.navigatorEmail) {
                        throw new Error('Falta el correo del navegante.');
                    }

                    if (!this._validarDominioEmail(params.navigatorEmail)) {
                        throw new Error('El correo del navegante tiene un dominio no permitido.');
                    }
                    
                    trackPairProgrammingEvent('SESSION_START', {
                        driver_email: authenticatedEmail,
                        navigator_email: params.navigatorEmail,
                        start_time: new Date().toISOString()
                    }, this._context);
                    
                    resultado = this.pairSession.startSession(authenticatedEmail, params.navigatorEmail);

                    // 🔹 Responder con PP_RESULTADO para que el webview muestre la app
                    webviewView.webview.postMessage({
                        type: 'PP_RESULTADO',
                        comando: 'INICIAR_SESION',
                        resultado
                    });
                    break;
                    
                case 'CAMBIAR_ROLES':
                    if (!this.pairSession.sessionActive) {
                        throw new Error('No hay una sesión activa para cambiar roles.');
                    }
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
                    const sessionDataForAnalytics = {
                        driver_email: this.pairSession.driver,
                        navigator_email: this.pairSession.navigator,
                        duration_ms: this.pairSession.turnStartTime ? (Date.now() - this.pairSession.turnStartTime) : 0,
                        completed_tasks: this.pairSession.completedTasks.length,
                        pending_tasks: this.pairSession.sessionTasks.length,
                        end_time: new Date().toISOString()
                    };
                    resultado = this.pairSession.endSession();
                    trackPairProgrammingEvent('SESSION_END', sessionDataForAnalytics, this._context);
                    break;

                case 'AGREGAR_TAREA':
                    if (!this.pairSession.sessionActive) {
                        throw new Error('No hay una sesión activa para agregar tareas.');
                    }
                    if (!params.descripcion) {
                        throw new Error('Se requiere una descripción para la tarea.');
                    }
                    trackTaskEvent('CREATE', {
                        description: params.descripcion,
                        created_by: authenticatedEmail,
                        pair_session_active: true
                    }, this._context);
                    resultado = this.pairSession.addTask(params.descripcion);
                    break;

                case 'COMPLETAR_TAREA':
                    if (!this.pairSession.sessionActive) {
                        throw new Error('No hay una sesión activa para completar tareas.');
                    }
                    if (!params.taskId) {
                        throw new Error('Se requiere el ID de la tarea.');
                    }
                    const taskToComplete = this.pairSession.sessionTasks.find(t => t.id === params.taskId);
                    resultado = this.pairSession.completeTask(params.taskId);
                    if (taskToComplete) {
                        trackTaskEvent('COMPLETE', {
                            task_id: params.taskId,
                            description: taskToComplete.description,
                            completed_by: authenticatedEmail,
                            time_to_complete: Date.now() - new Date(taskToComplete.createdAt).getTime(),
                            pair_session_active: true
                        }, this._context);
                    }
                    break;

                 case 'EDITAR_TAREA':
    if (!this.pairSession.sessionActive) {
        throw new Error('No hay una sesión activa para editar tareas.');
    }
    if (!params.taskId || !params.descripcion) {
        throw new Error('Se requiere el ID y la nueva descripción.');
    }
    this.pairSession.editTask(params.taskId, params.descripcion);

    resultado = {
        pendingTasks: this.pairSession.sessionTasks.filter(t => !t.completed),
        completedTasks: this.pairSession.sessionTasks.filter(t => t.completed)
    };
    break;

case 'ELIMINAR_TAREA':
    if (!this.pairSession.sessionActive) {
        throw new Error('No hay una sesión activa para eliminar tareas.');
    }
    if (!params.taskId) {
        throw new Error('Se requiere el ID de la tarea.');
    }
    this.pairSession.deleteTask(params.taskId);

    resultado = {
        pendingTasks: this.pairSession.sessionTasks.filter(t => !t.completed),
        completedTasks: this.pairSession.sessionTasks.filter(t => t.completed)
    };
    break;
                    
                case 'OBTENER_ESTADO':
                    resultado = this.pairSession.getSessionStatus();
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
            
            webviewView.webview.postMessage({
                type: 'PP_RESULTADO',
                comando,
                resultado
            });
            
            return resultado;
        }

        async _procesarMensaje(webviewView, message) {
            try {
                const authenticatedEmail = this._globalState.get('authenticatedEmail');
                if (!authenticatedEmail) {
                    throw new Error('No estás autenticado. Por favor, inicia sesión primero.');
                }

                let codigo = '';
                let lenguaje = '';
                
                if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
                    codigo = vscode.window.activeTextEditor.document.getText();
                    lenguaje = vscode.window.activeTextEditor.document.languageId || 'unknown';
                    
                    const codeMetrics = analyzeCode(codigo, lenguaje, this._context);
                    const codeIssues = detectCodeIssues(codigo, lenguaje, this._context);
                    
                    trackEvent('CODE_ANALYSIS_RESULT', {
                        language: lenguaje,
                        metrics: codeMetrics,
                        issues_count: codeIssues.length,
                        issues_summary: codeIssues.map(issue => issue.type),
                        timestamp: new Date().toISOString()
                    }, this._context);
                }
                
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
                        } : { isActive: false }
                    }
                });

                const responseTime = Date.now() - startTime;

                if (response && typeof response === 'object' && response !== null && 'response' in response) {
                    trackChatInteraction('bot_response', response.response, false, this._context);
                    trackEvent('API_RESPONSE_TIME', {
                        endpoint: 'chat',
                        response_time_ms: responseTime,
                        status: 'success'
                    }, this._context);
                    const formattedMessage = formatMessage(response.response);
                    this._enviarRespuesta(webviewView, formattedMessage);
                } else {
                    throw new Error('Respuesta inválida del servidor');
                }
            } catch (error) {
                console.error('Error completo:', error);
                trackEvent('API_ERROR', {
                    endpoint: 'chat',
                    error_message: error.message,
                    timestamp: new Date().toISOString()
                }, this._context);
                throw new Error(`Error al procesar mensaje: ${error.message}`);
            }
        }

        _enviarRespuesta(webviewView, mensaje) {
            webviewView.webview.postMessage({ type: 'BOT_RESPONSE', mensaje });
        }

        _mostrarError(webviewView, error) {
            webviewView.webview.postMessage({ type: 'ERROR', mensaje: error });
        }

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
