/**
 * Servicio de Analytics para VS Code Extension
 * ⭐ VERSIÓN MEJORADA: Manejo especial para CODE_SNAPSHOT
 */

const vscode = require('vscode');
const axios = require('axios').default;
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Variables globales
let pendingEvents = [];
let isSyncing = false;

/**
 * ⭐ NUEVO: Generar o recuperar ID único de usuario
 */
function getUserId(context) {
    let userId = context.globalState.get('analytics-user-id');
    if (!userId) {
        userId = uuidv4();
        context.globalState.update('analytics-user-id', userId);
    }
    return userId;
}

/**
 * ⭐ NUEVO: Generar o recuperar ID único de dispositivo
 */
function getDeviceId(context) {
    let deviceId = context.globalState.get('analytics-device-id');
    if (!deviceId) {
        deviceId = uuidv4();
        context.globalState.update('analytics-device-id', deviceId);
    }
    return deviceId;
}

/**
 * ⭐ NUEVO: Generar ID único para pair programming session
 */
function generatePairSessionId() {
    return `pair_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

/**
 * ⭐ NUEVO: Generar ID único para conversación
 */
function generateConversationId() {
    return `conv_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

/**
 * ⭐ NUEVO: Obtener información del workspace
 */
function getWorkspaceInfo() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { name: null, foldersCount: 0 };
    }
    
    return {
        name: workspaceFolders[0].name,
        foldersCount: workspaceFolders.length
    };
}

/**
 * ⭐ NUEVO: Obtener el rol actual del usuario (driver o navigator)
 */
function getCurrentRole(context) {
    const pairSessionState = context.globalState.get('pairSessionState');
    
    if (!pairSessionState || !pairSessionState.sessionActive) {
        return null;
    }
    
    const activeUser = pairSessionState.activeUser || pairSessionState.driver;
    
    if (activeUser === pairSessionState.driver) {
        return 'driver';
    } else if (activeUser === pairSessionState.navigator) {
        return 'navigator';
    }
    
    return null;
}

/**
 * ⭐ NUEVO: Obtener información completa de ambos usuarios
 */
function getUsersInfo(context) {
    const pairSessionState = context.globalState.get('pairSessionState');
    
    if (!pairSessionState || !pairSessionState.sessionActive) {
        const authenticatedEmail = context.globalState.get('authenticatedEmail');
        return {
            active_user: authenticatedEmail,
            driver: null,
            navigator: null,
            in_pair_session: false
        };
    }
    
    return {
        active_user: pairSessionState.activeUser || pairSessionState.driver,
        driver: pairSessionState.driver,
        navigator: pairSessionState.navigator,
        in_pair_session: true
    };
}

/**
 * ⭐ MODIFICADO: Función principal para registrar eventos
 * Ahora incluye información de ambos usuarios y manejo especial para CODE_SNAPSHOT
 */
