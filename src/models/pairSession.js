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
    console.log('📝 startSession llamado:', { driverEmail, navigatorEmail });
    
    this.driver = driverEmail;
    this.navigator = navigatorEmail;
    this.sessionActive = true;
    this.activeUser = driverEmail;
    this.turnStartTime = Date.now();
    
    // ⚠️ TEMPORAL: Comentar el timer para debugging
    this.startTimer();
    console.log('✅ startSession completado');
    
    return {
        driver: this.driver,
        navigator: this.navigator,
        activeUser: this.activeUser,
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
    console.log('⏰ startTimer llamado');
    
    // Detener timer anterior si existe
    this.stopTimer();
    
    // Calcular tiempo de advertencia (2 minutos antes)
    const warningTime = this.turnDuration - (2 * 60 * 1000);
    
    console.log('⏰ Configurando timers:', {
        warningTime: warningTime / 1000 + 's',
        totalTime: this.turnDuration / 1000 + 's',
        hasCallbacks: !!this.timerCallbacks
    });
    
    // Timer para la advertencia (opcional)
    if (warningTime > 0) {
        this.warningTimer = setTimeout(() => {
            console.log('⏰ Timer warning triggered');
            if (this.timerCallbacks && typeof this.timerCallbacks.onTimerWarning === 'function') {
                try {
                    this.timerCallbacks.onTimerWarning({
                        message: '⏰ Quedan 2 minutos para cambiar de rol',
                        timeRemaining: 2 * 60 * 1000
                    });
                } catch (error) {
                    console.error('❌ Error en onTimerWarning:', error);
                }
            } else {
                console.warn('⚠️ onTimerWarning no está configurado');
            }
        }, warningTime);
    }
    
    // Timer principal
    this.timer = setTimeout(() => {
        console.log('⏰ Timer ended - Tiempo terminado!');
        
        // Limpiar warning timer si existe
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
            this.warningTimer = null;
        }
        
        // Llamar callback de fin de turno
        if (this.timerCallbacks && typeof this.timerCallbacks.onTimerEnded === 'function') {
            try {
                this.timerCallbacks.onTimerEnded({
                    message: '¡Hora de cambiar de rol!'
                });
                console.log('✅ onTimerEnded ejecutado correctamente');
            } catch (error) {
                console.error('❌ Error en onTimerEnded:', error);
            }
        } else {
            console.error('❌ onTimerEnded no está configurado!');
            console.log('timerCallbacks:', this.timerCallbacks);
        }
    }, this.turnDuration);
    
    console.log('✅ Timers configurados correctamente');
}
    
    restartTimer() {
        this.startTimer();
    }
    
    stopTimer() {
    console.log('⏰ stopTimer llamado');
    
    if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
        console.log('✅ Timer principal detenido');
    }
    
    if (this.warningTimer) {
        clearTimeout(this.warningTimer);
        this.warningTimer = null;
        console.log('✅ Warning timer detenido');
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