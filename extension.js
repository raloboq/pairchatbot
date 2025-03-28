const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Activando extensión Leia - Programming Assistant con Pair Programming');

    const provider = new SidebarProvider(context.extensionUri, context.globalState);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("pairchatbot.sidebarView", provider)
    );
    
    // Registrar comandos para pair programming
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.startPairSession', () => {
            vscode.window.showInformationMessage('Inicia una sesión de Pair Programming desde la barra lateral de Leia');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.generatePairReport', async () => {
            if (!provider.pairSession.sessionActive) {
                vscode.window.showErrorMessage('No hay una sesión de Pair Programming activa para generar un reporte');
                return;
            }
            
            const report = provider.pairSession.generateSessionSummary();
            
            // Crear un documento markdown con el resumen
            const document = await vscode.workspace.openTextDocument({
                content: generateMarkdownReport(report, provider.pairSession),
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document);
        })
    );
}

/**
 * Función para generar un reporte en formato markdown
 * @param {Object} report - Datos del reporte
 * @param {PairProgrammingSession} session - Sesión de pair programming
 * @returns {string} - Contenido markdown
 */
function generateMarkdownReport(report, session) {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    
    return `# Reporte de Sesión de Pair Programming

**Fecha:** ${dateStr}
**Hora:** ${timeStr}

## Participantes
- **Piloto (Driver):** ${session.driver}
- **Navegante (Navigator):** ${session.navigator}

## Resumen de la Sesión
- **Duración:** ${Math.floor(report.duration / 60000)} minutos
- **Tareas completadas:** ${report.completedTasks.length}
- **Tareas pendientes:** ${report.pendingTasks.length}

## Tareas Completadas
${report.completedTasks.length === 0 ? 
  '- No se completaron tareas en esta sesión' : 
  report.completedTasks.map(task => `- ${task.description} (completada: ${new Date(task.completedAt).toLocaleTimeString()})`).join('\n')
}

## Tareas Pendientes
${report.pendingTasks.length === 0 ? 
  '- No quedan tareas pendientes' : 
  report.pendingTasks.map(task => `- ${task.description}`).join('\n')
}

## Notas para la Próxima Sesión
- Continuar con las tareas pendientes
- Revisar el progreso y ajustar la estrategia si es necesario
- Asegurar que ambos participantes tengan oportunidad de ser piloto y navegante

---
*Generado por Leia - Programming Assistant*
`;
}

/**
 * Clase para gestionar la sesión de pair programming
 */
class PairProgrammingSession {
    constructor() {
        this.driver = null;
        this.navigator = null;
        this.sessionActive = false;
        this.turnStartTime = null;
        this.turnDuration = 0.5 * 60 * 1000; // 15 minutos en milisegundos
        this.timer = null;
        this.sessionTasks = [];
        this.completedTasks = [];
    }

    /**
 * Iniciar una sesión con dos participantes
 * @param {string} driverEmail - Email del piloto
 * @param {string} navigatorEmail - Email del navegante
 * @returns {Object} - Estado de la sesión
 */
startSession(driverEmail, navigatorEmail) {
    this.driver = driverEmail;
    this.navigator = navigatorEmail;
    this.sessionActive = true;
    this.turnStartTime = Date.now();
    this.startTimer();
    return {
        driver: this.driver,
        navigator: this.navigator,
        timeRemaining: this.turnDuration,
        sessionActive: this.sessionActive  // Aseguramos que se use sessionActive consistentemente
    };
}

/**
 * Cambiar roles entre driver y navigator
 * @returns {Object} - Estado actualizado de la sesión
 */
switchRoles() {
    // Intercambiar roles
    [this.driver, this.navigator] = [this.navigator, this.driver];
    this.turnStartTime = Date.now();
    this.restartTimer();
    return {
        driver: this.driver,
        navigator: this.navigator,
        timeRemaining: this.turnDuration,
        sessionActive: this.sessionActive  // Consistencia en nombre de propiedad
    };
}

/**
 * Finalizar la sesión
 * @returns {Object} - Resumen de la sesión
 */
endSession() {
    this.clearTimer();
    this.sessionActive = false;
    const summary = this.generateSessionSummary();
    
    // Añadimos sessionActive: false al resumen para mantener consistencia
    summary.sessionActive = false;
    
    this.driver = null;
    this.navigator = null;
    this.sessionTasks = [];
    this.completedTasks = [];
    return summary;
}

    /**
     * Iniciar temporizador para cambio de roles
     */
    startTimer() {
        this.clearTimer(); // Limpiar cualquier timer anterior
        this.timer = setInterval(() => {
            // Lógica para notificar cuando queden 5, 2 y 1 minuto
            const timeElapsed = Date.now() - this.turnStartTime;
            const timeRemaining = this.turnDuration - timeElapsed;
            
            if (timeRemaining <= 0) {
                this.clearTimer();
                return {
                    type: 'TIMER_ENDED',
                    message: 'Es hora de cambiar roles. El navegante ahora debería ser el piloto.'
                };
            } else if (timeRemaining <= 60000) { // 1 minuto
                return {
                    type: 'TIMER_WARNING',
                    message: 'Queda 1 minuto para cambiar roles.',
                    timeRemaining
                };
            } else if (timeRemaining <= 120000) { // 2 minutos
                return {
                    type: 'TIMER_WARNING',
                    message: 'Quedan 2 minutos para cambiar roles.',
                    timeRemaining
                };
            } else if (timeRemaining <= 300000) { // 5 minutos
                return {
                    type: 'TIMER_WARNING',
                    message: 'Quedan 5 minutos para cambiar roles.',
                    timeRemaining
                };
            }
        }, 30000); // Verificar cada 30 segundos
    }

    /**
     * Reiniciar el temporizador
     */
    restartTimer() {
        this.clearTimer();
        this.startTimer();
    }

