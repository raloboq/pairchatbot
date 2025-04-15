/**
 * Clase para gestionar la sesión de pair programming
 */
class PairProgrammingSession {
    constructor() {
        this.driver = null;
        this.navigator = null;
        this.sessionActive = false;
        this.turnStartTime = null;
        this.turnDuration = 15 * 60 * 1000; // 15 minutos en milisegundos
        this.timer = null;
        this.sessionTasks = [];
        this.completedTasks = [];
        this.timerCallbacks = {
            onTimerEnded: null,
            onTimerWarning: null
        };
    }

    /**
     * Configurar callbacks para eventos del temporizador
     * @param {Object} callbacks - Callbacks para eventos del timer
     */
    setTimerCallbacks(callbacks) {
        this.timerCallbacks = { ...this.timerCallbacks, ...callbacks };
    }

    /**
     * Iniciar una sesión con dos participantes
     * @param {string} driverEmail - Email del piloto
     * @param {string} navigatorEmail - Email del navegante
     * @returns {Object} - Estado de la sesión
     */
    startSession(driverEmail, navigatorEmail) {
        this.driver = driverEmail;
        this.navigator = navigatorEmail;
        this.sessionActive = true;
        this.turnStartTime = Date.now();
        this.startTimer();
        return {
            driver: this.driver,
            navigator: this.navigator,
            timeRemaining: this.turnDuration,
            sessionActive: this.sessionActive
        };
    }

    /**
     * Cambiar roles entre driver y navigator
     * @returns {Object} - Estado actualizado de la sesión
     */
    switchRoles() {
        // Intercambiar roles
        [this.driver, this.navigator] = [this.navigator, this.driver];
        this.turnStartTime = Date.now();
        this.restartTimer();
        return {
            driver: this.driver,
            navigator: this.navigator,
            timeRemaining: this.turnDuration,
            sessionActive: this.sessionActive
        };
    }

    /**
     * Finalizar la sesión
     * @returns {Object} - Resumen de la sesión
     */
    endSession() {
        this.clearTimer();
        this.sessionActive = false;
        const summary = this.generateSessionSummary();
        
        // Añadimos sessionActive: false al resumen para mantener consistencia
        summary.sessionActive = false;
        
        this.driver = null;
        this.navigator = null;
        this.sessionTasks = [];
        this.completedTasks = [];
        return summary;
    }

    /**
     * Iniciar temporizador para cambio de roles
     */
    startTimer() {
        this.clearTimer(); // Limpiar cualquier timer anterior
        this.timer = setInterval(() => {
            // Lógica para notificar cuando queden 5, 2 y 1 minuto
            const timeElapsed = Date.now() - this.turnStartTime;
            const timeRemaining = this.turnDuration - timeElapsed;
            
            if (timeRemaining <= 0) {
                this.clearTimer();
                if (this.timerCallbacks.onTimerEnded) {
                    this.timerCallbacks.onTimerEnded({
                        type: 'TIMER_ENDED',
                        message: 'Es hora de cambiar roles. El navegante ahora debería ser el piloto.'
                    });
                }
            } else if (timeRemaining <= 60000) { // 1 minuto
                if (this.timerCallbacks.onTimerWarning) {
                    this.timerCallbacks.onTimerWarning({
                        type: 'TIMER_WARNING',
                        message: 'Queda 1 minuto para cambiar roles.',
                        timeRemaining
                    });
                }
            } else if (timeRemaining <= 120000) { // 2 minutos
                if (this.timerCallbacks.onTimerWarning) {
                    this.timerCallbacks.onTimerWarning({
                        type: 'TIMER_WARNING',
                        message: 'Quedan 2 minutos para cambiar roles.',
                        timeRemaining
                    });
                }
            } else if (timeRemaining <= 300000) { // 5 minutos
                if (this.timerCallbacks.onTimerWarning) {
                    this.timerCallbacks.onTimerWarning({
                        type: 'TIMER_WARNING',
                        message: 'Quedan 5 minutos para cambiar roles.',
                        timeRemaining
                    });
                }
            }
        }, 30000); // Verificar cada 30 segundos
    }

    /**
     * Reiniciar el temporizador
     */
    restartTimer() {
        this.clearTimer();
        this.startTimer();
    }

    /**
     * Limpiar el temporizador
     */
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Obtener tiempo restante del turno actual
     * @returns {number} - Milisegundos restantes
     */
    getRemainingTime() {
        if (!this.sessionActive || !this.turnStartTime) return 0;
        const timeElapsed = Date.now() - this.turnStartTime;
        return Math.max(0, this.turnDuration - timeElapsed);
    }

    /**
     * Agregar una tarea a la sesión
     * @param {string} task - Descripción de la tarea
     * @returns {Array} - Lista actualizada de tareas
     */
    addTask(task) {
        this.sessionTasks.push({
            id: Date.now(),
            description: task,
            completed: false,
            createdAt: new Date().toISOString()
        });
        return this.sessionTasks;
    }

    /**
     * Marcar una tarea como completada
     * @param {number} taskId - ID de la tarea
     * @returns {Object} - Listas actualizadas de tareas
     */
    completeTask(taskId) {
        const taskIndex = this.sessionTasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            this.sessionTasks[taskIndex].completed = true;
            this.sessionTasks[taskIndex].completedAt = new Date().toISOString();
            this.completedTasks.push(this.sessionTasks[taskIndex]);
            this.sessionTasks.splice(taskIndex, 1);
        }
        return {
            pendingTasks: this.sessionTasks,
            completedTasks: this.completedTasks
        };
    }

    /**
     * Generar resumen de la sesión
     * @returns {Object} - Datos del resumen
     */
    generateSessionSummary() {
        return {
            completedTasks: this.completedTasks,
            pendingTasks: this.sessionTasks,
            duration: this.turnStartTime ? Date.now() - this.turnStartTime : 0,
            sessionActive: this.sessionActive
        };
    }

    /**
     * Verificar si un usuario específico es el driver
     * @param {string} email - Email del usuario
     * @returns {boolean}
     */
    isDriver(email) {
        return this.sessionActive && this.driver === email;
    }

    /**
     * Verificar si un usuario específico es el navigator
     * @param {string} email - Email del usuario
     * @returns {boolean}
     */
    isNavigator(email) {
        return this.sessionActive && this.navigator === email;
    }

    /**
     * Obtener el estado actual de la sesión
     * @returns {Object} - Estado de la sesión
     */
    getSessionStatus() {
        if (!this.sessionActive) {
            return { sessionActive: false };
        }
        
        return {
            sessionActive: true,
            driver: this.driver,
            navigator: this.navigator,
            timeRemaining: this.getRemainingTime(),
            pendingTasks: this.sessionTasks.length,
            completedTasks: this.completedTasks.length
        };
    }
}

module.exports = { PairProgrammingSession };