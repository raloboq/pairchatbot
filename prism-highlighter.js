// Función para resaltar bloques de código
function procesarContenidoMensaje(texto) {
    // Detecta bloques de código con triple backticks
    const regex = /```([a-zA-Z0-9]*)([\s\S]*?)```/g;
    
    // Reemplaza cada bloque con HTML formateado para Prism
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
    
    return contenidoHtml;
}

// Aplica el resaltado de sintaxis después de agregar contenido al DOM
/*function aplicarResaltadoSintaxis() {
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    }
}

module.exports = {
    procesarContenidoMensaje,
    aplicarResaltadoSintaxis
};*/