    /**
     * Limpiar el temporizador
     */
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Obtener tiempo restante del turno actual
     * @returns {number} - Milisegundos restantes
     */
    getRemainingTime() {
        if (!this.sessionActive || !this.turnStartTime) return 0;
        const timeElapsed = Date.now() - this.turnStartTime;
        return Math.max(0, this.turnDuration - timeElapsed);
    }

    /**
     * Agregar una tarea a la sesión
     * @param {string} task - Descripción de la tarea
     * @returns {Array} - Lista actualizada de tareas
     */
    addTask(task) {
        this.sessionTasks.push({
            id: Date.now(),
            description: task,
            completed: false,
            createdAt: new Date().toISOString()
        });
        return this.sessionTasks;
    }

    /**
     * Marcar una tarea como completada
     * @param {number} taskId - ID de la tarea
     * @returns {Object} - Listas actualizadas de tareas
     */
    completeTask(taskId) {
        const taskIndex = this.sessionTasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            this.sessionTasks[taskIndex].completed = true;
            this.sessionTasks[taskIndex].completedAt = new Date().toISOString();
            this.completedTasks.push(this.sessionTasks[taskIndex]);
            this.sessionTasks.splice(taskIndex, 1);
        }
        return {
            pendingTasks: this.sessionTasks,
            completedTasks: this.completedTasks
        };
    }

    /**
 * Generar resumen de la sesión
 * @returns {Object} - Datos del resumen
 */
generateSessionSummary() {
    return {
        completedTasks: this.completedTasks,
        pendingTasks: this.sessionTasks,
        duration: this.turnStartTime ? Date.now() - this.turnStartTime : 0,
        sessionActive: this.sessionActive  // Añadimos esta propiedad para consistencia
    };
}

    /**
     * Verificar si un usuario específico es el driver
     * @param {string} email - Email del usuario
     * @returns {boolean}
     */
    isDriver(email) {
        return this.sessionActive && this.driver === email;
    }

    /**
     * Verificar si un usuario específico es el navigator
     * @param {string} email - Email del usuario
     * @returns {boolean}
     */
    isNavigator(email) {
        return this.sessionActive && this.navigator === email;
    }

    /**
 * Obtener el estado actual de la sesión
 * @returns {Object} - Estado de la sesión
 */
getSessionStatus() {
    if (!this.sessionActive) {
        return { sessionActive: false };  // Cambiado de active a sessionActive para coherencia
    }
    
    return {
        sessionActive: true,  // Cambiado de active a sessionActive para coherencia
        driver: this.driver,
        navigator: this.navigator,
        timeRemaining: this.getRemainingTime(),
        pendingTasks: this.sessionTasks.length,
        completedTasks: this.completedTasks.length
    };
}
}

class SidebarProvider {
    /**
     * @param {vscode.Uri} _extensionUri
     * @param {vscode.Memento} _globalState
     */
    constructor(_extensionUri, _globalState) {
        this._extensionUri = _extensionUri;
        this._globalState = _globalState;
        this.API_URL = 'https://pairchatbot-api.vercel.app/api/chat';
        // Dominios de correo permitidos
        this.ALLOWED_DOMAINS = ['@konradlorenz.edu.co', '@unab.edu.co'];
        
        // Inicializar la sesión de Pair Programming
        this.pairSession = new PairProgrammingSession();
        console.log('Instancia creada:', this.pairSession);
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
        
        // Pasar el estado de autenticación al HTML
        webviewView.webview.html = this._getHtmlContent(
            webviewView.webview, 
            nonce, 
            !!authenticatedEmail, 
            authenticatedEmail
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
            if (!this._validarFormatoEmail(email)) {
                throw new Error('Formato de correo electrónico inválido');
            }

            // Verificar dominio permitido
            if (!this._validarDominioEmail(email)) {
                throw new Error('Dominio de correo no autorizado. Solo se permiten correos de las universidades aliadas.');
            }

            // Guardar el email autenticado
            await this._globalState.update('authenticatedEmail', email);

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
        // Eliminar el email autenticado
        await this._globalState.update('authenticatedEmail', undefined);
        
        // Notificar al webview que se cerró la sesión
        webviewView.webview.postMessage({
            type: 'LOGOUT_SUCCESS'
        });
    }

    /**
     * @private
     * @param {string} email
     * @returns {boolean}
     */
    _validarFormatoEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
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
        console.log('_procesarComandoPP llamado con comando:', comando);
    console.log('Parámetros:', params);
    
        const authenticatedEmail = this._globalState.get('authenticatedEmail');
        if (!authenticatedEmail) {
            console.log('No hay email autenticado');
            throw new Error('No estás autenticado. Por favor, inicia sesión primero.');
        }
        
        let resultado;
        switch (comando) {
            case 'INICIAR_SESION':
                console.log('Procesando INICIAR_SESION');
                if (!params.navigatorEmail) {
                    console.log('Email del navegante no proporcionado');
                    throw new Error('Se requiere el correo del navegante para iniciar la sesión.');
                }
                resultado = this.pairSession.startSession(authenticatedEmail, params.navigatorEmail);
                console.log('Sesión iniciada con resultado:', resultado);
                break;
                
            case 'CAMBIAR_ROLES':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para cambiar roles.');
                }
                resultado = this.pairSession.switchRoles();
                break;
                
            case 'FINALIZAR_SESION':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para finalizar.');
                }
                resultado = this.pairSession.endSession();
                break;
                
