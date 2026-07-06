import { describe, it, expect } from 'vitest';
import { formatCLP, formatCLPWithSymbol, digitsOnly, formatEta, formatRelative } from '../format.js';

describe('format.formatCLP', () => {
  it('formatea miles y preserva el valor', () => {
    expect(formatCLP(1000).replace(/\D/g, '')).toBe('1000');
    expect(formatCLP(1234567).replace(/\D/g, '')).toBe('1234567');
  });
  it('devuelve "0" ante entradas inválidas', () => {
    expect(formatCLP(NaN)).toBe('0');
    expect(formatCLP('abc')).toBe('0');
    expect(formatCLP(undefined)).toBe('0');
  });
});

describe('format.formatCLPWithSymbol', () => {
  it('antepone $', () => {
    expect(formatCLPWithSymbol(1000).startsWith('$')).toBe(true);
    expect(formatCLPWithSymbol(NaN)).toBe('$0');
  });
});

describe('format.digitsOnly', () => {
  it('extrae solo dígitos', () => {
    expect(digitsOnly('$1.234')).toBe('1234');
    expect(digitsOnly('abc')).toBe('');
    expect(digitsOnly(null)).toBe('');
  });
});

describe('format.formatEta', () => {
  it('mapea casos especiales', () => {
    expect(formatEta(0)).toBe('Inmediato');
    expect(formatEta(1)).toBe('Mismo día');
    expect(formatEta(3)).toBe('3 días');
    expect(formatEta(NaN)).toBe('');
  });
});

describe('format.formatRelative', () => {
  it('maneja vacío/ inválido', () => {
    expect(formatRelative('')).toBe('');
    expect(formatRelative('no-es-fecha')).toBe('');
  });
  it('reciente => "Ahora"', () => {
    expect(formatRelative(new Date().toISOString())).toBe('Ahora');
  });
  it('hace minutos/horas', () => {
    const hace5min = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelative(hace5min)).toBe('Hace 5 min');
    const hace2h = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(formatRelative(hace2h)).toBe('Hace 2 h');
  });
});
