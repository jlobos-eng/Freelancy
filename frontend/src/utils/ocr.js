// utils/ocr.js — wrapper de Tesseract.js para OCR de cédulas chilenas.
//
// IMPORTANTE: Tesseract.js pesa ~3 MB (modelos + WASM). Lo cargamos LAZY
// con dynamic import para no inflar el initial bundle. La primera llamada
// descarga el modelo 'spa' (español); requests siguientes usan cache.
//
// API:
//   await runOcr(imageBlobOrUrl) → { text, confidence } | { error }
//   extractRutAndName(text) → { rut, fullName }

import { isValidRut, formatRut, cleanRut } from './rut';

let _workerPromise = null;

async function getWorker() {
    if (_workerPromise) return _workerPromise;
    _workerPromise = (async () => {
        // Dynamic import: el código de Tesseract solo se descarga cuando
        // el usuario realmente entra al flujo de KYC.
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('spa', 1, {
            // Logger silencioso por default; descomentar para debug
            // logger: (m) => console.log('[ocr]', m),
        });
        return worker;
    })();
    return _workerPromise;
}

/** Termina el worker y libera memoria/wasm. Llamar cuando salgamos del flujo KYC. */
export async function terminateOcr() {
    if (!_workerPromise) return;
    try {
        const w = await _workerPromise;
        await w.terminate();
    } catch { /* ignore */ }
    _workerPromise = null;
}

/**
 * Corre OCR sobre una imagen (Blob, File, dataURL o URL).
 * Devuelve { text, confidence } donde confidence está en [0,1].
 */
export async function runOcr(image) {
    try {
        const worker = await getWorker();
        const { data } = await worker.recognize(image);
        return {
            text: data.text || '',
            confidence: typeof data.confidence === 'number' ? data.confidence / 100 : 0,
        };
    } catch (err) {
        return { text: '', confidence: 0, error: err?.message || 'OCR failed' };
    }
}

// =====================================================================
// Extracción de RUT y nombre del texto OCR de una cédula chilena
// =====================================================================
//
// La cédula chilena en formato actual tiene en el frente:
//   - APELLIDOS y NOMBRES (en líneas separadas, mayúsculas)
//   - RUN (etiqueta) seguido del número con formato 12.345.678-9
//   - Fecha de nacimiento, sexo, nacionalidad, número de documento
//   - Vencimiento
//
// El OCR rara vez sale perfecto. Tácticas:
//   1. Buscar patrón de RUT con regex tolerante a OCR (puntos confundidos
//      con comas, guión confundido con espacio, etc.).
//   2. Validar el RUT con dígito verificador (módulo 11). Si falla, lo
//      descartamos y devolvemos null.
//   3. Para el nombre, buscar la línea inmediatamente sobre el patrón
//      "RUN" o "RUT" (cédula tiene los apellidos antes del RUN).
// =====================================================================

const RUT_REGEX = /(\d{1,3}[.\s,]?\d{3}[.\s,]?\d{3}[\s-]?[\dkK])/g;

/** Extrae el primer RUT válido del texto. Devuelve formato '12.345.678-9' o null. */
export function extractRut(text) {
    if (!text) return null;
    const matches = text.match(RUT_REGEX) || [];
    for (const m of matches) {
        const clean = cleanRut(m);
        if (clean.length >= 8 && clean.length <= 9 && isValidRut(clean)) {
            return formatRut(clean);
        }
    }
    return null;
}

/**
 * Extrae el nombre completo del texto OCR. Estrategia:
 *  - Busca líneas en mayúsculas (>3 chars) que NO contengan dígitos ni
 *    palabras como 'CHILE', 'NACIONALIDAD', 'CEDULA', 'IDENTIDAD'.
 *  - Devuelve la primera línea decente que encuentre.
 *
 * Imperfecto a propósito — el match definitivo lo hace la RPC SQL
 * (substring fuzzy contra profile.full_name). Acá sólo damos un mejor
 * candidato que vacío.
 */
const NOISE = /CHILE|NACIONALIDAD|REPUBLICA|CEDULA|IDENTIDAD|RUN|RUT|SEXO|SERVICIO|REGISTRO|CIVIL|FECHA|NACIMIENTO|VENCIMIENTO|DOCUMENTO|N[°º]|FIRMA/i;
export function extractName(text) {
    if (!text) return null;
    const lines = text
        .split(/[\n\r]+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 4 && l.length <= 60)
        .filter((l) => !/\d/.test(l))
        .filter((l) => !NOISE.test(l))
        // Solo líneas con letras "razonables" en mayúscula
        .filter((l) => /^[A-ZÁÉÍÓÚÑ\s'.-]+$/i.test(l) && l === l.toUpperCase());

    if (lines.length === 0) return null;
    // Las cédulas tienen apellidos arriba y nombres después. Tomamos las primeras dos
    // líneas y las concatenamos si parecen apellidos+nombres separados.
    const first = lines[0].trim();
    const second = lines[1]?.trim();
    if (second && second !== first) {
        return `${first} ${second}`.replace(/\s+/g, ' ');
    }
    return first;
}

/** Extracción combinada: corre OCR sobre la imagen y devuelve rut + nombre. */
export async function extractIdentity(image) {
    const { text, confidence, error } = await runOcr(image);
    if (error) return { error, confidence: 0 };
    return {
        rut: extractRut(text),
        fullName: extractName(text),
        rawText: text,
        confidence,
    };
}