            case 'AGREGAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para agregar tareas.');
                }
                if (!params.descripcion) {
                    throw new Error('Se requiere una descripción para la tarea.');
                }
                resultado = this.pairSession.addTask(params.descripcion);
                break;
                
            case 'COMPLETAR_TAREA':
                if (!this.pairSession.sessionActive) {
                    throw new Error('No hay una sesión activa para completar tareas.');
                }
                if (!params.taskId) {
                    throw new Error('Se requiere el ID de la tarea a completar.');
                }
                resultado = this.pairSession.completeTask(params.taskId);
                break;
                
            case 'OBTENER_ESTADO':
                resultado = this.pairSession.getSessionStatus();
                break;
                
            default:
                throw new Error(`Comando desconocido: ${comando}`);
        }
        console.log('Enviando resultado al webview:', resultado);
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

            // Modificamos la estructura para que coincida con lo que espera el servidor
            const requestData = {
                message: message.texto,
                // El email ahora se enviará como metadato en el mensaje para que el servidor tenga la info
                // pero no intentará procesarlo como un parámetro principal
                metadata: {
                    userEmail: authenticatedEmail,
                    // Añadir información de pair programming si hay una sesión activa
                    pairProgramming: this.pairSession.sessionActive ? {
                        isActive: true,
                        driver: this.pairSession.driver,
                        navigator: this.pairSession.navigator
                    } : {
                        isActive: false
                    }
                }
            };

            if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
                const codigo = vscode.window.activeTextEditor.document.getText();
                if (codigo.trim()) {
                    // Esta es la propiedad que el servidor espera
                    requestData.code = codigo;
                }
            }

            console.log('Enviando a la API:', JSON.stringify(requestData, null, 2));

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                // Intentar leer el cuerpo del error
                let errorBody = '';
                try {
                    errorBody = await response.text();
                    console.error('Cuerpo del error:', errorBody);
                } catch (readError) {
                    console.error('No se pudo leer el cuerpo del error:', readError);
                }
                
                throw new Error(`Error del servidor: ${response.status}. Detalles: ${errorBody}`);
            }

            const data = await response.json();
            
            if (data && typeof data === 'object' && data !== null && 'response' in data && typeof data.response === 'string') {
                this._enviarRespuesta(webviewView, data.response);
            } else {
                throw new Error('Respuesta inválida del servidor');
            }

        } catch (error) {
            console.error('Error completo:', error);
            throw new Error(`Error al procesar mensaje: ${error.message}`);
        }
    }

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

    /**
     * @private
     * @param {vscode.Webview} webview
     * @param {string} nonce
     * @param {boolean} isAuthenticated
     * @param {string|undefined} authenticatedEmail
     */
    _getHtmlContent(webview, nonce, isAuthenticated, authenticatedEmail) {
        // Obtener la ruta del recurso de la imagen
        const leiaImagePath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'leia.jpg'));
        
        return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
            <title>Leia - Programming Assistant</title>
            <style>
                body {
                    padding: 15px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }
                .chat-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-height: 100vh;
    overflow-y: auto;
    padding: 15px;
    box-sizing: border-box;
}
                .login-container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 30px);
                    gap: 10px;
                }
                .chat-messages {
    flex: 1;
    min-height: 150px;
    max-height: 40vh;
    overflow-y: auto;
    border: 1px solid var(--vscode-input-border);
    padding: 10px;
    margin-bottom: 10px;
    background: var(--vscode-input-background);
}
                .input-section {
    position: sticky;
    bottom: 0;
    background: var(--vscode-editor-background);
    padding: 10px 0;
    z-index: 10;
}
                .input-container {
                    display: flex;
                    gap: 8px;
                }
                textarea, input[type="email"] {
                    flex: 1;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 8px;
                }
                textarea {
                    min-height: 60px;
                    resize: vertical;
                }
                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    cursor: pointer;
                }
                .button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .message {
                    margin-bottom: 8px;
                    padding: 8px;
                    border-radius: 4px;
                    white-space: pre-wrap;
                }
                .message.user {
                    background: var(--vscode-editor-background);
                    margin-left: 20px;
                }
                .message.bot {
                    background: var(--vscode-editor-selectionBackground);
                    margin-right: 20px;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    background: var(--vscode-inputValidation-errorBackground);
                    padding: 8px;
                    margin: 8px 0;
                    border-radius: 4px;
                }
                .bot-container {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }
                .bot-profile {
                    flex-shrink: 0;
                    margin-right: 12px;
                }
                .bot-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid var(--vscode-button-background);
                }
                .welcome-container .bot-avatar {
                    width: 80px;
                    height: 80px;
                }
                .welcome-container .bot-profile {
                    margin-right: 20px;
                }
                .welcome-container .message.bot {
                    font-size: 1.1em;
                }
                .bot-message-container {
                    flex-grow: 1;
                }
                .bot-name {
                    font-weight: bold;
                    margin-bottom: 4px;
                    color: var(--vscode-button-background);
                }
                .login-container {
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }
                .login-box {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px;
                    width: 100%;
                    max-width: 400px;
                }
                .login-title {
                    margin-bottom: 20px;
                    color: var(--vscode-button-background);
                }
                .login-field {
                    margin-bottom: 15px;
                }
                .login-label {
                    display: block;
                    margin-bottom: 5px;
                    text-align: left;
                }
                .login-info {
                    font-size: 0.9em;
                    margin: 10px 0;
                    opacity: 0.8;
                }
                .user-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    background: var(--vscode-editor-background);
                    padding: 8px;
                    border-radius: 4px;
                }
                .user-email {
                    font-size: 0.9em;
                }
                .logout-btn {
                    font-size: 0.8em;
                    padding: 4px 8px;
                }
                
                /* Estilos para Pair Programming */
                .pair-programming-container {
    margin-top: 20px;
    border-top: 1px solid var(--vscode-input-border);
    padding-top: 15px;
}

                
                .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    cursor: pointer;
}

.section-header h3 {
    margin: 0;
    color: var(--vscode-button-background);
}
    .toggle-icon {
    font-size: 18px;
    transition: transform 0.3s ease;
}

