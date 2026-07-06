// utils/rut.js — validación y formateo de RUT chileno (módulo 11).
// Espejo client-side del validador SQL is_valid_rut().
// Acepta entradas con puntos/guión o sin nada: '12.345.678-9', '12345678-9', '123456789'.

/** Limpia un RUT: deja solo dígitos y K mayúscula. */
export function cleanRut(rut) {
    return String(rut ?? '').toUpperCase().replace(/[^0-9K]/g, '');
}

/** Calcula el dígito verificador. cuerpo es solo dígitos sin DV. */
export function computeDv(cuerpo) {
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return '0';
    if (resto === 10) return 'K';
    return String(resto);
}

/** Devuelve true si el RUT es válido (formato + dígito verificador). */
export function isValidRut(rut) {
    const clean = cleanRut(rut);
    if (clean.length < 2) return false;
    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    return computeDv(cuerpo) === dv;
}

/** Formatea un RUT al estilo '12.345.678-9'. */
export function formatRut(rut) {
    const clean = cleanRut(rut);
    if (clean.length < 2) return clean;
    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1);
    // Insertar puntos cada 3 dígitos desde la derecha
    const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${conPuntos}-${dv}`;
}
