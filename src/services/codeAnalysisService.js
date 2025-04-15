/**
 * Servicio para analizar código y recopilar métricas
 */

const { debug } = require('../utils/logger');
const { trackEvent } = require('./analyticsService');

/**
 * Analiza un fragmento de código y registra métricas
 * @param {string} code - Fragmento de código a analizar 
 * @param {string} language - Lenguaje de programación
 * @param {Object} context - Contexto de la extensión
 */
function analyzeCode(code, language, context) {
    if (!code || code.trim() === '') {
        debug('Código vacío, omitiendo análisis');
        return;
    }
    
    debug(`Analizando código ${language}, tamaño: ${code.length}`);
    
    // Métricas básicas
    const metrics = {
        language,
        char_count: code.length,
        line_count: code.split('\n').length,
        empty_lines: code.split('\n').filter(line => line.trim() === '').length,
        timestamp: new Date().toISOString()
    };
    
    // Análisis específico por lenguaje
    switch (language) {
        case 'javascript':
        case 'typescript':
            analyzeJavaScript(code, metrics);
            break;
        case 'python':
            analyzePython(code, metrics);
            break;
        case 'java':
            analyzeJava(code, metrics);
            break;
        case 'csharp':
            analyzeCSharp(code, metrics);
            break;
        default:
            // Análisis genérico para otros lenguajes
            analyzeGeneric(code, metrics);
    }
    
    // Registrar métricas en analytics
    trackEvent('CODE_METRICS', metrics, context);
    
    return metrics;
}

/**
 * Analiza código JavaScript/TypeScript
 * @param {string} code - Código a analizar
 * @param {Object} metrics - Objeto de métricas a completar
 */
