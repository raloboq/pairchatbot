const vscode = require('vscode');
const PairProgrammingSession = require('../models/pairSession');
//const { PairProgrammingSession } = require('../models/pairSession');
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

const { v4: uuidv4 } = require('uuid');
const { getCurrentRole } = require('../services/analyticsService');


class SidebarProvider {
    constructor(_extensionUri, _globalState, _context) {
        this._extensionUri = _extensionUri;
        this._globalState = _globalState;
        this._context = _context;

        // Dominios permitidos
        this.ALLOWED_DOMAINS = ['@konradlorenz.edu.co', '@unab.edu.co'];

        this.pairSession = new PairProgrammingSession();

        // ✅ Inicializar historial de chat
        this.chatHistory = [];

        // ✅ CORRECCIÓN: Usar setTimerCallbacks en lugar de asignación directa
        this.pairSession.setTimerCallbacks({
            onTimerEnded: this._handleTimerEnded.bind(this),
            onTimerWarning: this._handleTimerWarning.bind(this)
        });

        trackEvent('SIDEBAR_PROVIDER_INIT', { timestamp: new Date().toISOString() }, this._context);
    }

    resolveWebviewView(webviewView) {
        console.log('resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.options = {
            retainContextWhenHidden: true,
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

        // ⭐ MODIFICADO: Restaurar estado completo incluyendo activeUser
        const savedState = this._context.globalState.get("pairSessionState");
        if (savedState && savedState.sessionActive) {
            // Restaurar el estado de la sesión en el objeto pairSession
            this.pairSession.sessionActive = savedState.sessionActive;
            this.pairSession.driver = savedState.driver;
            this.pairSession.navigator = savedState.navigator;
            this.pairSession.activeUser = savedState.activeUser;
            this.pairSession.sessionTasks = savedState.pendingTasks || [];
            this.pairSession.completedTasks = savedState.completedTasks || [];

            // Reenviar al frontend
            webviewView.webview.postMessage({
                type: "PP_RESULTADO",
                comando: "OBTENER_ESTADO",
                resultado: savedState
            });
        }

        // Restaurar historial de chat
        const savedChat = this._context.globalState.get("chatHistory") || [];
        this.chatHistory = savedChat;
        if (savedChat.length > 0) {
            webviewView.webview.postMessage({
                type: "RESTORE_CHAT",
                mensajes: savedChat
            });
        }

        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case 'webviewLoaded':
                        const email = this._globalState.get('authenticatedEmail');
                        if (email) {
                            // Si hay sesión, enviar todos los datos para restaurar la UI
                            const sessionState = this._context.globalState.get("pairSessionState");
                            const chatHistory = this._context.globalState.get("chatHistory") || [];

                            webviewView.webview.postMessage({
                                type: 'restoreSession',
                                sessionState: sessionState,
                                chatHistory: chatHistory
                            });
                        }
                        break;
                    case 'VERIFY_EMAIL':
                        await this._verificarEmail(webviewView, message.email);
                        break;
                    case 'logoutRequest':
                        await this._clearSession(webviewView);
                        break;
                    case 'SEND_MESSAGE':
                        this.chatHistory.push({ from: "user", text: message.texto, timestamp: Date.now() });
                        await this._context.globalState.update("chatHistory", this.chatHistory);
                        await this._procesarMensaje(webviewView, message);
                        break;
                    case 'PP_COMANDO':
                        try {
                            await this._procesarComandoPP(webviewView, message.comando, message.params || {});
                        } catch (ppError) {
                            console.error('Error en comando PP:', ppError);
                            // Enviar error específico para PP
                            webviewView.webview.postMessage({
                                type: 'PP_ERROR',
                                comando: message.comando,
                                mensaje: ppError.message
                            });
                        }
                        break;
                }
            } catch (error) {
                console.error('Error procesando mensaje:', error);
                this._mostrarError(webviewView, error instanceof Error ? error.message : 'Error desconocido');
            }
        });

        webviewView.onDidDispose(() => {
            console.log('Webview disposed');
        });

        webviewView.onDidChangeVisibility(() => {
            console.log('Visibility changed:', webviewView.visible);
            if (webviewView.visible && this.pairSession.sessionActive) {
                // ✅ Enviar estado actualizado al frontend al volver a mostrarse
                webviewView.webview.postMessage({
                    type: "PP_RESULTADO",
                    comando: "OBTENER_ESTADO",
                    resultado: {
                        ...this.pairSession.getSessionStatus(),
                        pendingTasks: this.pairSession.sessionTasks,
                        completedTasks: this.pairSession.completedTasks
                    }
                });
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

    async _clearSession(webviewView) {
        const email = this._globalState.get('authenticatedEmail');

        if (email) {
            trackEvent('USER_LOGOUT', {
                email,
                logout_time: new Date().toISOString()
            }, this._context);
            trackSessionEnd(this._context);
        }

        if (this.pairSession && this.pairSession.sessionActive) {
            this.pairSession.endSession();
        }

        // Limpiar el estado persistente
        await this._globalState.update('authenticatedEmail', undefined);
        await this._context.globalState.update("pairSessionState", undefined);
        await this._context.globalState.update("chatHistory", undefined);

        // Resetear el estado en memoria
        this.pairSession = new PairProgrammingSession();
        this.pairSession.setTimerCallbacks({
            onTimerEnded: this._handleTimerEnded.bind(this),
            onTimerWarning: this._handleTimerWarning.bind(this)
        });
        this.chatHistory = [];

        // Notificar al webview para que se reinicie
        if (webviewView && webviewView.webview) {
            webviewView.webview.postMessage({ type: 'LOGOUT_SUCCESS' });
        }
    }

    _handleTimerEnded(notification) {
        if (this._view && this.pairSession.sessionActive) {
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

                if (params.navigatorEmail.toLowerCase() === authenticatedEmail.toLowerCase()) {
                    throw new Error('El correo del navegante debe ser diferente al correo del piloto.');
                }

                trackPairProgrammingEvent('SESSION_START', {
                    driver_email: authenticatedEmail,
                    navigator_email: params.navigatorEmail,
                    start_time: new Date().toISOString()
                }, this._context);

                resultado = this.pairSession.startSession(authenticatedEmail, params.navigatorEmail);

                // ⭐ MODIFICADO: Guardar activeUser en el estado
                await this._context.globalState.update("pairSessionState", {
                    sessionActive: true,
                    driver: resultado.driver,
                    navigator: resultado.navigator,
                    activeUser: resultado.activeUser,
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
                });

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

                // ⭐ NUEVO: Guardar estado anterior antes de cambiar
                const previousState = this.pairSession.getBothUsers();

                trackPairProgrammingEvent('ROLE_SWITCH', {
                    previous_driver: previousState.driver,
                    previous_navigator: previousState.navigator,
                    previous_active_user: previousState.activeUser,
                    switch_time: new Date().toISOString()
                }, this._context);

                resultado = this.pairSession.switchRoles();

                // ⭐ MODIFICADO: Actualizar activeUser en el estado
                await this._context.globalState.update("pairSessionState", {
                    sessionActive: true,
                    driver: resultado.driver,
                    navigator: resultado.navigator,
                    activeUser: resultado.activeUser,
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
                });

                webviewView.webview.postMessage({
                    type: "PP_RESULTADO",
                    comando: "CAMBIAR_ROLES",
                    resultado: {
                        ...resultado,
                        pendingTasks: this.pairSession.sessionTasks,
                        completedTasks: this.pairSession.completedTasks
                    }
                });
                break;

            case 'AGREGAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para agregar tareas.');
                }
                if (!params.descripcion) {
                    throw new Error('La descripción de la tarea es requerida.');
                }

                const newTask = {
                    id: uuidv4(),
                    description: params.descripcion,
                    createdAt: Date.now(),
                    createdBy: authenticatedEmail
                };

                this.pairSession.addTask(newTask);

                // Trackear evento
                trackTaskEvent('CREATE', {
                    task_id: newTask.id,
                    description: newTask.description,
                    created_by: authenticatedEmail,
                    pair_session_active: true
                }, this._context);

                resultado = {
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
                };
                break;

            case 'COMPLETAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa.');
                }
                if (!params.taskId) {
                    throw new Error('Se requiere el ID de la tarea.');
                }

                const taskToComplete = this.pairSession.sessionTasks.find(t => t.id === params.taskId);
                if (taskToComplete) {
                    trackTaskEvent('COMPLETE', {
                        task_id: params.taskId,
                        description: taskToComplete.description,
                        completed_by: authenticatedEmail,
                        time_to_complete: Date.now() - new Date(taskToComplete.createdAt).getTime(),
                        pair_session_active: true
                    }, this._context);
                }

                this.pairSession.completeTask(params.taskId);

                resultado = {
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
                };
                break;

            case 'EDITAR_TAREA':
                console.log('🔍 EDITAR_TAREA recibido:', params);
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para editar tareas.');
                }
                if (!params.taskId || !params.descripcion) {
                    throw new Error('Se requiere el ID y la nueva descripción.');
                }

                trackTaskEvent('EDIT', {
                    task_id: params.taskId,
                    new_description: params.descripcion,
                    edited_by: authenticatedEmail,
                    pair_session_active: true
                }, this._context);

                this.pairSession.editTask(params.taskId, params.descripcion);

                resultado = {
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
                };
                break;

            case 'ELIMINAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para eliminar tareas.');
                }
                if (!params.taskId) {
                    throw new Error('Se requiere el ID de la tarea.');
                }

                const taskToDelete = this.pairSession.sessionTasks.find(t => t.id === params.taskId);
                if (taskToDelete) {
                    trackTaskEvent('DELETE', {
                        task_id: params.taskId,
                        description: taskToDelete.description,
                        deleted_by: authenticatedEmail,
                        pair_session_active: true
                    }, this._context);
                }

                this.pairSession.deleteTask(params.taskId);

                resultado = {
                    pendingTasks: this.pairSession.sessionTasks,
                    completedTasks: this.pairSession.completedTasks
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

            case 'FINALIZAR_SESION':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para finalizar.');
                }

                trackPairProgrammingEvent('SESSION_END', {
                    driver_email: this.pairSession.driver,
                    navigator_email: this.pairSession.navigator,
                    end_time: new Date().toISOString(),
                    tasks_completed: this.pairSession.completedTasks.length,
                    tasks_pending: this.pairSession.sessionTasks.length
                }, this._context);

                resultado = this.pairSession.endSession();

                await this._context.globalState.update("pairSessionState", {
                    sessionActive: false,
                    driver: null,
                    navigator: null,
                    activeUser: null,
                    pendingTasks: [],
                    completedTasks: []
                });

                webviewView.webview.postMessage({
                    type: 'PP_RESULTADO',
                    comando: 'FINALIZAR_SESION',
                    resultado: { sessionActive: false }
                });
                break;

            default:
                throw new Error(`Comando desconocido: ${comando}`);
        }

        // ✅ Guardar estado actualizado después de cada acción
        await this._context.globalState.update("pairSessionState", this.pairSession.getSessionStatus());

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
            let codeLinesCount = 0;

            if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
                codigo = vscode.window.activeTextEditor.document.getText();
                lenguaje = vscode.window.activeTextEditor.document.languageId || 'unknown';
                codeLinesCount = vscode.window.activeTextEditor.document.lineCount;

                const codeMetrics = analyzeCode(codigo, lenguaje, this._context);
                const codeIssues = detectCodeIssues(codigo, lenguaje, this._context);

                trackEvent('CODE_ANALYSIS_RESULT', {
                    analysis_id: uuidv4(),
                    language: lenguaje,
                    metrics: codeMetrics,
                    issues_count: codeIssues.length,
                    issues_summary: codeIssues.map(issue => issue.type),
                    file_name: vscode.window.activeTextEditor.document.fileName.split('/').pop(),
                    pair_session_id: this._context.globalState.get('current-pair-session-id'),
                    current_role: getCurrentRole(this._context),
                    triggered_by_chat: true,
                    timestamp: new Date().toISOString()
                }, this._context);
            }

            // ⭐ MODIFICADO: Trackear mensaje del usuario con información completa
            const userMessageId = trackChatInteraction('user_query', message.texto, !!codigo, this._context, {
                codeLanguage: lenguaje || null,
                codeLinesCount: codeLinesCount || null,
                currentRole: getCurrentRole(this._context)
            });

            // Guardar mensaje del usuario en historial
            this.chatHistory.push({
                from: "user",
                text: message.texto,
                timestamp: Date.now(),
                message_id: userMessageId
            });
            await this._context.globalState.update("chatHistory", this.chatHistory);

            const startTime = Date.now();

            const response = await sendChatRequest({
                message: message.texto,
                code: codigo || undefined,
                metadata: {
                    userEmail: authenticatedEmail,
                    pairProgramming: this.pairSession.sessionActive ? {
                        isActive: true,
                        driver: this.pairSession.driver,
                        navigator: this.pairSession.navigator,
                        pairSessionId: this._context.globalState.get('current-pair-session-id')
                    } : { isActive: false }
                }
            });

            const responseTime = Date.now() - startTime;

            if (response && typeof response === 'object' && response !== null && 'response' in response) {
                // ⭐ MODIFICADO: Trackear respuesta del bot con tiempo y parent
                const botMessageId = trackChatInteraction('bot_response', response.response, false, this._context, {
                    responseTimeMs: responseTime,
                    parentMessageId: userMessageId,
                    currentRole: getCurrentRole(this._context)
                });

                trackEvent('API_RESPONSE_TIME', {
                    endpoint: 'chat',
                    response_time_ms: responseTime,
                    status: 'success',
                    pair_session_id: this._context.globalState.get('current-pair-session-id')
                }, this._context);

                const formattedMessage = formatMessage(response.response);

                // Guardar respuesta del bot con su ID
                this.chatHistory.push({
                    from: "bot",
                    text: formattedMessage,
                    timestamp: Date.now(),
                    message_id: botMessageId
                });
                await this._context.globalState.update("chatHistory", this.chatHistory);

                this._enviarRespuesta(webviewView, formattedMessage);
            } else {
                throw new Error('Respuesta inválida del servidor');
            }
        } catch (error) {
            console.error('Error completo:', error);
            trackEvent('API_ERROR', {
                endpoint: 'chat',
                error_message: error.message,
                pair_session_id: this._context.globalState.get('current-pair-session-id'),
                timestamp: new Date().toISOString()
            }, this._context);
            throw new Error(`Error al procesar mensaje: ${error.message}`);
        }
    }

    _enviarRespuesta(webviewView, mensaje) {
        // ✅ guardar respuesta del bot en historial
        this.chatHistory.push({ from: "bot", text: mensaje, timestamp: Date.now() });
        this._context.globalState.update("chatHistory", this.chatHistory);
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