.toggle-icon.collapsed {
    transform: rotate(-90deg);
}

.pair-programming-content {
    overflow: hidden;
    transition: max-height 0.3s ease;
    max-height: 1000px; /* Altura máxima cuando está expandido */
}

.pair-programming-content.collapsed {
    max-height: 0;
}

/* Cuando el panel de pair programming está colapsado, permitir que el chat use más espacio */
.pair-programming-content.collapsed ~ .chat-messages,
.pair-programming-container.collapsed-container .chat-messages {
    max-height: calc(80vh - 120px); /* Mayor altura cuando el panel está colapsado */
}


                
                .session-status {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 15px;
                }
                
                .status-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                
                .timer-display {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: monospace;
                }
                
                .roles-container {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                
                .role-box {
                    flex: 1;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 8px;
                    background: var(--vscode-input-background);
                }
                
                .role-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .controls-container {
                    display: flex;
                    gap: 10px;
                }
                
                .form-group {
                    margin-bottom: 10px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                }
                
                .task-manager {
                    margin-top: 20px;
                }
                
                .section-subheader h4 {
                    margin: 0 0 10px 0;
                }
                
                .add-task-form {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 15px;
                }
                
                .add-task-form input {
                    flex: 1;
                }
                
                .tasks-list-container {
                    margin-bottom: 15px;
                }
                
                .tasks-list-header {
                    font-weight: bold;
                    margin-bottom: 5px;}
                
                .tasks-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    max-height: 150px;
                    overflow-y: auto;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                
                .task-item {
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-input-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .task-item:last-child {
                    border-bottom: none;
                }
                
                .task-complete-btn {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 0.8em;
                }
                
                .completed-task {
                    opacity: 0.7;
                    text-decoration: line-through;
                }
                
                .pair-programming-guide {
                    margin-top: 20px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 12px;
                }
                
                .guide-header {
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                
                .guide-content p {
                    margin: 5px 0;
                }
                
                .guide-tips {
                    margin-top: 10px;
                }
                
                .guide-tip {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 5px;
                }
                
                .tip-icon {
                    margin-right: 8px;
                }
                
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-button-background);
                    border-radius: 4px;
                    padding: 15px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    max-width: 300px;
                }
                
                .notification-content h4 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-button-background);
                }
                
                .notification-content p {
                    margin: 0 0 15px 0;
                }
                
                .session-summary {
                    margin-top: 15px;
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                
                .session-summary h4 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-button-background);
                }
                
                .session-summary p {
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            ${!isAuthenticated ? `
            <!-- Pantalla de login -->
            <div class="login-container" id="loginContainer">
                <div class="login-box">
                    <div class="bot-container welcome-container">
                        <div class="bot-profile">
                            <img src="${leiaImagePath}" alt="Leia" class="bot-avatar">
                        </div>
                        <div class="bot-message-container">
                            <div class="bot-name">Leia</div>
                            <div class="message bot">
                                ¡Hola! Soy Leia, tu asistente de programación. Para comenzar, por favor ingresa tu correo universitario.
                            </div>
                        </div>
                    </div>
                    
                    <div class="login-field">
                        <label for="emailInput" class="login-label">Correo universitario:</label>
                        <div class="input-container">
                            <input type="email" id="emailInput" placeholder="digita tu correo" />
                            <button class="button" id="loginBtn">Ingresar</button>
                        </div>
                    </div>
                    
                    <div class="login-info">
                        Solo se permiten correos autorizados
                    </div>
                    
                    <div id="loginError" class="error" style="display: none;"></div>
                </div>
            </div>
            ` : ''}
            
            <!-- Pantalla del chat (oculta inicialmente si no está autenticado) -->
            <div class="chat-container" id="chatContainer" style="${!isAuthenticated ? 'display: none;' : ''}">
                <!-- Información del usuario -->
                <div class="user-info">
                    <div class="user-email">Conectado como: <strong id="userEmailDisplay">${authenticatedEmail || ''}</strong></div>
                    <button class="button logout-btn" id="logoutBtn">Cerrar sesión</button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="bot-container welcome-container">
                        <div class="bot-profile">
                            <img src="${leiaImagePath}" alt="Leia" class="bot-avatar">
                        </div>
                        <div class="bot-message-container">
                            <div class="bot-name">Leia</div>
                            <div class="message bot">
                                ¡Hola! 👋 Soy Leia, tu compañera perruna de programación. Estoy aquí para ayudarte a aprender y resolver dudas sobre código. ¿Qué te gustaría aprender hoy? 

Puedo ayudarte con:
• Explicar conceptos de programación
• Revisar tu código
• Sugerir mejoras y buenas prácticas
• Resolver dudas específicas</div>
                        </div>
                    </div>
                </div>
                <div class="input-section">
                    <div class="checkbox-container">
                        <input type="checkbox" id="incluirCodigo">
                        <label for="incluirCodigo">Analizar código del editor actual</label>
                    </div>
                    <div class="input-container">
                        <textarea 
                            id="mensajeInput" 
                            placeholder="Escribe tu mensaje aquí..."
                        ></textarea>
                        <button class="button" id="enviarBtn">Enviar</button>
                    </div>
                </div>
                
                <!-- Sección de Pair Programming -->
                <div class="pair-programming-container" id="pairProgrammingContainer">
                    <div class="section-header" id="pairProgrammingHeader">
        <h3>Pair Programming 👥</h3>
        <span class="toggle-icon">▼</span>
    </div>
    <div class="pair-programming-content" id="pairProgrammingContent">
                    
                    <!-- Estado de la sesión (Visible cuando hay una sesión activa) -->
                    <div id="sessionStatus" class="session-status" style="display: none;">
                        <div class="status-header">
                            <span>Estado de la sesión</span>
                            <div class="timer-display" id="timerDisplay">15:00</div>
                        </div>
                        <div class="roles-container">
                            <div class="role-box">
                                <div class="role-title">Piloto (Driver)</div>
                                <div class="role-email" id="driverEmail">No asignado</div>
                            </div>
                            <div class="role-box">
                                <div class="role-title">Navegante (Navigator)</div>
                                <div class="role-email" id="navigatorEmail">No asignado</div>
                            </div>
                        </div>
                        <div class="controls-container">
                            <button class="button" id="switchRolesBtn">Cambiar roles</button>
                            <button class="button" id="endSessionBtn">Finalizar sesión</button>
                        </div>
                    </div>
                    
                    <!-- Formulario para iniciar sesión (Visible cuando no hay sesión activa) -->
                    <div id="startSessionForm" class="start-session-form">
                        <div class="form-group">
                            <label for="navigatorEmailInput">Correo del navegante:</label>
                            <input type="email" id="navigatorEmailInput" placeholder="correo@universidad.edu" />
                        </div>
                        <button class="button" id="startSessionBtn">Iniciar sesión de Pair Programming</button>
                    </div>
                    
                    <!-- Gestión de tareas -->
                    <div id="taskManager" class="task-manager" style="display: none;">
                        <div class="section-subheader">
                            <h4>Tareas</h4>
                        </div>
                        <div class="add-task-form">
                            <input type="text" id="newTaskInput" placeholder="Descripción de la tarea" />
                            <button class="button" id="addTaskBtn">Agregar</button>
                        </div>
                        <div class="tasks-list-container">
                            <div class="tasks-list-header">Tareas pendientes</div>
                            <ul id="pendingTasksList" class="tasks-list"></ul>
                        </div>
                        <div class="tasks-list-container">
                            <div class="tasks-list-header">Tareas completadas</div>
                            <ul id="completedTasksList" class="tasks-list"></ul>
                        </div>
                    </div>
                    
                    <!-- Guía de Pair Programming (Visible cuando hay una sesión activa) -->
                    <div id="pairProgrammingGuide" class="pair-programming-guide" style="display: none;">
                        <div class="guide-header">Recordatorio de roles</div>
                        <div class="guide-content">
                            <p><strong>Piloto (Driver):</strong> Controla el teclado y escribe el código. Se concentra en los detalles de implementación.</p>
                            <p><strong>Navegante (Navigator):</strong> Revisa el código, propone ideas y busca errores. Piensa en la estrategia general.</p>
                        </div>
                        <div class="guide-tips">
                            <div class="guide-tip">
                                <span class="tip-icon">💡</span>
                                <span class="tip-text">Cambien roles cada 15 minutos para mantener la participación equilibrada.</span>
                            </div>
                            <div class="guide-tip">
                                <span class="tip-icon">🔍</span>
                                <span class="tip-text">El navegante debe cuestionar decisiones y sugerir alternativas.</span>
                            </div>
                            <div class="guide-tip">
                                <span class="tip-icon">🎯</span>
                                <span class="tip-text">Definan objetivos claros para la sesión usando las tareas.</span>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>

            <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // Elementos del login
                    const loginContainer = document.getElementById('loginContainer');
                    const emailInput = document.getElementById('emailInput');
                    const loginBtn = document.getElementById('loginBtn');
                    const loginError = document.getElementById('loginError');
                    
                    // Elementos del chat
                    const chatContainer = document.getElementById('chatContainer');
                    const chatMessages = document.getElementById('chatMessages');
                    const mensajeInput = document.getElementById('mensajeInput');
                    const incluirCodigoCheckbox = document.getElementById('incluirCodigo');
                    const enviarBtn = document.getElementById('enviarBtn');
                    const userEmailDisplay = document.getElementById('userEmailDisplay');
                    const logoutBtn = document.getElementById('logoutBtn');
                    
                    // Estado de autenticación inicial
                    let isAuthenticated = ${isAuthenticated};
                    
                    // Función para verificar email
                    function verificarEmail() {
                        const email = emailInput.value.trim();
                        if (!email) {
                            mostrarErrorLogin('Por favor, ingresa tu correo universitario');
                            return;
                        }
                        
                        // Enviar al backend para validación
                        vscode.postMessage({
                            type: 'VERIFY_EMAIL',
                            email: email
                        });
                    }
                    
                    // Función para cerrar sesión
                    function logout() {
                        vscode.postMessage({
                            type: 'LOGOUT'
                        });
                    }
                    
                    // Función para mostrar error en login
                    function mostrarErrorLogin(mensaje) {
                        loginError.textContent = mensaje;
                        loginError.style.display = 'block';
                    }
                    
                    // Función para agregar mensaje al chat
                    async function agregarMensaje(texto, tipo) {
                        if (tipo === 'bot') {
                            const mensajes = texto.split('|');
                            for (const mensaje of mensajes) {
                                const botContainer = document.createElement('div');
                                botContainer.className = 'bot-container';
                                
                                const botProfile = document.createElement('div');
                                botProfile.className = 'bot-profile';
                                
                                const avatar = document.createElement('img');
                                avatar.src = '${leiaImagePath}';
                                avatar.alt = 'Leia';
                                avatar.className = 'bot-avatar';
                                
                                const messageContainer = document.createElement('div');
                                messageContainer.className = 'bot-message-container';
                                
                                const botName = document.createElement('div');
                                botName.className = 'bot-name';
                                botName.textContent = 'Leia';
                                
                                const message = document.createElement('div');
                                message.className = 'message bot';
                                message.textContent = mensaje.trim();
                                
                                botProfile.appendChild(avatar);
                                messageContainer.appendChild(botName);
                                messageContainer.appendChild(message);
                                
                                botContainer.appendChild(botProfile);
                                botContainer.appendChild(messageContainer);
                                
                                chatMessages.appendChild(botContainer);
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                                
                                // Pequeña pausa entre mensajes para simular escritura
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        } else {
                            const div = document.createElement('div');
                            div.className = 'message ' + tipo;
                            div.textContent = texto;
                            chatMessages.appendChild(div);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }

                    function mostrarError(texto) {
                        const div = document.createElement('div');
                        div.className = 'error';
                        div.textContent = texto;
                        chatMessages.appendChild(div);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }

                    function enviarMensaje() {
                        const texto = mensajeInput.value.trim();
                        if (!texto) return;

                        const incluirCodigo = incluirCodigoCheckbox.checked;
                        
                        agregarMensaje(texto, 'user');

                        vscode.postMessage({
                            type: 'SEND_MESSAGE',
                            texto: texto,
                            incluirCodigo: incluirCodigo
                        });

                        mensajeInput.value = '';
                    }
                    
                    // Event listeners para login
                    if (loginBtn) {
                        loginBtn.addEventListener('click', verificarEmail);
                        
                        if (emailInput) {
                            emailInput.addEventListener('keypress', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    verificarEmail();
                                }
                            });
                        }
                    }
                    
                    // Event listeners para logout
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', logout);
                    }
                    
                    // Event listeners para chat
                    if (enviarBtn) {
                        enviarBtn.addEventListener('click', enviarMensaje);
                        
                        //if (mensajeInput) {
                        //    mensajeInput.addEventListener('keypress', (e) => {
                        //        if (e.key === 'Enter' && !e.shiftKey) {
                        //            e.preventDefault();
                        //            enviarMensaje();
                        //        }
                        //    });
                        //}
                    }

                    // Gestión de Pair Programming
                    // Elementos DOM para Pair Programming
                    const pairProgrammingHeader = document.getElementById('pairProgrammingHeader');
                    const pairProgrammingContent = document.getElementById('pairProgrammingContent');