function analyzeJavaScript(code, metrics) {
    // Detectar funciones y métodos
    const functionMatches = code.match(/function\s+\w+\s*\(|=>|class\s+\w+|constructor\s*\(|[\w.]+\s*=\s*function/g) || [];
    metrics.function_count = functionMatches.length;
    
    // Detectar imports
    const importMatches = code.match(/import\s+.+from|require\s*\(/g) || [];
    metrics.import_count = importMatches.length;
    
    // Detectar uso de async/await
    metrics.uses_async = code.includes('async ') || code.includes('await ');
    
    // Detectar uso de promesas
    metrics.uses_promises = code.includes('new Promise') || code.includes('.then(') || code.includes('.catch(');
    
    // Contar bloques try-catch
    const tryCatchMatches = code.match(/try\s*{/g) || [];
    metrics.try_catch_count = tryCatchMatches.length;
}

/**
 * Analiza código Python
 * @param {string} code - Código a analizar
 * @param {Object} metrics - Objeto de métricas a completar
 */
function analyzePython(code, metrics) {
    // Detectar funciones
    const functionMatches = code.match(/def\s+\w+\s*\(/g) || [];
    metrics.function_count = functionMatches.length;
    
    // Detectar clases
    const classMatches = code.match(/class\s+\w+/g) || [];
    metrics.class_count = classMatches.length;
    
    // Detectar imports
    const importMatches = code.match(/import\s+|from\s+.+import/g) || [];
    metrics.import_count = importMatches.length;
    
    // Detectar uso de list comprehensions
    const listCompMatches = code.match(/\[\s*[\w\s.()]+\s+for\s+/g) || [];
    metrics.list_comprehension_count = listCompMatches.length;
    
    // Detectar uso de decoradores
    const decoratorMatches = code.match(/@[\w.]+/g) || [];
    metrics.decorator_count = decoratorMatches.length;
}

/**
 * Analiza código Java
 * @param {string} code - Código a analizar
 * @param {Object} metrics - Objeto de métricas a completar
 */
function analyzeJava(code, metrics) {
    // Detectar clases
    const classMatches = code.match(/class\s+\w+|interface\s+\w+|enum\s+\w+/g) || [];
    metrics.class_count = classMatches.length;
    
    // Detectar métodos
    const methodMatches = code.match(/(\s|^)(\w+\s+)+\w+\s*\([^)]*\)\s*(\{|throws)/g) || [];
    metrics.method_count = methodMatches.length;
    
    // Detectar imports
    const importMatches = code.match(/import\s+[\w.]+;/g) || [];
    metrics.import_count = importMatches.length;
    
    // Detectar uso de try-catch
    const tryCatchMatches = code.match(/try\s*{/g) || [];
    metrics.try_catch_count = tryCatchMatches.length;
    
    // Detectar uso de annotations
    const annotationMatches = code.match(/@\w+/g) || [];
    metrics.annotation_count = annotationMatches.length;
}

/**
 * Analiza código C#
 * @param {string} code - Código a analizar
 * @param {Object} metrics - Objeto de métricas a completar
 */
function analyzeCSharp(code, metrics) {
    // Detectar clases
    const classMatches = code.match(/class\s+\w+|interface\s+\w+|struct\s+\w+|enum\s+\w+/g) || [];
    metrics.class_count = classMatches.length;
    
    // Detectar métodos
    const methodMatches = code.match(/(\s|^)(\w+\s+)+\w+\s*\([^)]*\)\s*(\{|=>|where)/g) || [];
    metrics.method_count = methodMatches.length;
    
    // Detectar using statements
    const usingMatches = code.match(/using\s+[\w.]+;/g) || [];
    metrics.using_count = usingMatches.length;
    
    // Detectar uso de async/await
    metrics.uses_async = code.includes('async ') || code.includes('await ');
    
    // Detectar uso de LINQ
    metrics.uses_linq = code.includes('from ') || code.includes('select ') || 
                        code.includes('.Select(') || code.includes('.Where(') || 
                        code.includes('.OrderBy(');
}

/**
 * Análisis genérico para cualquier lenguaje
 * @param {string} code - Código a analizar
 * @param {Object} metrics - Objeto de métricas a completar
 */
function analyzeGeneric(code, metrics) {
    // Complejidad básica: número de operadores lógicos
    const logicalMatches = code.match(/&&|\|\||==|!=|>=|<=|>|<|if\s*\(|else|switch\s*\(/g) || [];
    metrics.logical_op_count = logicalMatches.length;
    
    // Contar bucles (aproximación)
    const loopMatches = code.match(/for\s*\(|while\s*\(|do\s*{/g) || [];
    metrics.loop_count = loopMatches.length;
    
    // Contar comentarios
    const lineCommentMatches = code.match(/\/\/[^\n]*/g) || [];
    const blockCommentMatches = (code.match(/\/\*[\s\S]*?\*\//g) || []).join('').split('\n');
    metrics.comment_line_count = lineCommentMatches.length + blockCommentMatches.length;
    
    // Proporción de comentarios
    metrics.comment_ratio = metrics.comment_line_count / metrics.line_count;
}

/**
 * Detecta posibles patrones problemáticos en el código
 * @param {string} code - Código a analizar
 * @param {string} language - Lenguaje de programación
 * @param {Object} context - Contexto de la extensión
 */
function detectCodeIssues(code, language, context) {
    if (!code || code.trim() === '') {
        return [];
    }
    
    const issues = [];
    
    // Problemas genéricos para todos los lenguajes
    
    // Detectar líneas muy largas
    const lines = code.split('\n');
    lines.forEach((line, index) => {
        if (line.length > 100) { // La mayoría de las guías de estilo limitan a 80-120 caracteres
            issues.push({
                type: 'LONG_LINE',
                line: index + 1,
                message: 'Línea demasiado larga (más de 100 caracteres)'
            });
        }
    });
    
    // Problemas específicos por lenguaje
    switch (language) {
        case 'javascript':
        case 'typescript':
            detectJavaScriptIssues(code, issues);
            break;
        case 'python':
            detectPythonIssues(code, issues);
            break;
        case 'java':
            detectJavaIssues(code, issues);
            break;
        case 'csharp':
            detectCSharpIssues(code, issues);
            break;
    }
    
    // Registrar problemas encontrados
    if (issues.length > 0) {
        trackEvent('CODE_ISSUES_DETECTED', {
            language,
            issue_count: issues.length,
            issue_types: issues.map(issue => issue.type),
            timestamp: new Date().toISOString()
        }, context);
    }
    
    return issues;
}

/**
 * Detecta problemas específicos en JavaScript/TypeScript
 * @param {string} code - Código a analizar
 * @param {Array} issues - Array de problemas a llenar
 */
function detectJavaScriptIssues(code, issues) {
    // Detectar console.log olvidados
    const consoleMatch = code.match(/console\.log\(/g) || [];
    if (consoleMatch.length > 0) {
        issues.push({
            type: 'CONSOLE_LOG',
            message: `Se encontraron ${consoleMatch.length} llamadas a console.log()`
        });
    }
    
    // Detectar variables no utilizadas (aproximación básica)
    const varDeclarations = code.match(/(?:let|const|var)\s+(\w+)/g) || [];
    for (const declaration of varDeclarations) {
        const varName = declaration.split(/\s+/)[1];
        const varRegex = new RegExp(`[^\\w]${varName}[^\\w]`, 'g');
        // Si solo aparece una vez podría estar sin usar (aproximación)
        const occurrences = (code.match(varRegex) || []).length;
        if (occurrences <= 1) {
            issues.push({
                type: 'UNUSED_VARIABLE',
                message: `Posible variable no utilizada: ${varName}`
            });
        }
    }
    
    // Detectar === vs ==
    if (code.match(/[^=]=(?!=)/g)) {
        issues.push({
            type: 'LOOSE_EQUALITY',
            message: 'Uso de igualdad débil (==) en lugar de igualdad estricta (===)'
        });
    }
}

/**
 * Detecta problemas específicos en Python
 * @param {string} code - Código a analizar
 * @param {Array} issues - Array de problemas a llenar
 */
function detectPythonIssues(code, issues) {
    // Detectar prints olvidados
    const printMatch = code.match(/print\s*\(/g) || [];
    if (printMatch.length > 0) {
        issues.push({
            type: 'PRINT_STATEMENT',
            message: `Se encontraron ${printMatch.length} llamadas a print()`
        });
    }
    
    // Detectar uso de except sin tipo específico
    if (code.match(/except\s*:/g)) {
        issues.push({
            type: 'BARE_EXCEPT',
            message: 'Uso de except: sin especificar tipo de excepción'
        });
    }
    
    // Detectar errores de indentación
    const lineIndents = [];
    const lines = code.split('\n');
    for (const line of lines) {
        if (line.trim() !== '') {
            const indent = line.match(/^(\s*)/)[0].length;
            lineIndents.push(indent);
        }
    }
    
    // Verificar si hay indentaciones inconsistentes
    const uniqueIndents = new Set(lineIndents);
    if (uniqueIndents.size > 4) { // Un código normal tendría 3-4 niveles de indentación
        issues.push({
            type: 'INCONSISTENT_INDENTATION',
            message: 'Posible problema con la indentación'
        });
    }
}

/**
 * Detecta problemas específicos en Java
 * @param {string} code - Código a analizar
 * @param {Array} issues - Array de problemas a llenar
 */
function detectJavaIssues(code, issues) {
    // Detectar System.out.println olvidados
    const sysoutMatch = code.match(/System\.out\.println\(/g) || [];
    if (sysoutMatch.length > 0) {
        issues.push({
            type: 'SYSTEM_OUT_PRINTLN',
            message: `Se encontraron ${sysoutMatch.length} llamadas a System.out.println()`
        });
    }
    
    // Detectar uso de try-catch vacío
    if (code.match(/catch\s*\([^)]+\)\s*\{\s*\}/g)) {
        issues.push({
            type: 'EMPTY_CATCH',
            message: 'Bloque catch vacío encontrado'
        });
    }
    
    // Detectar posibles métodos muy largos
    const methodMatches = code.match(/(\w+\s+)+\w+\s*\([^)]*\)\s*\{[\s\S]+?\n\s*\}/g) || [];
    for (const method of methodMatches) {
        const lineCount = method.split('\n').length;
        if (lineCount > 30) { // Un método de más de 30 líneas podría ser demasiado largo
            issues.push({
                type: 'LONG_METHOD',
                message: `Método con ${lineCount} líneas encontrado`
            });
        }
    }
}

/**
 * Detecta problemas específicos en C#
 * @param {string} code - Código a analizar
 * @param {Array} issues - Array de problemas a llenar
 */
function detectCSharpIssues(code, issues) {
    // Detectar Console.WriteLine olvidados
    const consoleMatch = code.match(/Console\.WriteLine\(/g) || [];
    if (consoleMatch.length > 0) {
        issues.push({
            type: 'CONSOLE_WRITELINE',
            message: `Se encontraron ${consoleMatch.length} llamadas a Console.WriteLine()`
        });
    }
    
    // Detectar uso de regiones (antipatrón en código moderno)
    if (code.match(/#region/g)) {
        issues.push({
            type: 'REGION_DIRECTIVE',
            message: 'Uso de directivas #region detectado'
        });
    }
    
    // Detectar posibles métodos muy largos
    const methodMatches = code.match(/(\w+\s+)+\w+\s*\([^)]*\)\s*\{[\s\S]+?\n\s*\}/g) || [];
    for (const method of methodMatches) {
        const lineCount = method.split('\n').length;
        if (lineCount > 30) {
            issues.push({
                type: 'LONG_METHOD',
                message: `Método con ${lineCount} líneas encontrado`
            });
        }
    }
}

module.exports = {
    analyzeCode,
    detectCodeIssues
};