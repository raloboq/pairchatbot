/**
 * Utilidades de registro para la extensión
 */

const vscode = require('vscode');

// Crear canal de salida para los logs
const outputChannel = vscode.window.createOutputChannel('Leia Assistant');

/**
 * Diferentes niveles de log
 */
const LogLevel = {
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};

/**
 * Registra un mensaje en el canal de salida y en la consola
 * @param {string} message - Mensaje a registrar
 * @param {string} level - Nivel de registro (INFO, WARNING, ERROR, DEBUG)
 */
function log(message, level = LogLevel.INFO) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Registrar en el canal de salida
    outputChannel.appendLine(formattedMessage);
    
    // También registrar en la consola
    switch (level) {
        case LogLevel.ERROR:
            console.error(formattedMessage);
            break;
        case LogLevel.WARNING:
            console.warn(formattedMessage);
            break;
        case LogLevel.DEBUG:
            console.debug(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
    }
}

/**
 * Registra un mensaje de información
 * @param {string} message - Mensaje a registrar
 */
function info(message) {
    log(message, LogLevel.INFO);
}

/**
 * Registra una advertencia
 * @param {string} message - Mensaje a registrar
 */
function warn(message) {
    log(message, LogLevel.WARNING);
}

/**
 * Registra un error
 * @param {string} message - Mensaje a registrar
 */
function error(message) {
    log(message, LogLevel.ERROR);
}

/**
 * Registra un mensaje de depuración
 * @param {string} message - Mensaje a registrar
 */
function debug(message) {
    log(message, LogLevel.DEBUG);
}

/**
 * Muestra el canal de salida de logs
 */
function show() {
    outputChannel.show();
}

module.exports = {
    LogLevel,
    log,
    info,
    warn,
    error,
    debug,
    show
};