const toggleIcon = pairProgrammingHeader.querySelector('.toggle-icon');
                    const pairProgrammingContainer = document.getElementById('pairProgrammingContainer');
                    const sessionStatus = document.getElementById('sessionStatus');
                    const startSessionForm = document.getElementById('startSessionForm');
                    const taskManager = document.getElementById('taskManager');
                    const pairProgrammingGuide = document.getElementById('pairProgrammingGuide');

                    // Estado inicial (podemos guardarlo en localStorage para mantenerlo entre sesiones)
                    let isPairProgrammingCollapsed = localStorage.getItem('pairProgrammingCollapsed') === 'true';

                    // Función para actualizar el estado visual
function updatePairProgrammingCollapseState() {
    if (isPairProgrammingCollapsed) {
        pairProgrammingContent.classList.add('collapsed');
        toggleIcon.classList.add('collapsed');
        toggleIcon.textContent = '▶';
    } else {
        pairProgrammingContent.classList.remove('collapsed');
        toggleIcon.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    }
}

// Inicializar estado
updatePairProgrammingCollapseState();

// Manejar el clic en el encabezado
pairProgrammingHeader.addEventListener('click', function() {
    isPairProgrammingCollapsed = !isPairProgrammingCollapsed;
    
    // Guardar preferencia
    localStorage.setItem('pairProgrammingCollapsed', isPairProgrammingCollapsed);
    
    // Actualizar UI
    updatePairProgrammingCollapseState();
});

