/*const vscode = require('vscode');
const { SidebarProvider } = require('./src/ui/sidebarProvider');
const { registerPairCommands } = require('./src/commands/pairCommands');
const { registerAnalyticsCommands } = require('./src/commands/analyticsCommands');
const { initAnalytics, finalizeAnalytics, trackEvent } = require('./src/services/analyticsService');
const { info } = require('./src/utils/logger');


function activate(context) {
    info('Activando extensión Leia - Programming Assistant con Pair Programming');

    // Inicializar el servicio de analytics
    initAnalytics(context);
    
    // Registrar evento de activación
    trackEvent('EXTENSION_ACTIVATED', {
        activation_time: new Date().toISOString(),
        workspace_type: vscode.workspace.workspaceFolders ? 
            (vscode.workspace.workspaceFolders.length > 1 ? 'multi-root' : 'single-root') : 
            'no-workspace'
    }, context);

    // Inicializar el proveedor de la barra lateral
    const provider = new SidebarProvider(context.extensionUri, context.globalState, context);
    
    // Registrar el proveedor de webview
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("pairchatbot.sidebarView", provider)
    );
    
    // Registrar comandos
    registerPairCommands(context, provider);
    
    // Registrar comandos de analytics
    registerAnalyticsCommands(context);
    
    // Registrar eventos de telemetría
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(() => {
            trackEvent('DOCUMENT_CHANGED', {
                language: vscode.window.activeTextEditor?.document.languageId || 'unknown'
            }, context);
        })
    );
}


async function deactivate(context) {
    // Finalizar servicio de analytics y sincronizar datos pendientes
    if (context) {
        trackEvent('EXTENSION_DEACTIVATED', {
            deactivation_time: new Date().toISOString()
        }, context);
        
        await finalizeAnalytics(context);
    }
}

module.exports = {
    activate,
    deactivate
};*/
// Modificaciones en extension.js para integrar el servicio de captura de código

const vscode = require('vscode');
const { SidebarProvider } = require('./src/ui/sidebarProvider');
const { registerPairCommands } = require('./src/commands/pairCommands');
const { registerAnalyticsCommands } = require('./src/commands/analyticsCommands');
const { initAnalytics, finalizeAnalytics, trackEvent } = require('./src/services/analyticsService');
const { startCodeSnapshotService, stopCodeSnapshotService, captureManualSnapshot } = require('./src/services/codeSnapshotService');
const { info } = require('./src/utils/logger');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    info('Activando extensión Leia - Programming Assistant con Pair Programming');

    // Inicializar el servicio de analytics
    initAnalytics(context);
    
    // Registrar evento de activación
    trackEvent('EXTENSION_ACTIVATED', {
        activation_time: new Date().toISOString(),
        workspace_type: vscode.workspace.workspaceFolders ? 
            (vscode.workspace.workspaceFolders.length > 1 ? 'multi-root' : 'single-root') : 
            'no-workspace'
    }, context);

    // Inicializar el proveedor de la barra lateral
    const provider = new SidebarProvider(context.extensionUri, context.globalState, context);
    
    // Registrar el proveedor de webview
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("pairchatbot.sidebarView", provider)
    );
    
    // Registrar comandos de pair programming
    registerPairCommands(context, provider);
    
    // Registrar comandos de analytics
    registerAnalyticsCommands(context);
    
    // Registrar eventos de telemetría
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(() => {
            trackEvent('DOCUMENT_CHANGED', {
                language: vscode.window.activeTextEditor?.document.languageId || 'unknown'
            }, context);
        })
    );
    
    // Iniciar el servicio de captura de código
    // Obtener el intervalo guardado, o usar el valor por defecto (5 minutos)
    const savedInterval = context.globalState.get('codeSnapshotInterval', 5 * 60 * 1000);
    startCodeSnapshotService(context, savedInterval);
    
    // Registrar comandos para el servicio de capturas de código
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.captureCodeSnapshot', () => {
            captureManualSnapshot(context);
            vscode.window.showInformationMessage('Instantánea de código capturada correctamente');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.configureSnapshotInterval', async () => {
            const currentInterval = context.globalState.get('codeSnapshotInterval', 5 * 60 * 1000);
            const currentMinutes = currentInterval / (60 * 1000);
            
            const minutesInput = await vscode.window.showInputBox({
                prompt: `Ingresa el intervalo en minutos para las capturas automáticas de código (actual: ${currentMinutes} minutos)`,
                placeHolder: 'Minutos',
                value: String(currentMinutes)
            });
            
            if (minutesInput !== undefined) {
                try {
                    const minutes = parseFloat(minutesInput);
                    if (isNaN(minutes) || minutes <= 0) {
                        throw new Error('Valor inválido');
                    }
                    
                    const milliseconds = minutes * 60 * 1000;
                    await context.globalState.update('codeSnapshotInterval', milliseconds);
                    
                    // Reiniciar el servicio con el nuevo intervalo
                    startCodeSnapshotService(context, milliseconds);
                    
                    vscode.window.showInformationMessage(`Intervalo actualizado a ${minutes} minutos`);
                } catch (err) {
                    vscode.window.showErrorMessage('Por favor, ingresa un número válido mayor que cero');
                }
            }
        })
    );
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function deactivate(context) {
    // Detener el servicio de captura de código
    stopCodeSnapshotService();
    
    // Finalizar servicio de analytics y sincronizar datos pendientes
    if (context) {
        trackEvent('EXTENSION_DEACTIVATED', {
            deactivation_time: new Date().toISOString()
        }, context);
        
        await finalizeAnalytics(context);
    }
}

module.exports = {
    activate,
    deactivate
};