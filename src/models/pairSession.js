/**
 * Modelo de sesión de Pair Programming
 * ⭐ MODIFICADO: Ahora incluye activeUser para trackear quién tiene el control
 */

class PairProgrammingSession {
    constructor() {
        this.driver = null;
        this.navigator = null;
        this.sessionActive = false;
        this.turnStartTime = null;
        this.turnDuration = 1 * 60 * 1000; // 15 minutos en milisegundos
        this.timer = null;
        this.sessionTasks = [];
        this.completedTasks = [];
        this.timerCallbacks = {
            onTimerEnded: null,
            onTimerWarning: null
        };
        
        // ⭐ NUEVO: Trackear quién es el "active user" (el que controla el teclado)
        this.activeUser = null; // Será el driver actual
    }

    setTimerCallbacks(callbacks) {
    this.timerCallbacks = callbacks;
}
    
    /**
     * ⭐ MODIFICADO: Iniciar sesión y establecer activeUser
     */
    startSession(driverEmail, navigatorEmail) {
        this.driver = driverEmail;
        this.navigator = navigatorEmail;
        this.sessionActive = true;
        this.activeUser = driverEmail; // ⭐ NUEVO: El driver es quien controla
        this.turnStartTime = Date.now();
        this.startTimer();
        
        return {
            driver: this.driver,
            navigator: this.navigator,
            activeUser: this.activeUser, // ⭐ NUEVO
            timeRemaining: this.turnDuration,
            sessionActive: this.sessionActive
        };
    }
    
    /**
     * ⭐ MODIFICADO: Cambiar roles y actualizar activeUser
     */
    switchRoles() {
        // Intercambiar roles
        [this.driver, this.navigator] = [this.navigator, this.driver];
        this.activeUser = this.driver; // ⭐ NUEVO: Actualizar quien tiene control
        this.turnStartTime = Date.now();
        this.restartTimer();
        
        return {
            driver: this.driver,
            navigator: this.navigator,
            activeUser: this.activeUser, // ⭐ NUEVO
            timeRemaining: this.turnDuration,
            sessionActive: this.sessionActive,
            pendingTasks: this.sessionTasks,
            completedTasks: this.completedTasks
        };
    }
    
    /**
     * ⭐ MODIFICADO: Obtener estado de la sesión incluyendo activeUser
     */
    getSessionStatus() {
        if (!this.sessionActive) {
            return { sessionActive: false };
        }
        
        return {
            sessionActive: true,
            driver: this.driver,
            navigator: this.navigator,
            activeUser: this.activeUser, // ⭐ NUEVO
            turnStartTime: this.turnStartTime,
            timeRemaining: this.getRemainingTime(),
            pendingTasks: this.sessionTasks,
            completedTasks: this.completedTasks
        };
    }
    
    /**
     * ⭐ NUEVO: Obtener el usuario activo (quien tiene el control)
     */
    getActiveUser() {
        return this.sessionActive ? this.activeUser : null;
    }
    
    /**
     * ⭐ NUEVO: Obtener ambos usuarios y quien está activo
     */
    getBothUsers() {
        return {
            driver: this.driver,
            navigator: this.navigator,
            activeUser: this.activeUser // El driver es quien controla
        };
    }
    
    endSession() {
        this.stopTimer();
        const sessionData = {
            driver: this.driver,
            navigator: this.navigator,
            completedTasks: this.completedTasks,
            pendingTasks: this.sessionTasks,
            totalDuration: Date.now() - this.turnStartTime
        };
        
        // Limpiar estado
        this.driver = null;
        this.navigator = null;
        this.activeUser = null; // ⭐ NUEVO: Limpiar también activeUser
        this.sessionActive = false;
        this.sessionTasks = [];
        this.completedTasks = [];
        
        return sessionData;
    }
    
    startTimer() {
        this.stopTimer(); // Detener timer anterior si existe
        
        const warningTime = this.turnDuration - (2 * 60 * 1000); // 2 minutos antes
        
        // Timer para la advertencia
        const warningTimer = setTimeout(() => {
            if (this.timerCallbacks.onTimerWarning) {
                this.timerCallbacks.onTimerWarning();
            }
        }, warningTime);
        
        // Timer principal
        this.timer = setTimeout(() => {
            clearTimeout(warningTimer);
            if (this.timerCallbacks.onTimerEnded) {
                this.timerCallbacks.onTimerEnded();
            }
        }, this.turnDuration);
    }
    
    restartTimer() {
        this.startTimer();
    }
    
    stopTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    
    getRemainingTime() {
        if (!this.turnStartTime) return 0;
        const elapsed = Date.now() - this.turnStartTime;
        return Math.max(0, this.turnDuration - elapsed);
    }
    
    addTask(task) {
        this.sessionTasks.push(task);
    }
    
    completeTask(taskId) {
        const taskIndex = this.sessionTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = this.sessionTasks.splice(taskIndex, 1)[0];
            this.completedTasks.push({
                ...task,
                completedAt: Date.now()
            });
            return task;
        }
        return null;
    }
    
    editTask(taskId, newDescription) {
        const task = this.sessionTasks.find(t => t.id === taskId);
        if (task) {
            task.description = newDescription;
            return task;
        }
        return null;
    }
    
    deleteTask(taskId) {
        const taskIndex = this.sessionTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            return this.sessionTasks.splice(taskIndex, 1)[0];
        }
        return null;
    }
}

module.exports = PairProgrammingSession;