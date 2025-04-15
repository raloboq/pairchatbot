const vscode = require('vscode');
const { SidebarProvider } = require('./src/ui/sidebarProvider');
const { registerPairCommands } = require('./src/commands/pairCommands');
const { registerAnalyticsCommands } = require('./src/commands/analyticsCommands');
const { initAnalytics, finalizeAnalytics, trackEvent } = require('./src/services/analyticsService');
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

/**
 * @param {vscode.ExtensionContext} context
 */
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
};