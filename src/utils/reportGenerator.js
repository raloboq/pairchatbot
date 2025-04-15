/**
 * Función para generar un reporte en formato markdown
 * @param {Object} report - Datos del reporte
 * @param {import('../models/pairSession').PairProgrammingSession} session - Sesión de pair programming
 * @returns {string} - Contenido markdown
 */
function generateMarkdownReport(report, session) {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    
    return `# Reporte de Sesión de Pair Programming

**Fecha:** ${dateStr}
**Hora:** ${timeStr}

## Participantes
- **Piloto (Driver):** ${session.driver}
- **Navegante (Navigator):** ${session.navigator}

## Resumen de la Sesión
- **Duración:** ${Math.floor(report.duration / 60000)} minutos
- **Tareas completadas:** ${report.completedTasks.length}
- **Tareas pendientes:** ${report.pendingTasks.length}

## Tareas Completadas
${report.completedTasks.length === 0 ? 
  '- No se completaron tareas en esta sesión' : 
  report.completedTasks.map(task => `- ${task.description} (completada: ${new Date(task.completedAt).toLocaleTimeString()})`).join('\n')
}

## Tareas Pendientes
${report.pendingTasks.length === 0 ? 
  '- No quedan tareas pendientes' : 
  report.pendingTasks.map(task => `- ${task.description}`).join('\n')
}

## Notas para la Próxima Sesión
- Continuar con las tareas pendientes
- Revisar el progreso y ajustar la estrategia si es necesario
- Asegurar que ambos participantes tengan oportunidad de ser piloto y navegante

---
*Generado por Leia - Programming Assistant*
`;
}

module.exports = { generateMarkdownReport };