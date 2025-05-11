/**
 * Servicio para gestionar la recopilación y envío de datos de Learning Analytics
 */

const vscode = require('vscode');
const { info, error, debug } = require('../utils/logger');
const { classifyQuery, EventTypes } = require('../models/analyticsModel');

// URL del servicio de analytics (reemplazar con la URL real cuando esté disponible)
const ANALYTICS_API_URL = 'http://37.27.189.148:80/api/analytics';

// Almacenamiento local para eventos pendientes de envío
let pendingEvents = [];

// Intervalo de sincronización (en ms) - 5 minutos por defecto
const SYNC_INTERVAL = 5 * 60 * 1000; 

// Timer para sincronización periódica
let syncTimer = null;

/**
 * Inicializa el servicio de analytics
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function initAnalytics(context) {
    debug('Inicializando servicio de Learning Analytics');
    
    // Cargar eventos pendientes almacenados previamente
    const storedEvents = context.globalState.get('analytics-pending-events');
    if (storedEvents && Array.isArray(storedEvents)) {
        pendingEvents = storedEvents;
        debug(`Cargados ${pendingEvents.length} eventos pendientes de envío`);
    }
    
    // Iniciar sincronización periódica
    startSyncTimer(context);
    
    // Registrar evento de sesión cuando se cierre VS Code
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(() => {
            syncEvents(context).catch(err => 
                error(`Error al sincronizar eventos: ${err.message}`)
            );
        })
    );
}

/**
 * Inicia el temporizador para sincronización periódica
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function startSyncTimer(context) {
    if (syncTimer) {
        clearInterval(syncTimer);
    }
    
    syncTimer = setInterval(() => {
        syncEvents(context).catch(err => 
            error(`Error al sincronizar eventos: ${err.message}`)
        );
    }, SYNC_INTERVAL);
    
    debug(`Sincronización de analytics configurada cada ${SYNC_INTERVAL / 1000} segundos`);
}

/**
 * Registra un evento de usuario
 * @param {string} eventType - Tipo de evento
 * @param {Object} eventData - Datos del evento
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function trackEvent(eventType, eventData, context) {
    try {
        const authenticatedEmail = context.globalState.get('authenticatedEmail');
        
        // Crear objeto de evento
        const event = {
            event_type: eventType,
            timestamp: new Date().toISOString(),
            user_email: authenticatedEmail || 'anonymous',
            session_id: context.globalState.get('current-session-id') || generateSessionId(),
            platform_info: {
                vscode_version: vscode.version,
                extension_version: vscode.extensions.getExtension('your-extension-id')?.packageJSON.version || 'unknown',
                os: process.platform
            },
            data: eventData
        };
        
        // Agregar a la cola de eventos pendientes
        pendingEvents.push(event);
        
        // Guardar en el estado global
        await context.globalState.update('analytics-pending-events', pendingEvents);
        
        debug(`Evento registrado: ${eventType}`);
        
        // Intentar sincronizar si hay suficientes eventos o si es un evento importante
        if (pendingEvents.length >= 10 || isImportantEvent(eventType)) {
            syncEvents(context);
        }
    } catch (err) {
        error(`Error al registrar evento de analytics: ${err.message}`);
    }
}

/**
 * Determina si un tipo de evento es importante y debería sincronizarse inmediatamente
 * @param {string} eventType - Tipo de evento
 * @returns {boolean} - true si el evento es importante
 */
function isImportantEvent(eventType) {
    const importantEvents = [
        'USER_LOGIN', 
        'USER_LOGOUT', 
        'PAIR_SESSION_START', 
        'PAIR_SESSION_END'
    ];
    
    return importantEvents.includes(eventType);
}

