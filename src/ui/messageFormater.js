/**
 * Procesa y formatea mensajes para el chat
 * Detecta y resalta bloques de código
 * 
 * @param {string} texto - Mensaje original
 * @returns {string} - Mensaje formateado con HTML
 */
function formatMessage(texto) {
    // Detecta bloques de código con triple backticks
    const regex = /```([a-zA-Z0-9]*)([\s\S]*?)```/g;
    
    // Reemplaza cada bloque con HTML para resaltado de sintaxis
    const contenidoHtml = texto.replace(regex, function(match, language, code) {
        // Utiliza el lenguaje especificado o 'plaintext' como fallback
        const lang = language.trim() || 'plaintext';
        
        // Escapa el HTML para evitar inyección de código
        const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .trim();
        
        return '<pre><code class="language-' + lang + '">' + escapedCode + '</code></pre>';
    });
    
    // Procesa líneas simples de código (con comilla invertida simple)
    const inlineCodeRegex = /`([^`]+)`/g;
    const finalHtml = contenidoHtml.replace(inlineCodeRegex, '<code>$1</code>');
    
    return finalHtml;
}

module.exports = { formatMessage };