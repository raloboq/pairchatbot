    /**
     * @param {Object} webview - Instancia del webview 
     * @param {string} nonce - Valor de seguridad para CSP
     * @param {boolean} isAuthenticated - Si el usuario está autenticado
     * @param {string|undefined} authenticatedEmail - Email del usuario autenticado
     * @param {Object} leiaImagePath - Uri a la imagen del avatar de Leia
     * @returns {string} - Contenido HTML para el webview
     */
    function getWebviewContent(webview, nonce, isAuthenticated, authenticatedEmail, 
    leiaImagePath) {

        return `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
            <title>Leia - Programming Assistant</title>
            <style>
                /* ---------- GLOBAL ---------- */
                :root{
                    --bg: var(--vscode-editor-background);
                    --fg: var(--vscode-foreground);
                    --input-bg: var(--vscode-input-background);
                    --input-border: var(--vscode-input-border);
                    --button-bg: var(--vscode-button-background);
                    --button-fg: var(--vscode-button-foreground);
                    --error-fg: var(--vscode-errorForeground);
                }
                html,body{
                    margin:0;
                    padding:0;
                    height:100%;
                    font-family: var(--vscode-font-family);
                    color: var(--fg);
                    background: var(--bg);
                }
                /* Container principal - ahora solo el panel izquierdo ocupa todo el ancho */
                .root {
                    display: flex;
                    height: 100vh;
                    width: 100%;
                    box-sizing: border-box;
                }
                /* --- Panel principal (antes izquierdo, ahora ocupa todo) --- */
                .left-panel {
                    width: 100%; /* Cambio: ahora ocupa todo el ancho disponible */
                    min-width: 320px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    padding: 16px;
                    gap: 12px;
                }

                /* ---------- LOGIN (mockup) ---------- */
                .login-screen {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .welcome-title{
                    font-size: 28px;
                    font-weight: 700;
                    line-height: 1.05;
                    margin: 0 0 8px 0;
                }
                .welcome-text {
                    font-size: 14px;
                    color: var(--fg);
                    margin-bottom: 6px;
                }
                .roles-info {
                    background: var(--input-bg);
                    border: 1px solid var(--input-border);
                    padding: 12px;
                    border-radius: 8px;
                }
                .roles-info ul {
                    margin: 8px 0 0 0;
                    padding-left: 18px;
                }
                .roles-info li {
                    margin-bottom: 8px;
                }
                .login-field {
                    margin-top: 8px;
                }
                .login-label {
                    display:block;
                    font-size: 13px;
                    margin-bottom: 6px;
                }
                input[type="email"], input[type="text"] {
                    width:100%;
                    padding:10px;
                    border-radius:6px;
                    border:1px solid var(--input-border);
                    background: var(--input-bg);
                    color: var(--fg);
                    box-sizing:border-box;
                }
                .small-btn {
                    display:inline-block;
                    padding:8px 12px;
                    border-radius:6px;
                    border:none;
                    background: var(--button-bg);
                    color: var(--button-fg);
                    cursor:pointer;
                }
                .small-btn:active { transform: translateY(1px); }
                .login-row {
                    display:flex;
                    gap:8px;
                    align-items:center;
                }

                /* ---------- TABS ---------- */
                .tabs {
                    display:flex;
                    gap:8px;
                    border-bottom:1px solid var(--input-border);
                    padding-bottom:8px;
                }
                .tab-button {
                    background: transparent;
                    border: none;
                    padding:8px 12px;
                    cursor: pointer;
                    color: var(--fg);
                    font-weight:600;
                    border-bottom: 2px solid transparent;
                }
                .tab-button.active {
                    border-bottom-color: var(--button-bg);
                    color: var(--button-bg);
                }

                /* ---------- PAIR PROGRAMMING / TASK CONTENT ---------- */
                .tab-content {
                    display:none;
                    padding: 8px 0 12px 0;
                    overflow: auto;
                    flex: 0 0 auto; /* Cambio: no crece, mantiene su tamaño */
                }
                .tab-content.active {
                    display:block;
                }

                .pair-programming-container {
                    margin-top: 6px;
                }
                .section-header {
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    cursor:pointer;
                    margin-bottom:8px;
                }
                .toggle-icon {
                    transition: transform .25s ease;
                }
                .toggle-icon.collapsed { transform: rotate(-90deg); }

                .pair-programming-content {
                    overflow:hidden;
                    transition: max-height .3s ease;
                }
                .pair-programming-content.collapsed { max-height:0; }

                .session-status {
                    background: var(--input-bg);
                    border:1px solid var(--input-border);
                    padding:10px;
                    border-radius:8px;
                    margin-bottom: 8px;
                }

                .roles-container {
                    display:flex;
                    gap:10px;
                }
                .role-box {
                    flex:1;
                    padding:8px;
                    border:1px solid var(--input-border);
                    border-radius:6px;
                    background: var(--input-bg);
                }

                /* OCULTAR botones de cambiar roles y finalizar sesión */
                .controls-container {
                    display: none !important;
                }

                /* Task manager styles */
                .task-manager {
                    margin-top:8px;
                }
                .add-task-form {
                    display:flex;
                    gap:8px;
                    margin-bottom:10px;
                }

                .tasks-list {
                    list-style:none;
                    padding:0;
                    margin:0;
                    max-height:220px;
                    overflow:auto;
                    border:1px solid var(--input-border);
                    border-radius:6px;
                    background: var(--input-bg);
                }AUTH_SUCCESS
                .task-item {
                    padding:8px;
                    border-bottom:1px solid var(--input-border);
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                }
                .task-item:last-child { border-bottom:none; }
                .task-complete-btn {
                    padding:6px 8px;
                    border-radius:6px;
                    border:none;
                    background: var(--button-bg);
                    color: var(--button-fg);
                    cursor:pointer;
                }

                .completed-task { opacity:0.7; text-decoration: line-through; }

                /* ---------- CHAT - Cambio principal: ahora ocupa el espacio restante ---------- */
                .chat-area {
                    display:flex;
                    flex-direction:column;
                    gap:8px;
                    flex: 1; /* Cambio: ocupa todo el espacio restante */
                    min-height: 0; /* Cambio: permite que se contraiga si es necesario */
                }
                .chat-messages {
                    flex: 1; /* Cambio: ocupa el espacio disponible en lugar de max-height fijo */
                    overflow:auto;
                    background: var(--input-bg);
                    border: 1px solid var(--input-border);
                    padding: 10px;
                    border-radius: 8px;
                    min-height: 200px; /* Cambio: altura mínima para garantizar usabilidad */
                }
                .message { margin-bottom:8px; padding:8px; border-radius:6px; white-space: pre-wrap; }
                .message.bot { background: rgba(255,255,255,0.03); }
                .message.user { background: rgba(255,255,255,0.02); text-align:right; }

                .input-section {
                    display:flex;
                    gap:8px;
                    align-items:center;
                    margin-top:6px;
                    flex: 0 0 auto; /* Cambio: no crece, mantiene su tamaño */
                }
                textarea {
                    flex:1;
                    min-height:56px;
                    max-height:140px;
                    padding:8px;
                    border-radius:6px;
                    border:1px solid var(--input-border);
                    background: var(--input-bg);
                    color: var(--fg);
                    resize: vertical;
                }

                .modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.4);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    }
                .hidden {display: none;}
                .modal-content {
                    background: white;
                    padding: 16px;
                    border-radius: 8px;
                    width: 300px;
                    }
                .modal-actions {
                    margin-top: 10px;
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .modal-actions button {
                    padding: 6px 10px;
                    border: none;
                    border-radius: 6px;
                    background: var(--button-bg);
                    color: var(--button-fg);
                    cursor: pointer;
                }


                .checkbox-row {
                    display:flex;
                    align-items:center;
                    gap:8px;
                    margin-top:6px;
                    flex: 0 0 auto; /* Cambio: no crece, mantiene su tamaño */
                }

                /* notification */
                .notification {
                    position: fixed;
                    top: 14px;
                    right: 14px;
                    z-index: 999;
                    background: var(--input-bg);
                    border: 1px solid var(--button-bg);
                    padding: 12px;
                    border-radius: 8px;
                }
                /* ---------- MODAL CAMBIO DE ROL ---------- */
                .role-modal {
                    display: none;
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    z-index: 9999;

                    /* Fondo semitransparente con más opacidad y blur */
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(4px);

                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;

                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: 1.8rem;
                    text-align: center;
                    padding: 1rem;
                }

                /* Botón adaptado al tema */
                .role-modal .small-btn {
                    margin-top: 20px;
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;

                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    transition: background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
                }

                .role-modal .small-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: scale(1.05);
                    box-shadow: 0 0 12px rgba(255, 255, 255, 0.15);
                }

                /* Mostrar el modal */
                .role-modal.show {
                    display: flex;
                }


                /* small helpers */
                .hidden { display:none; }
                .muted { color: rgba(255,255,255,0.6); font-size:13px; }
            </style>
        </head>
        <body>
            <div class="root">
                <!-- Panel principal: ocupa todo el ancho disponible -->
                <div class="left-panel">
                    <!-- LOGIN SCREEN (mockup) -->
                    ${!isAuthenticated ? `
                    <div id="loginScreen" class="login-screen">
    <div class="welcome-title" style="display:flex; align-items:center; gap:8px;">
        <img src="${leiaImagePath}" alt="Leia" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--button-bg);" />
        ¡HOLA! Soy Leia, tu asistente virtual de programación.
    </div>
                        <div class="welcome-text muted">En esta sesión trabajarás en pareja con un rol asignado a:</div>

                        <div class="roles-info">
                            <ul>
                                <li>🎯 <strong>Piloto (Driver):</strong> controla el teclado y escribe el código. Se concentra en los detalles.</li>
                                <li>🧭 <strong>Navegante (Navigator):</strong> piensa en el código, propone ideas y busca errores.</li>
                            </ul>
                            <div style="margin-top:8px;">Ten en cuenta:</div>
                            <ul>
                                <li>💡 Cambia el rol cada 15 min para mantener la participación equilibrada.</li>
                                <li>🔍 El Navegante debe cuestionar decisiones y sugerir alternativas.</li>
                                <li>✅ Define objetivos claros para la sesión usando tareas.</li>
                            </ul>
                        </div>

                        <div class="login-field">
                            <label class="login-label" for="studentEmailInput">Ingresa correo estudiantil</label>
                            <div class="login-row">
                                <input id="studentEmailInput" type="email" placeholder="usuario@universidad.edu" />
                                <button id="nextBtn" class="small-btn">Siguiente</button>
                            </div>
                        </div>

                        <div id="navigatorField" class="login-field hidden">
                            <label class="login-label" for="navigatorEmailInput">Ingresa el correo del navegante</label>
                            <div class="login-row">
                                <input id="navigatorEmailInput" type="email" placeholder="navegante@universidad.edu" />
                                <button id="startLoginBtn" class="small-btn">Iniciar Sesión</button>
                            </div>
                        </div>

                        <div id="loginError" class="error" style="display:none;"></div>
                    </div>
                    ` : ''}

                    <!-- APP SCREEN (visible al autenticarse) -->
                    <div id="appScreen" class="${!isAuthenticated ? 'hidden' : ''}" style="display: ${isAuthenticated ? 'flex' : 'none'}; flex-direction:column; height:100%;">
                        <!-- user info -->
                        <div class="user-info" style="margin-bottom:6px;">
                            <div class="muted">Conectado como: <strong id="userEmailDisplay">${authenticatedEmail || ''}</strong></div>
                            <div>
                                <button id="logoutBtn" class="small-btn">Finalizar sesión</button>
                            </div>
                        </div>

                        <!-- TABS (arriba) -->
                        <div class="tabs" id="mainTabs">
                            <button class="tab-button active" data-tab="pairTab">Pair Programming</button>
                            <button class="tab-button" data-tab="taskTab">Task</button>
                        </div>

                        <!-- Contenido de pestañas -->
                        <div id="pairTab" class="tab-content active">
                            <div class="pair-programming-container">
                                <div class="section-header" id="pairProgrammingHeader">
                                    <h3 style="margin:0;">Pair Programming 👥</h3>
                                    <span class="toggle-icon" id="pairToggleIcon">▼</span>
                                </div>

                                <div id="pairProgrammingContent" class="pair-programming-content">
                                    <!-- Estado de la sesión -->
                                    <div id="sessionStatus" class="session-status hidden">
                                        <div class="status-header" style="display:flex; justify-content:space-between; align-items:center;">
                                            <span>Estado de la sesión</span>
                                            <div class="muted" id="timerDisplay">15:00</div>
                                        </div>

                                        <div class="roles-container" style="margin-top:8px;">
                                            <div class="role-box">
                                                <div class="role-title">Piloto (Driver)</div>
                                                <div id="driverEmail">No asignado</div>
                                            </div>
                                            <div class="role-box">
                                                <div class="role-title">Navegante (Navigator)</div>
                                                <div id="navigatorEmail">No asignado</div>
                                            </div>
                                        </div>

                                        <!-- BOTONES REMOVIDOS: Ya no se muestran los botones de "Cambiar roles" y "Finalizar sesión" -->
                                        <!-- Los botones están ocultos con CSS: .controls-container { display: none !important; } -->
                                        <div class="controls-container" style="margin-top:8px;">
                                            <button id="switchRolesBtn" class="small-btn">Cambiar roles</button>
                                            <button id="endSessionBtn" class="small-btn">Finalizar sesión</button>
                                        </div>
                                    </div>

                                    <!-- Form iniciar sesión -->
                                    <div id="startSessionForm" style="margin-top:10px;">
                                        <label class="login-label" for="navigatorEmailInputMain">Correo del navegante:</label>
                                        <div style="display:flex; gap:8px;">
                                            <input id="navigatorEmailInputMain" type="email" placeholder="correo@universidad.edu" />
                                            <button id="startSessionBtn" class="small-btn">Iniciar sesión de Pair Programming</button>
                                        </div>
                                    </div>
                                </div> <!-- pairProgrammingContent -->
                            </div>
                        </div>

                        <div id="taskTab" class="tab-content">
                            <div class="task-manager">
                                <div class="section-subheader">
                                    <h4 style="margin:0 0 8px 0;">Tareas</h4>
                                </div>
                                <div class="add-task-form">
                                    <input type="text" id="newTaskInput" placeholder="Descripción de la tarea" />
                                    <button class="small-btn" id="addTaskBtn">Agregar</button>
                                </div>

                                <div class="tasks-list-container">
                                    <div class="tasks-list-header muted">Tareas pendientes</div>
                                    <ul id="pendingTasksList" class="tasks-list"></ul>
                                </div>
                            </div>
                        </div>

                    <!-- CHAT - ahora ocupa el espacio restante -->

                        <!-- CHAT - ahora ocupa el espacio restante -->
                        <div class="chat-area">
                            <div class="chat-messages" id="chatMessages">
                                <div class="bot-container welcome-container">
                                    <div style="display:flex; gap:10px; align-items:flex-start;">
                                        <div style="flex-shrink:0;">
                                            <img src="${leiaImagePath}" alt="Leia" class="bot-avatar" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--button-bg);" />
                                        </div>
                                        <div style="flex:1;">
                                            <div class="bot-name" style="font-weight:700;color:var(--button-bg);">Leia</div>
                                            <div class="message bot">¡Hola! 👋 Soy Leia, tu compañera perruna de programación. Estoy aquí para ayudarte a aprender y resolver dudas sobre código. ¿Qué te gustaría aprender hoy? 

    Puedo ayudarte con:
    • Explicar conceptos de programación
    • Revisar tu código
    • Sugerir mejoras y buenas prácticas
    • Resolver dudas específicas</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="checkbox-row">
                                <input type="checkbox" id="incluirCodigo" />
                                <label for="incluirCodigo">Analizar código del editor actual</label>
                            </div>

                            <div class="input-section">
                                <textarea id="mensajeInput" placeholder="¿En qué te puedo ayudar?"></textarea>
                                <button id="enviarBtn" class="small-btn">Enviar</button>
                            </div>
                        </div>
                    </div> <!-- appScreen -->
                </div> <!-- left-panel -->
            </div> <!-- root -->

            
    <!-- Modal para cambio de rol -->
    <div id="roleModal" class="role-modal hidden">
    <p>⏰ ¡Se acabó el tiempo!<br/> Cambiemos de rol 🚀</p>
    <button id="btnCambiarRol" class="small-btn">Cambiar de rol</button>
    </div>
    
    <!-- Modal para edición de tarea -->
    <div id="editModal" class="modal hidden">
        <div class="modal-content">
            <h3>Editar tarea</h3>
            <input type="text" id="editTaskInput" placeholder="Nueva descripción..." />
            <div class="modal-actions">
                <button id="editCancelBtn">Cancelar</button>
                <button id="editSaveBtn">Guardar</button>
            </div>
        </div>
    </div>


            <script nonce="${nonce}">
                (function() {
                    console.log('Webview script running');
                    const vscode = acquireVsCodeApi();

                    // ✅ Restaurar estado si existe
        function saveState() {
            const chatHistory = Array.from(document.querySelectorAll('.message')).map(m => ({
                sender: m.classList.contains('bot') ? 'bot' : 'user',
                text: m.innerText
            }));
            vscode.setState({ isAuthenticated, chatHistory });
        }
                    /* ---------------------- ELEMENTOS PRINCIPALES ---------------------- */
                    // Login
                    const studentEmailInput = document.getElementById('studentEmailInput');
                    const nextBtn = document.getElementById('nextBtn');
                    const navigatorField = document.getElementById('navigatorField');
                    const navigatorEmailInput = document.getElementById('navigatorEmailInput');
                    const startLoginBtn = document.getElementById('startLoginBtn');
                    const loginError = document.getElementById('loginError');
                    const loginScreen = document.getElementById('loginScreen');

                    // App
                    const appScreen = document.getElementById('appScreen');
                    const userEmailDisplay = document.getElementById('userEmailDisplay');
                    const logoutBtn = document.getElementById('logoutBtn');

                    // Tabs
                    const tabButtons = document.querySelectorAll('.tab-button');
                    const tabContents = document.querySelectorAll('.tab-content');

                    // Pair programming elements
                    const pairProgrammingHeader = document.getElementById('pairProgrammingHeader');
                    const pairProgrammingContent = document.getElementById('pairProgrammingContent');
                    const pairToggleIcon = document.getElementById('pairToggleIcon');
                    const sessionStatus = document.getElementById('sessionStatus');
                    const startSessionForm = document.getElementById('startSessionForm');
                    const pairProgrammingGuide = document.getElementById('pairProgrammingGuide');

                    // Session controls - NOTA: Los botones están ocultos pero mantenemos las referencias por compatibilidad
                    const timerDisplay = document.getElementById('timerDisplay');
                    const driverEmail = document.getElementById('driverEmail');
                    const navigatorEmail = document.getElementById('navigatorEmail');
                    const switchRolesBtn = document.getElementById('switchRolesBtn');
                    const endSessionBtn = document.getElementById('endSessionBtn');
                    const navigatorEmailInputMain = document.getElementById('navigatorEmailInputMain');
                    const startSessionBtn = document.getElementById('startSessionBtn');

                    // Tasks
                    const newTaskInput = document.getElementById('newTaskInput');
                    const addTaskBtn = document.getElementById('addTaskBtn');
                    const pendingTasksList = document.getElementById('pendingTasksList');
                    const completedTasksList = document.getElementById('completedTasksList');

                    // Chat
                    const chatMessages = document.getElementById('chatMessages');
                    const mensajeInput = document.getElementById('mensajeInput');
                    const incluirCodigoCheckbox = document.getElementById('incluirCodigo');
                    const enviarBtn = document.getElementById('enviarBtn');

                    /* ---------------------- ESTADO LOCAL ---------------------- */
                    const state = vscode.getState() || { isAuthenticated: ${isAuthenticated} };
                    console.log('Initial state from vscode.getState():', state);
                    let isAuthenticated = state.isAuthenticated;
                    console.log('Initial isAuthenticated value:', isAuthenticated);
                    let isPairProgrammingCollapsed = localStorage.getItem('pairProgrammingCollapsed') === 'true';
                    let pendingTasks = [];
                    let completedTasks = [];
                    let timerInterval = null;

                    /* ---------------------- LOGIN FLOW (mejorado) ---------------------- */
                    function resetLoginButtons() {
                        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = ' Siguiente '; nextBtn.style.display = ''; }
                        if (startLoginBtn) { startLoginBtn.disabled = false; startLoginBtn.textContent = 'Iniciar Sesión'; }
                    }

                    if (nextBtn) {
                        nextBtn.addEventListener('click', function() {
                            const email = (studentEmailInput && studentEmailInput.value || '').trim();
                            if (!email) {
                                showLoginError('Por favor ingresa tu correo estudiantil');
                                return;
                            }

                            // enviar al host para validar formato y dominio
                            vscode.postMessage({
                                type: 'VERIFY_EMAIL',
                                email: email
                            });

                            // mostrar loading UI localmente
                            nextBtn.disabled = true;
                            nextBtn.textContent = 'Validando...';
                            if (loginError) { loginError.style.display = 'none'; loginError.textContent = ''; }
                        });
                    }

                    if (startLoginBtn) {
                        startLoginBtn.addEventListener('click', function() {
                            const student = (studentEmailInput && studentEmailInput.value || '').trim();
                            const navigator = (navigatorEmailInput && navigatorEmailInput.value || '').trim();
                            if (!student) {
                                showLoginError('Por favor ingresa tu correo estudiantil');
                                return;
                            }
                            if (!navigator) {
                                showLoginError('Por favor ingresa el correo del navegante');
                                return;
                            }

                            // enviar comando para iniciar session de Pair Programming
                            vscode.postMessage({
                                type: 'PP_COMANDO',
                                comando: 'INICIAR_SESION',
                                params: { navigatorEmail: navigator }
                            });

                            // bloquear botón mientras esperamos respuesta
                            startLoginBtn.disabled = true;
                            startLoginBtn.textContent = 'Iniciando...';
                        });
                    }

                    function showLoginError(msg) {
                        if (loginError) {
                            loginError.textContent = msg;
                            loginError.style.display = 'block';
                        }
                    }

                    /* ---------------------- LOGOUT ---------------------- */
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', function() {
                            // Notificar al host
                            vscode.postMessage({ type: 'logoutRequest' });

                        });
                    }

                    function resetUI() {
                        // 1. Actualizar el estado de autenticación
                        isAuthenticated = false;
                        vscode.setState({ isAuthenticated: false });

                        // 2. Alternar la visibilidad de las pantallas
                        if (appScreen) appScreen.style.display = 'none';
                        if (loginScreen) loginScreen.style.display = 'flex';

                        // 3. Limpiar campos de entrada del login
                        if (studentEmailInput) studentEmailInput.value = '';
                        if (navigatorEmailInput) navigatorEmailInput.value = '';
                        if (navigatorField) navigatorField.classList.add('hidden');
                        if (studentEmailInput) studentEmailInput.disabled = false;
                        resetLoginButtons();

                        // 4. Limpiar mensaje de error del login
                        if (loginError) {
                            loginError.textContent = '';
                            loginError.style.display = 'none';
                        }

                        // 5. Limpiar el historial de chat en la UI
                        if (chatMessages) {
                            // Dejar solo el mensaje de bienvenida inicial
                            const welcomeMessage = chatMessages.querySelector('.welcome-container');
                            chatMessages.innerHTML = '';
                            if (welcomeMessage) {
                                chatMessages.appendChild(welcomeMessage);
                            }
                        }
                        
                        // 6. Resetear la UI de Pair Programming
                        updateSessionUI({ sessionActive: false });
                    }

                    /* ---------------------- TABS ---------------------- */
                    // Restaurar pestaña activa
                    const savedTab = localStorage.getItem('activeTab');
                    if (savedTab) {
                        tabButtons.forEach(b => b.classList.remove('active'));
                        tabContents.forEach(c => c.classList.remove('active'));
                        const btn = Array.from(tabButtons).find(x => x.dataset.tab === savedTab);
                        const content = document.getElementById(savedTab);
                        if (btn && content) {
                            btn.classList.add('active');
                            content.classList.add('active');
                        }
                    }

                    tabButtons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            tabButtons.forEach(b => b.classList.remove('active'));
                            tabContents.forEach(c => c.classList.remove('active'));
                            btn.classList.add('active');
                            document.getElementById(btn.dataset.tab).classList.add('active');
                            localStorage.setItem('activeTab', btn.dataset.tab);
                        });
                    });

                    /* ---------------------- PAIR PROGRAMMING COLLAPSE ---------------------- */
                    function updatePairProgrammingCollapseState() {
                        if (!pairProgrammingContent) return;
                        if (isPairProgrammingCollapsed) {
                            pairProgrammingContent.classList.add('collapsed');
                            pairToggleIcon.classList.add('collapsed');
                            pairToggleIcon.textContent = '▶';
                        } else {
                            pairProgrammingContent.classList.remove('collapsed');
                            pairToggleIcon.classList.remove('collapsed');
                            pairToggleIcon.textContent = '▼';
                        }
                    }
                    updatePairProgrammingCollapseState();

                    if (pairProgrammingHeader) {
                        pairProgrammingHeader.addEventListener('click', function() {
                            isPairProgrammingCollapsed = !isPairProgrammingCollapsed;
                            localStorage.setItem('pairProgrammingCollapsed', isPairProgrammingCollapsed);
                            updatePairProgrammingCollapseState();
                        });
                    }

                    /* ---------------------- CHAT (agregar, enviar) ---------------------- */
                    async function agregarMensaje(texto, tipo) {
                        if (!chatMessages) return;
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
                                avatar.style.width = '40px';
                                avatar.style.height = '40px';
                                avatar.style.borderRadius = '50%';
                                
                                const messageContainer = document.createElement('div');
                                messageContainer.className = 'bot-message-container';
                                
                                const botName = document.createElement('div');
                                botName.className = 'bot-name';
                                botName.textContent = 'Leia';
                                
                                const message = document.createElement('div');
                                message.className = 'message bot';
                                message.innerHTML = mensaje.trim();
                                
                                botProfile.appendChild(avatar);
                                messageContainer.appendChild(botName);
                                messageContainer.appendChild(message);
                                
                                botContainer.appendChild(botProfile);
                                botContainer.appendChild(messageContainer);
                                
                                chatMessages.appendChild(botContainer);
                                chatMessages.scrollTop = chatMessages.scrollHeight;
                                
                                await new Promise(resolve => setTimeout(resolve, 250));
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
                        if (!chatMessages) return;
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

                    if (enviarBtn) {
                        enviarBtn.addEventListener('click', enviarMensaje);
                    }

                    /* ---------------------- TASKS (UI <-> extension) ---------------------- */
    /* ---------------------- TASKS (UI <-> extension) ---------------------- */
    function updatePendingTasksList() {
        console.log('[DEBUG] updatePendingTasksList called with tasks:', JSON.stringify(pendingTasks));
        if (!pendingTasksList) return;
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
            
            const taskDesc = document.createElement('span');
            taskDesc.className = 'task-description';
            taskDesc.textContent = task.description;

            const actions = document.createElement('span');
            actions.className = 'task-actions';

            // Botón editar
            const editBtn = document.createElement('button');
            editBtn.textContent = '✎';
            
            editBtn.onclick = (function(taskId, taskDesc) {
                return function() {
                    console.log('🖱️ Click en botón editar, taskId:', taskId);
                    
                    const modal = document.getElementById('editModal');
                    const input = document.getElementById('editTaskInput');
                    const saveBtn = document.getElementById('editSaveBtn');
                    const cancelBtn = document.getElementById('editCancelBtn');
                    
                    input.value = taskDesc;
                    modal.classList.remove('hidden');
                    input.focus();

                    // limpiar handlers previos
                    saveBtn.onclick = cancelBtn.onclick = null;

                    cancelBtn.onclick = () => modal.classList.add('hidden');
                    
                    saveBtn.onclick = () => {
                        const nuevo = input.value.trim();
                        if (nuevo) {
                            vscode.postMessage({
                                type: 'PP_COMANDO',
                                comando: 'EDITAR_TAREA',
                                params: { taskId, descripcion: nuevo }
                            });
                        }
                        modal.classList.add('hidden');
                    };
                };
            })(task.id, task.description);

            // Botón eliminar - SIN CONFIRM
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑';
            deleteBtn.onclick = (function(taskId) {
                return function() {
                    console.log('🖱️ Click en botón eliminar, taskId:', taskId);
                    console.log('✅ Enviando ELIMINAR_TAREA');
                    vscode.postMessage({
                        type: 'PP_COMANDO',
                        comando: 'ELIMINAR_TAREA',
                        params: { taskId: taskId }
                    });
                };
            })(task.id);

            // Botón completar
            const completeBtn = document.createElement('button');
            completeBtn.textContent = '✓';
            completeBtn.onclick = (function(taskId) {
                return function() {
                    console.log('🖱️ Click en botón completar, taskId:', taskId);
                    vscode.postMessage({
                        type: 'PP_COMANDO',
                        comando: 'COMPLETAR_TAREA',
                        params: { taskId: taskId }
                    });
                };
            })(task.id);

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            actions.appendChild(completeBtn);

            taskItem.appendChild(taskDesc);
            taskItem.appendChild(actions);
            pendingTasksList.appendChild(taskItem);
        }
        console.log('[DEBUG] Generated HTML for tasks:', pendingTasksList.innerHTML);
    }

    function addTask() {
        const description = newTaskInput.value.trim();
        if (!description) return;
        vscode.postMessage({
            type: 'PP_COMANDO',
            comando: 'AGREGAR_TAREA',
            params: { descripcion: description }
        });
        newTaskInput.value = '';
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
        newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
            }
        });
    }

    function completeTask(taskId) {
        vscode.postMessage({
            type: 'PP_COMANDO',
            comando: 'COMPLETAR_TAREA',
            params: { taskId }
        });
    }

    function deleteTask(taskId) {
        vscode.postMessage({
            type: 'PP_COMANDO',
            comando: 'ELIMINAR_TAREA',
            params: { taskId }
        });
    }

    /* ---------------------- SESSION (PP) ---------------------- */
    function updateTimerDisplay(timeRemaining) {
        if (!timerDisplay) return;
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();
        const secondsStr = seconds < 10 ? '0' + seconds : seconds.toString();
        timerDisplay.textContent = minutesStr + ':' + secondsStr;
    }

    function startUITimer(duration) {
        clearInterval(timerInterval);
        const endTime = Date.now() + duration;
        updateTimerDisplay(duration);
        timerInterval = setInterval(() => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                clearInterval(timerInterval);
                updateTimerDisplay(0);
                return;
            }
            updateTimerDisplay(remaining);
        }, 1000);
    }

    function startSession() {
        const navEmail = (navigatorEmailInputMain && navigatorEmailInputMain.value || '').trim();
        if (!navEmail) {
            const error = document.createElement('div');
            error.className = 'error';
            error.textContent = 'Por favor, ingresa el correo del navegante.';
            startSessionForm.appendChild(error);
            setTimeout(function() {
                if (error.parentNode) error.parentNode.removeChild(error);
            }, 3000);
            return;
        }
        vscode.postMessage({
            type: 'PP_COMANDO',
            comando: 'INICIAR_SESION',
            params: { navigatorEmail: navEmail }
        });
    }

    if (startSessionBtn) startSessionBtn.addEventListener('click', startSession);

    function updateSessionUI(sessionData) {
        console.log('[DEBUG] Entering updateSessionUI. Current pendingTasks:', JSON.stringify(pendingTasks));
        if (sessionData && sessionData.sessionActive) {
            if (sessionStatus) sessionStatus.classList.remove('hidden');
            if (document.getElementById('startSessionForm')) document.getElementById('startSessionForm').style.display = 'none';
            if (pairProgrammingGuide) pairProgrammingGuide.classList.remove('hidden');

            driverEmail.textContent = sessionData.driver || 'No asignado';
            navigatorEmail.textContent = sessionData.navigator || 'No asignado';

            if (typeof sessionData.turnStartTime === 'number' || sessionData.turnStartTime) {
                const elapsed = Date.now() - sessionData.turnStartTime;
                const remaining = sessionData.timeRemaining - elapsed;
                startUITimer(Math.max(0, remaining));
            } else if (typeof sessionData.timeRemaining === 'number') {
                startUITimer(sessionData.timeRemaining);
            }


            // Actualizar siempre las tareas desde los datos de la sesión
            pendingTasks = sessionData.pendingTasks || [];
            updatePendingTasksList();

        } else {
            if (sessionStatus) sessionStatus.classList.add('hidden');
            if (document.getElementById('startSessionForm')) document.getElementById('startSessionForm').style.display = 'block';
            if (pairProgrammingGuide) pairProgrammingGuide.classList.add('hidden');

            clearInterval(timerInterval);
            pendingTasks = [];
            updatePendingTasksList();
        }
        console.log('[DEBUG] Exiting updateSessionUI. Final pendingTasks:', JSON.stringify(pendingTasks));
    }
        const btnCambiarRol = document.getElementById('btnCambiarRol');
    if (btnCambiarRol) {
        btnCambiarRol.addEventListener('click', () => {
            vscode.postMessage({
                type: "PP_COMANDO",
                comando: "CAMBIAR_ROLES"
            });
            // Ocultar modal
            document.getElementById("roleModal").style.display = "none";
        });
    }

    function requestSessionStatus() {
        vscode.postMessage({ type: 'PP_COMANDO', comando: 'OBTENER_ESTADO' });
    }

    /* ---------------------- MENSAJES DEL HOST ---------------------- */
    // ============================================================
window.addEventListener('message', event => {
    const message = event.data;
    console.log('📩 Mensaje recibido:', message.type); // Debug temporal
    
    switch (message.type) {
        case 'restoreSession':
            console.log('[DEBUG] Received restoreSession event. Data:', message);
            if (message.sessionState && message.sessionState.driver) {
                // 1. Marcar como autenticado
                isAuthenticated = true;
                vscode.setState({ isAuthenticated: true });

                // 2. Mostrar la pantalla de la aplicación
                if (loginScreen) loginScreen.style.display = 'none';
                if (appScreen) appScreen.style.display = 'flex';
                
                // 3. Actualizar el email del usuario
                if (userEmailDisplay) {
                    userEmailDisplay.textContent = message.sessionState.driver;
                }

                // 4. Restaurar el estado de la sesión de Pair Programming
                updateSessionUI(message.sessionState);

                // 5. Restaurar el historial de chat
                if (message.chatHistory && Array.isArray(message.chatHistory)) {
                    // Limpiar chat actual antes de restaurar
                    const welcomeMessage = chatMessages.querySelector('.welcome-container');
                    chatMessages.innerHTML = '';
                    if (welcomeMessage) chatMessages.appendChild(welcomeMessage);
                    
                    message.chatHistory.forEach(msg => {
                        agregarMensaje(msg.text, msg.from);
                    });
                }
            }
            break;

        case 'RESTORE_CHAT':
            if (message.mensajes && Array.isArray(message.mensajes)) {
                message.mensajes.forEach(msg => {
                    agregarMensaje(msg.text, msg.from);
                });
            }
            break;

        case 'AUTH_SUCCESS':
            console.log('✅ AUTH_SUCCESS recibido');
            
            isAuthenticated = true;
            vscode.setState({ isAuthenticated: true });
            
            // Deshabilitar el input del piloto
            if (studentEmailInput) studentEmailInput.disabled = true;
            
            // Ocultar el botón "Siguiente"
            if (nextBtn) nextBtn.style.display = 'none';
            
            // Mostrar el campo del navegante
            if (navigatorField) {
                navigatorField.classList.remove('hidden');
                const navInput = document.getElementById('navigatorEmailInput');
                if (navInput) navInput.focus();
            }
            
            // ✅ RESETEAR BOTONES
            resetLoginButtons();
            
            // Limpiar mensajes de error
            if (loginError) { 
                loginError.textContent = ''; 
                loginError.style.display = 'none'; 
            }
            
            console.log('✅ Campo de navegante mostrado');
            break;

        case 'LOGOUT_SUCCESS':
            resetUI();
            break;

        case 'BOT_RESPONSE':
            agregarMensaje(message.mensaje, 'bot');
            saveState(); // ✅ guardar historial del chat
            break;

        case 'ERROR':
            console.error('❌ ERROR recibido:', message.mensaje);
            
            if (!isAuthenticated) {
                // Error durante el login
                showLoginError(message.mensaje || 'Error al autenticar');
                
                // ✅ RESETEAR BOTONES
                resetLoginButtons();
            } else {
                // Error durante operaciones normales
                mostrarError(message.mensaje);
            }
            break;

        case 'PP_RESULTADO':
            console.log('✅ PP_RESULTADO recibido:', message.comando);
            
            switch (message.comando) {
                case 'INICIAR_SESION':
                    console.log('✅ Procesando INICIAR_SESION resultado');
                    
                    try {
                        // 1. Marcar como autenticado
                        isAuthenticated = true;
                        
                        // 2. Ocultar pantalla de login
                        if (loginScreen) {
                            loginScreen.style.display = 'none';
                        }
                        
                        // 3. Mostrar pantalla de la aplicación
                        if (appScreen) {
                            appScreen.style.display = 'flex';
                        }
                        
                        // 4. Mostrar el email del driver
                        if (userEmailDisplay) {
                            userEmailDisplay.textContent = message.resultado && message.resultado.driver
                                ? message.resultado.driver
                                : (studentEmailInput && studentEmailInput.value) || '';
                        }
                        
                        console.log('✅ Pantallas cambiadas correctamente');
                    } catch (e) {
                        console.error('❌ Error al cambiar pantallas:', e);
                    }
                    
                    // 5. Actualizar la UI de la sesión
                    updateSessionUI(message.resultado || {});
                    
                    // ✅ RESETEAR BOTONES
                    resetLoginButtons();
                    
                    console.log('✅ INICIAR_SESION completado');
                    break;

                case 'CAMBIAR_ROLES':
                    if (message.resultado) {
                        updateSessionUI(message.resultado);
                        pendingTasks = message.resultado.pendingTasks || pendingTasks;
                        updatePendingTasksList();
                        const roleModal = document.getElementById('roleModal');
                        if (roleModal) roleModal.style.display = 'none';
                    }
                    break;

                case 'OBTENER_ESTADO':
                    updateSessionUI(message.resultado || {});
                    pendingTasks = message.resultado.pendingTasks || pendingTasks;
                    updatePendingTasksList();
                    break;

                case 'FINALIZAR_SESION':
                    updateSessionUI({ sessionActive: false });
                    break;

                case 'AGREGAR_TAREA':
                    pendingTasks = message.resultado || [];
                    updatePendingTasksList();
                    break;

                case 'COMPLETAR_TAREA':
                    pendingTasks = message.resultado.pendingTasks || [];
                    updatePendingTasksList();
                    break;

                case 'EDITAR_TAREA':
                    pendingTasks = message.resultado.pendingTasks || [];
                    updatePendingTasksList();
                    break;

                case 'ELIMINAR_TAREA':
                    pendingTasks = message.resultado.pendingTasks || [];
                    updatePendingTasksList();
                    break;
            }
            break;

        case 'PP_ERROR':
            console.error('❌ PP_ERROR recibido:', message);
            
            if (message.comando === 'INICIAR_SESION') {
                // Error al iniciar sesión de pair programming
                showLoginError(message.mensaje || 'Error al iniciar sesión de pair programming');
                
                // ✅ RESETEAR BOTONES
                resetLoginButtons();
            } else {
                // Otros errores de pair programming
                mostrarError(message.mensaje);
            }
            break;

        case 'TIMER_ENDED':
            const roleModal = document.getElementById('roleModal');
            if (roleModal) roleModal.style.display = 'flex';
            break;

        case 'TIMER_WARNING':
            if (typeof message.timeRemaining === 'number') {
                updateTimerDisplay(message.timeRemaining);
            }
            break;
    }
});
                    /* ---------------------- Inicialización ---------------------- */
                    // Solicitar estado inicial al cargar la webview
                    document.addEventListener('DOMContentLoaded', () => {
                        vscode.postMessage({ type: 'webviewLoaded' });
                    });

                })();
            </script>
        </body>
        </html>`;
    }

    module.exports = { getWebviewContent };