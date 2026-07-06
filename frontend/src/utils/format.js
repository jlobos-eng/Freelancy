// utils/format.js — helpers de formato compartidos.
// Centralizar acá evita drift entre componentes (cada uno tenía su versión).

const CLP_FORMATTER = new Intl.NumberFormat('es-CL');

/** Formatea un número como pesos chilenos sin símbolo. Devuelve "0" si el input es inválido. */
export function formatCLP(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return CLP_FORMATTER.format(n);
}

/** Formatea un número como pesos chilenos con símbolo "$". */
export function formatCLPWithSymbol(value) {
    return `$${formatCLP(value)}`;
}

/** Toma input string del usuario y devuelve solo dígitos. */
export function digitsOnly(value) {
    return String(value ?? '').replace(/\D/g, '');
}

/** Formatea un ETA en días en texto humano. */
export function formatEta(days) {
    const d = Number(days);
    if (!Number.isFinite(d)) return '';
    if (d === 0) return 'Inmediato';
    if (d === 1) return 'Mismo día';
    return `${d} días`;
}

/** Formatea una fecha ISO en relativo amigable: "Ahora", "Hace 5 min", "Hace 2 h", "Hace 3 d", o fecha corta. */
export function formatRelative(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `Hace ${diffD} d`;
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}