/**
 * Genera un ID de sesión único
 * @returns {string} - ID de sesión
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Sincroniza eventos pendientes con el servidor
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function syncEvents(context) {
    if (pendingEvents.length === 0) {
        debug('No hay eventos pendientes para sincronizar');
        return;
    }
    
    debug(`Intentando sincronizar ${pendingEvents.length} eventos`);
    
    try {
        // Copia de eventos a enviar
        const eventsToSync = [...pendingEvents];
        
        const response = await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 
//                'X-API-Key': 'Lupillo07!'  // Añade esta línea
            },
            body: JSON.stringify({ events: eventsToSync })
        });
        
        if (response.ok) {
            // Remover eventos sincronizados exitosamente
            pendingEvents = pendingEvents.slice(eventsToSync.length);
            await context.globalState.update('analytics-pending-events', pendingEvents);
            info(`Sincronizados ${eventsToSync.length} eventos correctamente`);
        } else {
            const errorData = await response.text();
            throw new Error(`Error ${response.status}: ${errorData}`);
        }
    } catch (err) {
        error(`Error al sincronizar eventos: ${err.message}`);
        // Los eventos permanecerán en la cola para intentar sincronizarlos después
    }
}

/**
 * Registra el inicio de una nueva sesión de usuario
 * @param {string} userEmail - Email del usuario
 * @param {vscode.ExtensionContext} context - Contexto de la extensión 
 */
function trackSessionStart(userEmail, context) {
    const sessionId = generateSessionId();
    context.globalState.update('current-session-id', sessionId);
    
    trackEvent('SESSION_START', {
        user_email: userEmail,
        session_id: sessionId
    }, context);
    
    return sessionId;
}

/**
 * Registra el fin de una sesión de usuario
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function trackSessionEnd(context) {
    const sessionId = context.globalState.get('current-session-id');
    if (!sessionId) return;
    
    trackEvent('SESSION_END', {
        session_id: sessionId,
        duration_ms: Date.now() - new Date(sessionId.split('_')[1]).getTime()
    }, context);
    
    // Limpiar ID de sesión actual
    context.globalState.update('current-session-id', undefined);
}

/**
 * Registra interacciones de chat
 * @param {string} messageType - Tipo de mensaje (user_query, bot_response)
 * @param {string} messageContent - Contenido del mensaje
 * @param {boolean} includedCode - Si se incluyó código en el mensaje
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function trackChatInteraction(messageType, messageContent, includedCode, context) {
    const eventData = {
        message_type: messageType,
        message_length: messageContent.length,
        included_code: includedCode || false,
        timestamp: new Date().toISOString()
    };
    
    // Si es una consulta del usuario, clasificarla
    if (messageType === 'user_query') {
        eventData.query_category = classifyQuery(messageContent);
    }
    
   // Log para depuración
   debug(`Registrando interacción de chat: ${messageType}`);
    
   // Track usando el tipo de evento CHAT_INTERACTION
   trackEvent('CHAT_INTERACTION', eventData, context);
   
   // Forzar sincronización para interacciones de chat
   syncEvents(context).catch(err => 
       error(`Error al sincronizar después de interacción de chat: ${err.message}`)
   );
}

/**
 * Registra eventos de sesiones de pair programming
 * @param {string} eventType - Tipo de evento de pair programming
 * @param {Object} sessionData - Datos de la sesión
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function trackPairProgrammingEvent(eventType, sessionData, context) {
    trackEvent(`PAIR_${eventType}`, sessionData, context);
}

/**
 * Registra eventos de tareas de pair programming
 * @param {string} eventType - Tipo de evento (ADD, COMPLETE)
 * @param {Object} taskData - Datos de la tarea
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function trackTaskEvent(eventType, taskData, context) {
    trackEvent(`TASK_${eventType}`, taskData, context);
}

/**
 * Finaliza el servicio de analytics y sincroniza eventos pendientes
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function finalizeAnalytics(context) {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
    
    // Intentar sincronizar eventos pendientes
    await syncEvents(context).catch(err => 
        error(`Error al sincronizar eventos finales: ${err.message}`)
    );
    
    debug('Servicio de analytics finalizado');
}

module.exports = {
    initAnalytics,
    trackEvent,
    trackSessionStart,
    trackSessionEnd,
    trackChatInteraction,
    trackPairProgrammingEvent,
    trackTaskEvent,
    finalizeAnalytics
};