// Función para mostrar/ocultar Pair Programming basado en el contexto
function togglePairProgrammingVisibility(shouldShow) {
    if (shouldShow) {
        isPairProgrammingCollapsed = false;
    } else {
        isPairProgrammingCollapsed = true;
    }
    
    updatePairProgrammingCollapseState();
}

// Opcional: Colapsar automáticamente cuando se inicia una sesión
function onSessionChange(isActive) {
    // Si una sesión se inicia, expandir la sección si estaba colapsada
    if (isActive && isPairProgrammingCollapsed) {
        togglePairProgrammingVisibility(true);
    }
}
                    
                    // Elementos para estado de sesión
                    const timerDisplay = document.getElementById('timerDisplay');
                    const driverEmail = document.getElementById('driverEmail');
                    const navigatorEmail = document.getElementById('navigatorEmail');
                    const switchRolesBtn = document.getElementById('switchRolesBtn');
                    const endSessionBtn = document.getElementById('endSessionBtn');
                    
                    // Elementos para iniciar sesión
                    const navigatorEmailInput = document.getElementById('navigatorEmailInput');
                    const startSessionBtn = document.getElementById('startSessionBtn');
                    
                    // Elementos para gestión de tareas
                    const newTaskInput = document.getElementById('newTaskInput');
                    const addTaskBtn = document.getElementById('addTaskBtn');
                    const pendingTasksList = document.getElementById('pendingTasksList');
                    const completedTasksList = document.getElementById('completedTasksList');
                    
                    // Variable para almacenar las tareas
                    let pendingTasks = [];
                    let completedTasks = [];
                    
                    // Variable para temporizador UI
                    let timerInterval;
                    
                    // Funciones de gestión de la UI
                    
                    // Actualizar el temporizador en la UI
                    function updateTimerDisplay(timeRemaining) {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    // Usa comillas simples o dobles en lugar de backticks
    const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();
    const secondsStr = seconds < 10 ? '0' + seconds : seconds.toString();
    
    timerDisplay.textContent = minutesStr + ':' + secondsStr;
}
                    
                    // Iniciar el contador regresivo en la UI
                    function startUITimer(duration) {
                        clearInterval(timerInterval);
                        
                        const endTime = Date.now() + duration;
                        
                        updateTimerDisplay(duration);
                        
                        timerInterval = setInterval(() => {
                            const remaining = endTime - Date.now();
                            
                            if (remaining <= 0) {
                                clearInterval(timerInterval);
                                updateTimerDisplay(0);
                                notifySwitchRoles();
                                return;
                            }
                            
                            updateTimerDisplay(remaining);
                        }, 1000);
                    }
                    
                    // Notificar que es hora de cambiar roles
