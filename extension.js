const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Activando extensión Leia - Programming Assistant');

    const provider = new SidebarProvider(context.extensionUri, context.globalState);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("pairchatbot.sidebarView", provider)
    );
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
     * @private
     * @param {vscode.WebviewView} webviewView
     * @param {{ texto: string, incluirCodigo: boolean }} message
     */
    // Modifica el método _procesarMensaje para adaptar la estructura de datos
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
                userEmail: authenticatedEmail
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
                .chat-container, .login-container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 30px);
                    gap: 10px;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    border: 1px solid var(--vscode-input-border);
                    padding: 10px;
                    margin-bottom: 10px;
                    background: var(--vscode-input-background);
                }
                .input-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
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

                    // Manejo de mensajes desde el extension host
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
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
                        }
                    });
                })();
            </script>
        </body>
        </html>`;
    }
}

module.exports = {
    activate
};
