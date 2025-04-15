/**
 * Comandos para gestionar la funcionalidad de analytics
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { prepareAnalyticsData } = require('../models/analyticsModel');
const { info, error } = require('../utils/logger');

/**
 * Registra los comandos relacionados con analytics
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
function registerAnalyticsCommands(context) {
    // Comando para exportar datos de analytics
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.exportAnalytics', async () => {
            // Verificar si hay credenciales de administrador
            const isAdmin = await checkAdminCredentials(context);
            if (!isAdmin) {
                vscode.window.showErrorMessage('Necesitas permisos de administrador para exportar datos de analytics');
                return;
            }
            
            await exportAnalyticsData(context);
        })
    );
    
    // Comando para ver un resumen de analytics
    context.subscriptions.push(
        vscode.commands.registerCommand('pairchatbot.showAnalyticsSummary', async () => {
            // Verificar si hay credenciales de administrador
            const isAdmin = await checkAdminCredentials(context);
            if (!isAdmin) {
                vscode.window.showErrorMessage('Necesitas permisos de administrador para ver el resumen de analytics');
                return;
            }
            
            await showAnalyticsSummary(context);
        })
    );
    
    // Comando para limpiar datos de analytics (solo para desarrollo/pruebas)
    if (process.env.NODE_ENV === 'development') {
        context.subscriptions.push(
            vscode.commands.registerCommand('pairchatbot.clearAnalyticsData', async () => {
                const result = await vscode.window.showWarningMessage(
                    '¿Estás seguro de que quieres eliminar todos los datos de analytics? Esta acción no se puede deshacer.',
                    { modal: true },
                    'Eliminar datos'
                );
                
                if (result === 'Eliminar datos') {
                    await context.globalState.update('analytics-pending-events', []);
                    vscode.window.showInformationMessage('Datos de analytics eliminados correctamente');
                }
            })
        );
    }
}

/**
 * Verifica las credenciales de administrador
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 * @returns {Promise<boolean>} - true si las credenciales son válidas
 */
async function checkAdminCredentials(context) {
    // Verificar si ya se ha autenticado como admin
    const isAdmin = context.globalState.get('is-admin');
    if (isAdmin) {
        return true;
    }
    
    // Solicitar contraseña de administrador
    const password = await vscode.window.showInputBox({
        password: true,
        prompt: 'Ingresa la contraseña de administrador para acceder a los datos de analytics',
        placeHolder: 'Contraseña'
    });
    
    if (!password) {
        return false;
    }
    
    // En un entorno real, esto debería verificarse contra un servicio seguro
    // NOTA: Este es un ejemplo simplificado, en producción se recomienda implementar
    // un sistema de autenticación más robusto (OAuth, JWT, etc.)
    const isValidPassword = password === 'admin123';
    
    if (isValidPassword) {
        // Guardar estado de administrador para no solicitar contraseña en cada operación
        await context.globalState.update('is-admin', true);
        return true;
    } else {
        vscode.window.showErrorMessage('Contraseña incorrecta');
        return false;
    }
}

/**
 * Exporta los datos de analytics a un archivo
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function exportAnalyticsData(context) {
    try {
        // Obtener eventos pendientes
        const events = context.globalState.get('analytics-pending-events') || [];
        
        if (events.length === 0) {
            vscode.window.showInformationMessage('No hay datos de analytics para exportar');
            return;
        }
        
        // Preparar datos para exportación
        const exportData = {
            export_date: new Date().toISOString(),
            extension_version: vscode.extensions.getExtension('your-extension-id')?.packageJSON.version || 'unknown',
            events: events,
            summary: prepareAnalyticsData(events)
        };
        
        // Solicitar ubicación para guardar el archivo
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Necesitas tener una carpeta abierta para exportar los datos');
            return;
        }
        
        const defaultUri = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, 'leia-analytics-export.json'));
        const fileUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: {
                'JSON': ['json']
            },
            title: 'Guardar datos de analytics'
        });
        
        if (!fileUri) return;
        
        // Guardar archivo
        const jsonData = JSON.stringify(exportData, null, 2);
        fs.writeFileSync(fileUri.fsPath, jsonData);
        
        vscode.window.showInformationMessage(`Datos de analytics exportados correctamente a ${fileUri.fsPath}`);
        info(`Exportados ${events.length} eventos de analytics a ${fileUri.fsPath}`);
        
    } catch (err) {
        error(`Error al exportar datos de analytics: ${err.message}`);
        vscode.window.showErrorMessage(`Error al exportar datos: ${err.message}`);
    }
}

/**
 * Muestra un resumen de los datos de analytics
 * @param {vscode.ExtensionContext} context - Contexto de la extensión
 */
