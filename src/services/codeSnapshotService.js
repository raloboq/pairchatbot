// 1. Agregar un nuevo servicio para la captura periódica de código
// src/services/codeSnapshotService.js

const vscode = require('vscode');
const { trackEvent } = require('./analyticsService');
const { info, error } = require('../utils/logger');

let snapshotInterval = null;
const DEFAULT_INTERVAL = 5 * 60 * 1000; // 5 minutos por defecto

/**
 * Inicia el servicio de captura periódica de código
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 * @param {number} intervalMs - Intervalo en milisegundos (opcional)
 */
function startCodeSnapshotService(context, intervalMs = DEFAULT_INTERVAL) {
    // Detener el intervalo existente si hay alguno
    stopCodeSnapshotService();
    
    // Configurar el nuevo intervalo
    snapshotInterval = setInterval(() => {
        captureCodeSnapshot(context);
    }, intervalMs);
    
    info(`Servicio de captura de código iniciado con intervalo de ${intervalMs / 1000} segundos`);
}

/**
 * Detiene el servicio de captura periódica de código
 */
function stopCodeSnapshotService() {
    if (snapshotInterval) {
        clearInterval(snapshotInterval);
        snapshotInterval = null;
        info('Servicio de captura de código detenido');
    }
}

/**
 * Captura y guarda una instantánea del código actual
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function captureCodeSnapshot(context) {
    try {
        // Verificar si hay un editor activo
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No hay editor activo, no hacer nada
        }
        
        // Verificar si hay una sesión de usuario activa
        const authenticatedEmail = context.globalState.get('authenticatedEmail');
        if (!authenticatedEmail) {
            return; // Usuario no autenticado, no hacer nada
        }
        
        // Obtener información del documento actual
        const document = editor.document;
        const fileName = document.fileName;
        const languageId = document.languageId;
        const codeContent = document.getText();
        
        // Si el archivo no tiene contenido, no guardar la instantánea
        if (!codeContent || codeContent.trim() === '') {
            return;
        }
        
        // Información sobre el proyecto/workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let workspaceInfo = null;
        
        if (workspaceFolders && workspaceFolders.length > 0) {
            const activeWorkspace = workspaceFolders[0];
            workspaceInfo = {
                name: activeWorkspace.name,
                uri: activeWorkspace.uri.toString()
            };
        }
        
        // Calcular algunas métricas básicas sobre el código
        const lineCount = document.lineCount;
        const charCount = codeContent.length;
        
        // Crear metadatos sobre la instantánea
        const snapshotMetadata = {
            file_name: fileName.split('/').pop(), // Solo el nombre del archivo, no la ruta completa
            language: languageId,
            file_path: fileName,
            workspace: workspaceInfo,
            metrics: {
                line_count: lineCount,
                char_count: charCount,
                timestamp: new Date().toISOString()
            },
            // Información sobre la sesión de pair programming, si está activa
            pair_session: context.globalState.get('pairSessionActive') ? {
                driver: context.globalState.get('pairSessionDriver'),
                navigator: context.globalState.get('pairSessionNavigator')
            } : null
        };
        
        // Registrar evento con contenido del código
        trackEvent('CODE_SNAPSHOT', {
            metadata: snapshotMetadata,
            code_content: codeContent
        }, context);
        
        info(`Instantánea de código capturada: ${fileName.split('/').pop()}, ${lineCount} líneas`);
        
    } catch (err) {
        error(`Error al capturar instantánea de código: ${err.message}`);
    }
}

/**
 * Actualiza el intervalo de captura de código
 * @param {number} intervalMs - Nuevo intervalo en milisegundos
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function updateSnapshotInterval(intervalMs, context) {
    // Guardar la preferencia del usuario
    context.globalState.update('codeSnapshotInterval', intervalMs);
    
    // Reiniciar el servicio con el nuevo intervalo
    startCodeSnapshotService(context, intervalMs);
}

/**
 * Captura manual de una instantánea de código (puede ser invocada por un comando)
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function captureManualSnapshot(context) {
    captureCodeSnapshot(context);
}

module.exports = {
    startCodeSnapshotService,
    stopCodeSnapshotService,
    updateSnapshotInterval,
    captureManualSnapshot
};