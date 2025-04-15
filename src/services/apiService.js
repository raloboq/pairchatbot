/**
 * URL base para la API
 */
const API_URL = 'https://pairchatbot-api.vercel.app/api/chat';

/**
 * Envía una solicitud al servidor de chat
 * @param {Object} data - Datos para la solicitud
 * @param {string} data.message - Mensaje a enviar
 * @param {string} [data.code] - Código a incluir (opcional)
 * @param {Object} data.metadata - Metadatos adicionales
 * @returns {Promise<Object>} - Respuesta del servidor
 */
async function sendChatRequest(data) {
    try {
        console.log('Enviando a la API:', JSON.stringify(data, null, 2));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            // Intentar leer el cuerpo del error
            let errorBody = '';
            try {
                errorBody = await response.text();
                console.error('Cuerpo del error:', errorBody);
            } catch (readError) {
                console.error('No se pudo leer el cuerpo del error:', readError);
            }
            
            throw new Error(`Error del servidor: ${response.status}. Detalles: ${errorBody}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error en la solicitud a la API:', error);
        throw error;
    }
}

module.exports = { sendChatRequest };