function notifySwitchRoles() {
    // Crear el contenedor de la notificación
    const notification = document.createElement('div');
    notification.className = 'notification switch-roles-notification';
    
    // Crear el contenido
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notification-content';
    
    // Crear el título
    const title = document.createElement('h4');
    title.textContent = '¡Tiempo completado!';
    
    // Crear el mensaje
    const message = document.createElement('p');
    message.textContent = 'Es momento de cambiar roles entre piloto y navegante.';
    
    // Crear el botón
    const button = document.createElement('button');
    button.className = 'button';
    button.id = 'switchRolesNotificationBtn';
    button.textContent = 'Cambiar ahora';
    
    // Construir la estructura
    contentDiv.appendChild(title);
    contentDiv.appendChild(message);
    contentDiv.appendChild(button);
    notification.appendChild(contentDiv);
    
    // Agregar al cuerpo del documento
    document.body.appendChild(notification);
    
    // Evento para el botón de la notificación
    document.getElementById('switchRolesNotificationBtn').addEventListener('click', function() {
        switchRoles();
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Auto-eliminar la notificación después de 30 segundos
    setTimeout(function() {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 30000);
}
                    
                    // Actualizar la lista de tareas pendientes
function updatePendingTasksList() {
    pendingTasksList.innerHTML = '';
    
    if (pendingTasks.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'task-item empty-task';
        emptyItem.textContent = 'No hay tareas pendientes';
        pendingTasksList.appendChild(emptyItem);
        return;
    }
    
    for (let i = 0; i < pendingTasks.length; i++) {
        const task = pendingTasks[i];
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        
        // Crear los elementos internos individualmente en lugar de usar innerHTML
        const taskDesc = document.createElement('span');
        taskDesc.className = 'task-description';
        taskDesc.textContent = task.description;
        
        const completeBtn = document.createElement('button');
        completeBtn.className = 'task-complete-btn';
        completeBtn.setAttribute('data-task-id', task.id);
        completeBtn.textContent = 'Completar';
        
        // Agregar los elementos al item de la tarea
        taskItem.appendChild(taskDesc);
        taskItem.appendChild(completeBtn);
        
        // Agregar la tarea a la lista
        pendingTasksList.appendChild(taskItem);
    }
    
    // Agregar eventos a los botones de completar
    const completeButtons = document.querySelectorAll('.task-complete-btn');
    for (let i = 0; i < completeButtons.length; i++) {
        completeButtons[i].addEventListener('click', function(e) {
            const taskId = parseInt(this.getAttribute('data-task-id'));
            completeTask(taskId);
        });
    }
}
                    
                    // Actualizar la lista de tareas completadas
                    function updateCompletedTasksList() {
                        completedTasksList.innerHTML = '';
                        
                        if (completedTasks.length === 0) {
                            const emptyItem = document.createElement('li');
                            emptyItem.className = 'task-item empty-task';
                            emptyItem.textContent = 'No hay tareas completadas';
                            completedTasksList.appendChild(emptyItem);
                            return;
                        }
                        
                        completedTasks.forEach(task => {
                            const taskItem = document.createElement('li');
                            taskItem.className = 'task-item completed-task';
                            taskItem.textContent = task.description;
                            completedTasksList.appendChild(taskItem);
                        });
                    }
                    
                    // Funciones para interactuar con la extensión
                    
                    // Iniciar sesión de Pair Programming
                    function startSession() {
    console.log('Función startSession ejecutada');
    const navEmail = navigatorEmailInput.value.trim();
    console.log('Email del navegante:', navEmail);
    
    if (!navEmail) {
        console.log('Email vacío, mostrando error');
        // Mostrar error
        const error = document.createElement('div');
        error.className = 'error';
        error.textContent = 'Por favor, ingresa el correo del navegante.';
        startSessionForm.appendChild(error);
        
        // Auto-eliminar el error después de 3 segundos
        setTimeout(function() {
            if (error.parentNode) {
                error.parentNode.removeChild(error);
            }
        }, 3000);
        
        return;
    }
    
    console.log('Enviando comando INICIAR_SESION con email:', navEmail);
    // Enviar comando a la extensión
    vscode.postMessage({
        type: 'PP_COMANDO',
        comando: 'INICIAR_SESION',
        params: {
            navigatorEmail: navEmail
        }
    });
}
                    
                    // Cambiar roles
                    function switchRoles() {
                        vscode.postMessage({
                            type: 'PP_COMANDO',
                            comando: 'CAMBIAR_ROLES'
                        });
                    }
                    
                    // Finalizar sesión
                    function endSession() {
                        vscode.postMessage({
                            type: 'PP_COMANDO',
                            comando: 'FINALIZAR_SESION'
                        });
                    }
                    
                    // Agregar nueva tarea
                    function addTask() {
                        const description = newTaskInput.value.trim();
                        if (!description) return;
                        
                        vscode.postMessage({
                            type: 'PP_COMANDO',
                            comando: 'AGREGAR_TAREA',
                            params: {
                                descripcion: description
                            }
                        });
                        
                        newTaskInput.value = '';
                    }
                    
                    // Completar tarea
                    function completeTask(taskId) {
                        vscode.postMessage({
                            type: 'PP_COMANDO',
                            comando: 'COMPLETAR_TAREA',
                            params: {
                                taskId
                            }
                        });
                    }
                    
                    // Actualizar UI según estado de la sesión
                    // Actualizar UI según estado de la sesión
function updateSessionUI(sessionData) {
    console.log('Actualizando UI con datos:', sessionData);
    
    // Corregir la verificación para usar sessionActive en lugar de active
    if (sessionData.sessionActive) {
        console.log('Sesión activa, mostrando componentes');
        // Mostrar componentes de sesión activa
        sessionStatus.style.display = 'block';
        taskManager.style.display = 'block';
        pairProgrammingGuide.style.display = 'block';
        startSessionForm.style.display = 'none';
        
        // Actualizar información
        driverEmail.textContent = sessionData.driver;
        navigatorEmail.textContent = sessionData.navigator;
        
        // Iniciar temporizador UI
        startUITimer(sessionData.timeRemaining);
    } else {
        console.log('Sesión inactiva, mostrando formulario');
        // Mostrar formulario de inicio
        sessionStatus.style.display = 'none';
        taskManager.style.display = 'none';
        pairProgrammingGuide.style.display = 'none';
        startSessionForm.style.display = 'block';
        
        // Limpiar el temporizador
        clearInterval(timerInterval);
        
        // Limpiar tareas
        pendingTasks = [];
        completedTasks = [];
        updatePendingTasksList();
        updateCompletedTasksList();
    }
}
                    
                    // Función para solicitar estado actual
                    function requestSessionStatus() {
                        vscode.postMessage({
                            type: 'PP_COMANDO',
                            comando: 'OBTENER_ESTADO'
                        });
                    }
                    
                    // Event Listeners para Pair Programming
                    if (startSessionBtn) {
    console.log('Botón de iniciar sesión encontrado en el DOM');
    startSessionBtn.addEventListener('click', function() {
        console.log('Botón de iniciar sesión clickeado');
        startSession();
    });
}

                    
                    if (switchRolesBtn) {
                        switchRolesBtn.addEventListener('click', switchRoles);
                    }
                    
                    if (endSessionBtn) {
                        endSessionBtn.addEventListener('click', endSession);
                    }
                    
                    if (addTaskBtn) {
                        addTaskBtn.addEventListener('click', addTask);
                    }
                    
                    if (newTaskInput) {
                        newTaskInput.addEventListener('keypress', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addTask();
                            }
                        });
                    }
                    
                    // Manejo de mensajes desde el extension host
                    window.addEventListener('message', event => {
                        const message = event.data;
                        console.log('Mensaje recibido en el webview:', message.type);
    
    if (message.type === 'PP_RESULTADO') {
        console.log('Resultado de comando PP recibido:', message.comando);
        console.log('Datos del resultado:', message.resultado);
        
        
    }
                        
                        switch (message.type) {
                            case 'AUTH_SUCCESS':
                                isAuthenticated = true;
                                if (loginContainer) loginContainer.style.display = 'none';
                                chatContainer.style.display = 'flex';
                                userEmailDisplay.textContent = message.email;
                                break;
                                
                            case 'LOGOUT_SUCCESS':
                                isAuthenticated = false;
                                chatContainer.style.display = 'none';
                                if (loginContainer) loginContainer.style.display = 'flex';
                                if (emailInput) emailInput.value = '';
                                if (loginError) {
                                    loginError.textContent = '';
                                    loginError.style.display = 'none';
                                }
                                break;
                                
                            case 'BOT_RESPONSE':
                                agregarMensaje(message.mensaje, 'bot');
                                break;
                                
                            case 'ERROR':
                                if (isAuthenticated) {
                                    mostrarError(message.mensaje);
                                } else {
                                    mostrarErrorLogin(message.mensaje);
                                }
                                break;
                                
                            case 'PP_RESULTADO':
    switch (message.comando) {
        case 'INICIAR_SESION':
        case 'CAMBIAR_ROLES':
        case 'OBTENER_ESTADO':
            updateSessionUI(message.resultado);
            break;
            
        case 'FINALIZAR_SESION':
            updateSessionUI({ active: false });
            
            // Crear el contenedor del resumen
            const resumenSesion = document.createElement('div');
            resumenSesion.className = 'session-summary';
            
            // Crear el título
            const titleElement = document.createElement('h4');
            titleElement.textContent = 'Resumen de la sesión';
            
            // Crear los párrafos de información
            const completedTasksElement = document.createElement('p');
            completedTasksElement.textContent = 'Tareas completadas: ' + message.resultado.completedTasks.length;
            
            const pendingTasksElement = document.createElement('p');
            pendingTasksElement.textContent = 'Tareas pendientes: ' + message.resultado.pendingTasks.length;
            
            const durationElement = document.createElement('p');
            const durationMinutes = Math.floor(message.resultado.duration / 60000);
            durationElement.textContent = 'Duración: ' + durationMinutes + ' minutos';
            
            // Agregar todos los elementos al contenedor
            resumenSesion.appendChild(titleElement);
            resumenSesion.appendChild(completedTasksElement);
            resumenSesion.appendChild(pendingTasksElement);
            resumenSesion.appendChild(durationElement);
            
            // Agregar el resumen a la interfaz
            startSessionForm.appendChild(resumenSesion);
            
            // Auto-eliminar el resumen después de 15 segundos
            setTimeout(function() {
                if (resumenSesion.parentNode) {
                    resumenSesion.parentNode.removeChild(resumenSesion);
                }
            }, 15000);
            break;
            
        case 'AGREGAR_TAREA':
            pendingTasks = message.resultado;
            updatePendingTasksList();
            break;
            
        case 'COMPLETAR_TAREA':
            pendingTasks = message.resultado.pendingTasks;
            completedTasks = message.resultado.completedTasks;
            updatePendingTasksList();
            updateCompletedTasksList();
            break;
    }
    break;
                        }
                    });
                    
                    // Inicializar Pair Programming: solicitar estado actual
                    if (isAuthenticated) {
                        requestSessionStatus();
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}

module.exports = {
    activate
};