async function showAnalyticsSummary(context) {
    try {
        // Obtener eventos pendientes
        const events = context.globalState.get('analytics-pending-events') || [];
        
        if (events.length === 0) {
            vscode.window.showInformationMessage('No hay datos de analytics para mostrar');
            return;
        }
        
        // Preparar datos para el resumen
        const analyticsData = prepareAnalyticsData(events);
        
        // Crear contenido markdown para el resumen
        const markdown = generateAnalyticsSummaryMarkdown(analyticsData, events);
        
        // Mostrar en un panel de webview
        const panel = vscode.window.createWebviewPanel(
            'leiaAnalytics',
            'Leia - Resumen de Analytics',
            vscode.ViewColumn.One,
            {}
        );
        
        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Leia Analytics</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                }
                h1, h2, h3 {
                    color: var(--vscode-editor-foreground);
                }
                .summary-card {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 5px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .metric {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .metric-label {
                    font-weight: bold;
                }
                .chart-container {
                    margin: 20px 0;
                    height: 300px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: var(--vscode-editor-background);
                }
            </style>
        </head>
        <body>
            ${markdown}
        </body>
        </html>
        `;
        
    } catch (err) {
        error(`Error al mostrar resumen de analytics: ${err.message}`);
        vscode.window.showErrorMessage(`Error al mostrar resumen: ${err.message}`);
    }
}

/**
 * Genera contenido markdown para el resumen de analytics
 * @param {Object} analyticsData - Datos procesados de analytics
 * @param {Array} rawEvents - Eventos sin procesar
 * @returns {string} - Contenido markdown
 */
function generateAnalyticsSummaryMarkdown(analyticsData, rawEvents) {
    const { stats, events_by_user } = analyticsData;
    
    // Calcular estadísticas adicionales
    const uniqueUsers = Object.keys(events_by_user);
    //const now = new Date();
    /*const last24Hours = rawEvents.filter(e => 
        (now - new Date(e.timestamp)) < 24 * 60 * 60 * 1000
    ).length;*/
    const now = Date.now(); // esto devuelve el timestamp actual en milisegundos

const last24Hours = rawEvents.filter(e =>
    (now - new Date(e.timestamp).getTime()) < 24 * 60 * 60 * 1000
).length;
    
    // Contar eventos por tipo
    const eventTypes = {};
    rawEvents.forEach(event => {
        eventTypes[event.event_type] = (eventTypes[event.event_type] || 0) + 1;
    });
    
    // Ordenar tipos de eventos por cantidad (descendente)
    const sortedEventTypes = Object.entries(eventTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10
    
    // Crear estadísticas de lenguajes de programación
    const languages = {};
    rawEvents
        .filter(e => e.data && e.data.language)
        .forEach(e => {
            languages[e.data.language] = (languages[e.data.language] || 0) + 1;
        });
    
    // Ordenar lenguajes por cantidad (descendente)
    const sortedLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1]);
    
    // Estadísticas de pair programming
    const pairSessions = rawEvents.filter(e => e.event_type === 'PAIR_SESSION_START').length;
    const taskCompletions = rawEvents.filter(e => e.event_type === 'TASK_COMPLETE').length;
    
    return `
    <h1>Resumen de Learning Analytics</h1>
    <p>Datos recopilados hasta: ${new Date().toLocaleString()}</p>
    
    <div class="summary-card">
        <h2>Estadísticas Generales</h2>
        <div class="metric">
            <span class="metric-label">Total de eventos:</span>
            <span>${stats.total_events}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Usuarios únicos:</span>
            <span>${stats.unique_users}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Interacciones de chat:</span>
            <span>${stats.chat_interactions}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Sesiones de pair programming:</span>
            <span>${stats.pair_sessions}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Análisis de código:</span>
            <span>${stats.code_analyses}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Eventos en las últimas 24 horas:</span>
            <span>${last24Hours}</span>
        </div>
    </div>
    
    <div class="summary-card">
        <h2>Tipos de Eventos Más Comunes</h2>
        <table>
            <tr>
                <th>Tipo de Evento</th>
                <th>Cantidad</th>
                <th>Porcentaje</th>
            </tr>
            ${sortedEventTypes.map(([type, count]) => `
                <tr>
                    <td>${type}</td>
                    <td>${count}</td>
                    <td>${((count / stats.total_events) * 100).toFixed(2)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <div class="summary-card">
        <h2>Lenguajes de Programación</h2>
        <table>
            <tr>
                <th>Lenguaje</th>
                <th>Ocurrencias</th>
            </tr>
            ${sortedLanguages.map(([language, count]) => `
                <tr>
                    <td>${language}</td>
                    <td>${count}</td>
                </tr>
            `).join('')}
        </table>
    </div>
    
    <div class="summary-card">
        <h2>Actividad de Usuarios</h2>
        <table>
            <tr>
                <th>Usuario</th>
                <th>Eventos</th>
                <th>Interacciones de Chat</th>
                <th>Sesiones Pair</th>
            </tr>
            ${uniqueUsers.map(user => {
                const userEvents = events_by_user[user];
                const chatCount = userEvents.filter(e => e.event_type === 'CHAT_INTERACTION').length;
                const pairCount = userEvents.filter(e => e.event_type === 'PAIR_SESSION_START').length;
                
                return `
                <tr>
                    <td>${user}</td>
                    <td>${userEvents.length}</td>
                    <td>${chatCount}</td>
                    <td>${pairCount}</td>
                </tr>
                `;
            }).join('')}
        </table>
    </div>
    
    <div class="summary-card">
        <h2>Métricas de Pair Programming</h2>
        <div class="metric">
            <span class="metric-label">Total de sesiones:</span>
            <span>${pairSessions}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Tareas completadas:</span>
            <span>${taskCompletions}</span>
        </div>
    </div>
    `;
}
module.exports = { registerAnalyticsCommands };