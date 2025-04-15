/**
 * Valida un formato de correo electrónico
 * @param {string} email - Correo electrónico a validar
 * @returns {boolean} - true si el formato es válido
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

module.exports = { validateEmail };