async function trackEvent(eventType, eventData, context) {
    try {
        // ⭐ OBTENER AMBOS USUARIOS de la sesión de pair programming
        const pairSessionState = context.globalState.get('pairSessionState');
        
        let active_user_email = null;
        let driver_email = null;
        let navigator_email = null;
        
        if (pairSessionState && pairSessionState.sessionActive) {
            driver_email = pairSessionState.driver;
            navigator_email = pairSessionState.navigator;
            active_user_email = pairSessionState.activeUser || pairSessionState.driver;
        } else {
            // Si no hay sesión activa, solo hay un usuario autenticado
            active_user_email = context.globalState.get('authenticatedEmail');
        }
        
        const sessionId = context.globalState.get('current-session-id');
        const pairSessionId = context.globalState.get('current-pair-session-id');
        const conversationId = context.globalState.get('current-conversation-id');
        
        // Obtener información del workspace
        const workspaceInfo = getWorkspaceInfo();
        
        // Crear objeto de evento COMPLETO
        const event = {
            // === IDs ÚNICOS ===
            event_id: uuidv4(),
            device_id: getDeviceId(context),
            
            // === USUARIOS - AHORA REGISTRAMOS A AMBOS ===
            active_user_email: active_user_email, // ⭐ Quién hizo la acción
            driver_email: driver_email,           // ⭐ Quién es el driver actual
            navigator_email: navigator_email,     // ⭐ Quién es el navigator actual
            
            // === IDs DE CONTEXTO ===
            event_type: eventType,
            timestamp: new Date().toISOString(),
            session_id: sessionId || null,
            pair_session_id: pairSessionId || null,
            conversation_id: conversationId || null,
            
            // === INFORMACIÓN DE PLATAFORMA ===
            platform_info: {
                vscode_version: vscode.version,
                os: process.platform,
                workspace_name: workspaceInfo.name,
                workspace_folders_count: workspaceInfo.foldersCount,
            },
            
            // === DATOS ESPECÍFICOS DEL EVENTO ===
            data: eventData
        };
        
        // ✅ NUEVO: Manejo especial para CODE_SNAPSHOT
        if (eventType === 'CODE_SNAPSHOT') {
            console.log('[Analytics] 🔍 CODE_SNAPSHOT detectado');
            console.log('   - Tiene code_content:', !!event.data?.code_content);
            console.log('   - Tamaño:', event.data?.code_content?.length || 0, 'caracteres');
            
            // NO agregar a pendingEvents (es muy grande para globalState)
            // Enviarlo inmediatamente
            const success = await syncSingleEvent(event, context);
            
            if (!success) {
                console.error('[Analytics] ❌ Error al enviar CODE_SNAPSHOT, no se reintentará');
            }
            
            return;
        }
        
        // Para otros eventos, agregar a la cola normal
        pendingEvents.push(event);
        
        // Guardar en el estado global (sin CODE_SNAPSHOT que son muy grandes)
        await context.globalState.update('analytics-pending-events', pendingEvents);
        
        console.log(`[Analytics] Evento registrado: ${eventType} por ${active_user_email || 'unknown'}`);
        
        // Intentar sincronizar si hay suficientes eventos o si es un evento importante
        if (pendingEvents.length >= 10 || isImportantEvent(eventType)) {
            syncEvents(context);
        }
    } catch (err) {
        console.error(`[Analytics] Error al registrar evento: ${err.message}`);
    }
}

/**
 * Verificar si un evento es importante (debe sincronizarse inmediatamente)
 */
function isImportantEvent(eventType) {
    const importantEvents = [
        'USER_LOGIN',
        'USER_LOGOUT',
        'PAIR_SESSION_START',
        'PAIR_SESSION_END',
        'PAIR_ROLE_SWITCH'
    ];
    return importantEvents.includes(eventType);
}

/**
 * ✅ NUEVO: Sincronizar un solo evento (para CODE_SNAPSHOT)
 */
