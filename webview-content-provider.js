/**
 * Este módulo proporciona el contenido HTML para el webview de la extensión
 */

/**
 * Genera el contenido HTML para el webview
 * @param {Object} webview - Instancia del webview 
 * @param {string} nonce - Valor de seguridad para CSP
 * @param {boolean} isAuthenticated - Si el usuario está autenticado
 * @param {string|undefined} authenticatedEmail - Email del usuario autenticado
 * @param {string} leiaImagePath - Ruta a la imagen del avatar de Leia
 * @returns {string} - Contenido HTML para el webview
 */
function getWebviewContent(webview, nonce, isAuthenticated, authenticatedEmail, leiaImagePath) {
    // Base HTML con metadatos y seguridad
    const baseHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https:; font-src https:;">
    <title>Leia - Programming Assistant</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
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
            min-height: 80px;
            resize: vertical;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
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
            position: relative;
        }
        .message.user {
            background: var(--vscode-editor-background);
            margin-left: 20px;
        }
        .message.bot {
            background: var(--vscode-editor-selectionBackground);
            margin-right: 20px;
        }
        /* Estilos para código */
        pre {
            background: var(--vscode-editor-background);
            border-radius: 6px;
            margin: 8px 0;
            padding: 10px;
            overflow-x: auto;
            border-left: 3px solid var(--vscode-button-background);
        }
        pre code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
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
    <!-- Cargar Prism.js y componentes -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-html.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js"></script>`;

    // Login form HTML (if not authenticated)
    const loginHtml = !isAuthenticated ? `
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
                    <input type="email" id="emailInput" placeholder="tucorreo@unab.edu.co" />
                    <button class="button" id="loginBtn">Ingresar</button>
                </div>
            </div>
            
            <div class="login-info">
                Solo se permiten correos con dominio @konradlorenz.edu.co o @unab.edu.co
            </div>
            
            <div id="loginError" class="error" style="display: none;"></div>
        </div>
    </div>` : '';

    // Chat container HTML
    const chatHtml = `
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
    </div>`;

    // JavaScript code
    const scriptHtml = `
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

            // Función para aplicar resaltado de sintaxis después de agregar contenido al DOM
            function aplicarResaltadoSintaxis() {
                if (typeof Prism !== 'undefined') {
                    Prism.highlightAll();
                }
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
                        
                        // El contenido ya viene procesado desde el backend
                        message.innerHTML = mensaje.trim();
                        
                        botProfile.appendChild(avatar);
                        messageContainer.appendChild(botName);
                        messageContainer.appendChild(message);
                        
                        botContainer.appendChild(botProfile);
                        botContainer.appendChild(messageContainer);
                        
                        chatMessages.appendChild(botContainer);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        
                        // Aplicar resaltado de sintaxis después de agregar contenido
                        aplicarResaltadoSintaxis();
                        
                        // Pequeña pausa entre mensajes para simular escritura
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } else {
                    const div = document.createElement('div');
                    div.className = 'message ' + tipo;
                    
                    // El contenido ya viene procesado desde el backend
                    div.innerHTML = texto;
                    
                    chatMessages.appendChild(div);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Aplicar resaltado de sintaxis después de agregar contenido
                    aplicarResaltadoSintaxis();
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
                
                // Ya no enviamos con Enter para permitir escribir código multilínea
                // El usuario debe usar el botón Enviar explícitamente
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

    // Concatenate all parts
    return baseHtml + loginHtml + chatHtml + scriptHtml;
}

module.exports = {
    getWebviewContent
};