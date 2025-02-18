const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Activando extensión Leia - Programming Assistant');

    const provider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("pairchatbot.sidebarView", provider)
    );
}

class SidebarProvider {
    /**
     * @param {vscode.Uri} _extensionUri
     */
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this.API_URL = 'https://pairchatbot-api.vercel.app/api/chat';
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
        webviewView.webview.html = this._getHtmlContent(webviewView.webview, nonce);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                if (message.type === 'SEND_MESSAGE') {
                    await this._procesarMensaje(webviewView, message);
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
     * @param {{ texto: string, incluirCodigo: boolean }} message
     */
    async _procesarMensaje(webviewView, message) {
        try {
            const requestData = {
                message: message.texto
            };

            if (message.incluirCodigo === true && vscode.window.activeTextEditor) {
                const codigo = vscode.window.activeTextEditor.document.getText();
                if (codigo.trim()) {
                    requestData.code = codigo;
                }
            }

            console.log('Enviando a la API:', requestData);

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && typeof data === 'object' && data !== null && 'response' in data && typeof data.response === 'string') {
                this._enviarRespuesta(webviewView, data.response);
            } else {
                throw new Error('Respuesta inválida del servidor');
            }

        } catch (error) {
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
     */
    _getHtmlContent(webview, nonce) {
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
                textarea {
                    flex: 1;
                    min-height: 60px;
                    resize: vertical;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 8px;
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
            </style>
        </head>
        <body>
            <div class="chat-container">
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
                    const chatMessages = document.getElementById('chatMessages');
                    const mensajeInput = document.getElementById('mensajeInput');
                    const incluirCodigoCheckbox = document.getElementById('incluirCodigo');
                    const enviarBtn = document.getElementById('enviarBtn');

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

                    enviarBtn.addEventListener('click', enviarMensaje);
                    
                    mensajeInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            enviarMensaje();
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'BOT_RESPONSE':
                                agregarMensaje(message.mensaje, 'bot');
                                break;
                            case 'ERROR':
                                mostrarError(message.mensaje);
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