async function syncSingleEvent(event, context) {
    try {
        const apiUrl = 'https://ktps.renelobo.com/api/analytics';
        
        console.log(`[Analytics] Enviando ${event.event_type} inmediatamente...`);
        
        // ✅ DEBUG: Guardar evento en archivo temporal
        try {
            const debugPath = path.join(os.tmpdir(), `leia-event-${event.event_id}.json`);
            fs.writeFileSync(debugPath, JSON.stringify(event, null, 2));
            console.log('[Analytics] 🐛 Evento guardado en:', debugPath);
        } catch (debugError) {
            console.log('[Analytics] ⚠️  No se pudo guardar debug file:', debugError.message);
        }
        
        const response = await axios.post(apiUrl, {
            events: [event]  // Array con un solo evento
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000,  // 30 segundos
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        if (response.status === 200) {
            console.log(`[Analytics] ✅ ${event.event_type} enviado exitosamente`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`[Analytics] ❌ Error al enviar evento individual:`, error.message);
        
        if (error.response) {
            console.error('[Analytics] Response status:', error.response.status);
            console.error('[Analytics] Response data:', JSON.stringify(error.response.data).substring(0, 500));
        }
        
        return false;
    }
}

/**
 * ⭐ MODIFICADO: Sincronizar eventos con el servidor
 */
async function syncEvents(context) {
    if (isSyncing || pendingEvents.length === 0) {
        return;
    }
    
    isSyncing = true;
    
    try {
        const apiUrl = 'https://ktps.renelobo.com/api/analytics';
        const eventsToSync = [...pendingEvents];
        
        console.log(`[Analytics] Sincronizando ${eventsToSync.length} eventos...`);
        
        // ✅ DEBUG: Verificar si hay CODE_SNAPSHOT (no debería)
        const hasCodeSnapshot = eventsToSync.some(e => e.event_type === 'CODE_SNAPSHOT');
        if (hasCodeSnapshot) {
            console.log('[Analytics] ⚠️  WARNING: CODE_SNAPSHOT en batch (no debería pasar)');
        }
        
        const response = await axios.post(apiUrl, {
            events: eventsToSync
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000,  // 30 segundos
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        if (response.status === 200) {
            // Limpiar eventos sincronizados
            pendingEvents = [];
            await context.globalState.update('analytics-pending-events', []);
            console.log(`[Analytics] ✅ ${eventsToSync.length} eventos sincronizados`);
        }
    } catch (error) {
        console.error('[Analytics] ❌ Error al sincronizar eventos:', error.message);
        
        // ✅ Log del error completo si es de axios
        if (error.response) {
            console.error('[Analytics] Response status:', error.response.status);
            console.error('[Analytics] Response data:', JSON.stringify(error.response.data).substring(0, 500));
        }
        
        // Si hay demasiados eventos pendientes, eliminar los más antiguos
        if (pendingEvents.length > 1000) {
            pendingEvents = pendingEvents.slice(-500);
            await context.globalState.update('analytics-pending-events', pendingEvents);
            console.log('[Analytics] ⚠️ Eventos antiguos eliminados para evitar overflow');
        }
    } finally {
        isSyncing = false;
    }
}

/**
 * Generar ID único de sesión
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Inicializar analytics cuando se activa la extensión
 */
function initializeAnalytics(context) {
    // Cargar eventos pendientes del estado global
    const savedEvents = context.globalState.get('analytics-pending-events');
    if (savedEvents && Array.isArray(savedEvents)) {
        pendingEvents = savedEvents;
        console.log(`[Analytics] ${pendingEvents.length} eventos pendientes cargados`);
    }
    
    // Sincronizar periódicamente cada 5 minutos
    setInterval(() => {
        syncEvents(context);
    }, 5 * 60 * 1000);
    
    // Sincronizar eventos pendientes al inicio
    if (pendingEvents.length > 0) {
        setTimeout(() => syncEvents(context), 2000);
    }
}

/**
 * ⭐ MODIFICADO: Trackear inicio de sesión
 */
function trackSessionStart(userEmail, context) {
    const sessionId = generateSessionId();
    context.globalState.update('current-session-id', sessionId);
    
    trackEvent('SESSION_START', {
        session_id: sessionId
    }, context);
    
    console.log(`[Analytics] Sesión iniciada: ${sessionId}`);
}

/**
 * Trackear fin de sesión
 */
function trackSessionEnd(context) {
    const sessionId = context.globalState.get('current-session-id');
    
    trackEvent('SESSION_END', {
        session_id: sessionId
    }, context);
    
    context.globalState.update('current-session-id', null);
    console.log(`[Analytics] Sesión finalizada: ${sessionId}`);
}

/**
 * ⭐ MODIFICADO: Trackear interacciones de chat con información completa de usuarios
 */
function trackChatInteraction(messageType, messageContent, includedCode, context, metadata = {}) {
    // Obtener o crear conversation_id
    let conversationId = context.globalState.get('current-conversation-id');
    if (!conversationId) {
        conversationId = generateConversationId();
        context.globalState.update('current-conversation-id', conversationId);
    }
    
    // Obtener contador de mensajes
    const messageOrder = context.globalState.get('conversation-message-count') || 0;
    context.globalState.update('conversation-message-count', messageOrder + 1);
    
    // ⭐ OBTENER INFORMACIÓN COMPLETA DE USUARIOS
    const usersInfo = getUsersInfo(context);
    const pairSessionId = context.globalState.get('current-pair-session-id');
    
    const eventData = {
        // === IDs ===
        message_id: uuidv4(),
        conversation_id: conversationId,
        message_order: messageOrder,
        parent_message_id: metadata.parentMessageId || null,
        
        // === USUARIOS - INFORMACIÓN COMPLETA ===
        author_email: usersInfo.active_user,    // ⭐ Quién escribió el mensaje
        author_role: getCurrentRole(context),    // ⭐ driver o navigator
        driver_email: usersInfo.driver,          // ⭐ Quién es el driver
        navigator_email: usersInfo.navigator,    // ⭐ Quién es el navigator
        
        // === CONTENIDO ===
        message_type: messageType,
        message_content: messageContent,
        message_length: messageContent.length,
        
        // === CÓDIGO ===
        included_code: includedCode || false,
        code_language: metadata.codeLanguage || null,
        code_lines_count: metadata.codeLinesCount || null,
        
        // === TIMING ===
        timestamp: new Date().toISOString(),
        response_time_ms: metadata.responseTimeMs || null,
        
        // === CONTEXTO DE PAIR PROGRAMMING ===
        in_pair_session: usersInfo.in_pair_session,
        pair_session_id: pairSessionId || null,
        
        // === CLASIFICACIÓN ===
        query_category: null
    };
    
    // Si es una consulta del usuario, clasificarla
    if (messageType === 'user_query') {
        eventData.query_category = classifyQuery(messageContent);
    }
    
    console.log(`[Analytics] Chat: ${messageType} por ${usersInfo.active_user} (rol: ${getCurrentRole(context)})`);
    
    trackEvent('CHAT_INTERACTION', eventData, context);
    
    // Forzar sincronización para interacciones de chat
    syncEvents(context).catch(err => 
        console.error(`[Analytics] Error al sincronizar después de chat: ${err.message}`)
    );
    
    // Retornar el message_id para poder usarlo como parent_message_id
    return eventData.message_id;
}

/**
 * Clasificar tipo de consulta del usuario
 */
function classifyQuery(messageContent) {
    const lowerMessage = messageContent.toLowerCase();
    
    if (lowerMessage.includes('error') || lowerMessage.includes('bug') || lowerMessage.includes('problema')) {
        return 'CODE_DEBUGGING';
    } else if (lowerMessage.includes('cómo') || lowerMessage.includes('como') || lowerMessage.includes('explicar')) {
        return 'EXPLANATION_REQUEST';
    } else if (lowerMessage.includes('ejemplo') || lowerMessage.includes('muestra')) {
        return 'CODE_EXAMPLE_REQUEST';
    } else if (lowerMessage.includes('mejor') || lowerMessage.includes('optimizar')) {
        return 'CODE_IMPROVEMENT';
    } else if (lowerMessage.includes('sintaxis') || lowerMessage.includes('usar')) {
        return 'SYNTAX_HELP';
    }
    
    return 'GENERAL_QUERY';
}

/**
 * ⭐ MODIFICADO: Trackear eventos de pair programming
 */
function trackPairProgrammingEvent(eventType, sessionData, context) {
    let pairSessionId = context.globalState.get('current-pair-session-id');
    
    // Si es inicio de sesión, crear nuevo ID
    if (eventType === 'SESSION_START') {
        pairSessionId = generatePairSessionId();
        context.globalState.update('current-pair-session-id', pairSessionId);
        context.globalState.update('pair-session-switches-count', 0);
        context.globalState.update('pair-session-start-time', Date.now());
    }
    
    // Enriquecer datos según el tipo de evento
    const enrichedData = {
        ...sessionData,
        pair_session_id: pairSessionId
    };
    
    if (eventType === 'SESSION_START') {
        enrichedData.expected_duration_minutes = 15;
        enrichedData.workspace_name = getWorkspaceInfo().name;
    }
    
    if (eventType === 'ROLE_SWITCH') {
        const switchesCount = context.globalState.get('pair-session-switches-count') || 0;
        context.globalState.update('pair-session-switches-count', switchesCount + 1);
        
        enrichedData.switch_number = switchesCount + 1;
        enrichedData.time_since_session_start = Date.now() - (context.globalState.get('pair-session-start-time') || Date.now());
        enrichedData.new_driver = sessionData.driver;
        enrichedData.new_navigator = sessionData.navigator;
    }
    
    if (eventType === 'SESSION_END') {
        enrichedData.total_switches = context.globalState.get('pair-session-switches-count') || 0;
        
        // Limpiar IDs de sesión
        context.globalState.update('current-pair-session-id', null);
        context.globalState.update('pair-session-switches-count', 0);
        context.globalState.update('pair-session-start-time', null);
    }
    
    trackEvent(`PAIR_${eventType}`, enrichedData, context);
}

/**
 * Trackear eventos de tareas
 */
function trackTaskEvent(eventType, taskData, context) {
    const pairSessionId = context.globalState.get('current-pair-session-id');
    const currentRole = getCurrentRole(context);
    
    const enrichedData = {
        ...taskData,
        task_id: taskData.task_id || uuidv4(),
        pair_session_id: pairSessionId,
        current_role: currentRole,
        timestamp: new Date().toISOString()
    };
    
    if (eventType === 'CREATE') {
        enrichedData.created_at_timestamp = Date.now();
    }
    
    trackEvent(`TASK_${eventType}`, enrichedData, context);
}

// Exportar funciones
module.exports = {
    initializeAnalytics,
    trackEvent,
    trackSessionStart,
    trackSessionEnd,
    trackChatInteraction,
    trackPairProgrammingEvent,
    trackTaskEvent,
    syncEvents,
    getUsersInfo,
    getCurrentRole,
    generatePairSessionId,
    generateConversationId
};