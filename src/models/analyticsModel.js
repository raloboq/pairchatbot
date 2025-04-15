/**
 * Modelo para estructurar los datos de analytics
 * Define las estructuras de datos y categorías para el análisis
 */

/**
 * Estructura para eventos de usuario
 * @typedef {Object} UserEvent
 * @property {string} user_id - ID del usuario
 * @property {string} event_type - Tipo de evento
 * @property {Date} timestamp - Momento del evento
 * @property {Object} data - Datos específicos del evento
 */

/**
 * Estructura para análisis de código
 * @typedef {Object} CodeAnalysis
 * @property {string} language - Lenguaje de programación
 * @property {number} char_count - Número de caracteres
 * @property {number} line_count - Número de líneas
 * @property {number} empty_lines - Líneas vacías
 * @property {Object} metrics - Métricas específicas por lenguaje
 * @property {Array} issues - Problemas detectados
 */

/**
 * Estructura para sesiones de pair programming
 * @typedef {Object} PairProgrammingSession
 * @property {string} driver_email - Email del piloto
 * @property {string} navigator_email - Email del navegante
 * @property {Date} start_time - Tiempo de inicio
 * @property {Date} end_time - Tiempo de finalización
 * @property {number} duration_ms - Duración en milisegundos
 * @property {number} switch_count - Número de cambios de rol
 * @property {Array} tasks - Tareas en la sesión
 */

/**
 * Estructura para interacciones de chat
 * @typedef {Object} ChatInteraction
 * @property {string} user_id - ID del usuario
 * @property {string} message_type - Tipo de mensaje (user_query, bot_response)
 * @property {string} content - Contenido del mensaje
 * @property {boolean} included_code - Si incluyó código
 * @property {Date} timestamp - Momento de la interacción
 */

/**
 * Tipos de eventos para el tracking
 */
const EventTypes = {
    // Eventos de usuario
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    USER_LOGIN_ATTEMPT: 'USER_LOGIN_ATTEMPT',
    
    // Eventos de sesión
    SESSION_START: 'SESSION_START',
    SESSION_END: 'SESSION_END',
    
    // Eventos de chat
    CHAT_INTERACTION: 'CHAT_INTERACTION',
    
    // Eventos de pair programming
    PAIR_SESSION_START: 'PAIR_SESSION_START',
    PAIR_SESSION_END: 'PAIR_SESSION_END',
    PAIR_ROLE_SWITCH: 'PAIR_ROLE_SWITCH',
    
    // Eventos de tareas
    TASK_CREATE: 'TASK_CREATE',
    TASK_COMPLETE: 'TASK_COMPLETE',
    
    // Eventos de código
    CODE_ANALYSIS: 'CODE_ANALYSIS',
    CODE_METRICS: 'CODE_METRICS',
    CODE_ISSUES_DETECTED: 'CODE_ISSUES_DETECTED',
    
    // Eventos de API
    API_REQUEST: 'API_REQUEST',
    API_RESPONSE: 'API_RESPONSE',
    API_ERROR: 'API_ERROR',
    API_RESPONSE_TIME: 'API_RESPONSE_TIME',
    
    // Eventos de extensión
    EXTENSION_ACTIVATED: 'EXTENSION_ACTIVATED',
    EXTENSION_DEACTIVATED: 'EXTENSION_DEACTIVATED',
    
    // Eventos de interfaz
    SIDEBAR_VIEW: 'SIDEBAR_VIEW',
    PAIR_SESSION_STATUS_CHECK: 'PAIR_SESSION_STATUS_CHECK',
    DOCUMENT_CHANGED: 'DOCUMENT_CHANGED'
};

/**
 * Categorías para consultas de usuario
 * Permite clasificar los tipos de preguntas que hacen los estudiantes
 */
