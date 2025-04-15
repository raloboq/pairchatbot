const vscode = require('vscode');
const { generateMarkdownReport } = require('../utils/reportGenerator');

/**
 * Registra los comandos relacionados con el Pair Programming
 * @param {vscode.ExtensionContext} context 
 * @param {import('../ui/sidebarProvider').SidebarProvider} provider 
 */
function registerPairCommands(context, provider) {
    // Comando para iniciar sesión de Pair Programming
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.startPairSession', () => {
            vscode.window.showInformationMessage('Inicia una sesión de Pair Programming desde la barra lateral de Leia');
        })
    );
    
    // Comando para generar reporte de sesión
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.generatePairReport', async () => {
            if (!provider.pairSession.sessionActive) {
                vscode.window.showErrorMessage('No hay una sesión de Pair Programming activa para generar un reporte');
                return;
            }
            
            const report = provider.pairSession.generateSessionSummary();
            
            // Crear un documento markdown con el resumen
            const document = await vscode.workspace.openTextDocument({
                content: generateMarkdownReport(report, provider.pairSession),
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document);
        })
    );
}

module.exports = { registerPairCommands };