const QueryCategories = {
    CONCEPT_EXPLANATION: 'CONCEPT_EXPLANATION', // Explicación de conceptos
    CODE_DEBUGGING: 'CODE_DEBUGGING',           // Ayuda con depuración
    CODE_REVIEW: 'CODE_REVIEW',                 // Revisión de código
    BEST_PRACTICES: 'BEST_PRACTICES',           // Mejores prácticas
    ALGORITHM_HELP: 'ALGORITHM_HELP',           // Ayuda con algoritmos
    LIBRARY_USAGE: 'LIBRARY_USAGE',             // Uso de librerías/frameworks
    SYNTAX_HELP: 'SYNTAX_HELP',                 // Ayuda con sintaxis
    PROJECT_PLANNING: 'PROJECT_PLANNING',       // Planificación de proyectos
    GENERAL_QUESTION: 'GENERAL_QUESTION'        // Preguntas generales
};

/**
 * Clasificador básico de consultas basado en palabras clave
 * @param {string} query - Consulta del usuario
 * @returns {string} - Categoría de la consulta
 */
function classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // Objeto con categorías y sus palabras clave asociadas
    const categoryKeywords = {
        [QueryCategories.CONCEPT_EXPLANATION]: ['qué es', 'explica', 'definición', 'concepto', 'cómo funciona', 'qué significa'],
        [QueryCategories.CODE_DEBUGGING]: ['error', 'debug', 'fallo', 'excepción', 'no funciona', 'corregir', 'solucionar'],
        [QueryCategories.CODE_REVIEW]: ['revisar', 'review', 'mejorar', 'optimizar', 'refactorizar'],
        [QueryCategories.BEST_PRACTICES]: ['mejor manera', 'buenas prácticas', 'recomendación', 'estándar'],
        [QueryCategories.ALGORITHM_HELP]: ['algoritmo', 'eficiencia', 'complejidad', 'ordenar', 'buscar'],
        [QueryCategories.LIBRARY_USAGE]: ['librería', 'framework', 'biblioteca', 'npm', 'package', 'módulo'],
        [QueryCategories.SYNTAX_HELP]: ['sintaxis', 'escribir', 'declarar', 'definir', 'uso correcto'],
        [QueryCategories.PROJECT_PLANNING]: ['planificar', 'estructura', 'diseño', 'arquitectura', 'organizar']
    };
    
    // Buscar coincidencias de palabras clave
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (lowerQuery.includes(keyword)) {
                return category;
            }
        }
    }
    
    // Por defecto, si no hay coincidencias
    return QueryCategories.GENERAL_QUESTION;
}

/**
 * Prepara datos de analytics para exportación o visualización
 * @param {Array} events - Eventos de analytics
 * @returns {Object} - Datos estructurados para análisis
 */
function prepareAnalyticsData(events) {
    // Filtrar eventos por tipo
    const userEvents = events.filter(e => 
        e.event_type === EventTypes.USER_LOGIN || 
        e.event_type === EventTypes.USER_LOGOUT);
    
    const chatEvents = events.filter(e => 
        e.event_type === EventTypes.CHAT_INTERACTION);
    
    const pairEvents = events.filter(e => 
        e.event_type.startsWith('PAIR_'));
    
    const codeEvents = events.filter(e => 
        e.event_type.startsWith('CODE_'));
    
    // Agrupar eventos por usuario
    const eventsByUser = {};
    events.forEach(event => {
        const userId = event.user_email || 'anonymous';
        if (!eventsByUser[userId]) {
            eventsByUser[userId] = [];
        }
        eventsByUser[userId].push(event);
    });
    
    // Estadísticas generales
    const stats = {
        total_events: events.length,
        unique_users: Object.keys(eventsByUser).length,
        chat_interactions: chatEvents.length,
        pair_sessions: pairEvents.filter(e => e.event_type === EventTypes.PAIR_SESSION_START).length,
        code_analyses: codeEvents.filter(e => e.event_type === EventTypes.CODE_ANALYSIS).length
    };
    
    return {
        events_by_type: {
            user: userEvents,
            chat: chatEvents,
            pair: pairEvents,
            code: codeEvents
        },
        events_by_user: eventsByUser,
        stats
    };
}

module.exports = {
    EventTypes,
    QueryCategories,
    classifyQuery,
    prepareAnalyticsData
};