import { describe, it, expect } from 'vitest';
import { cleanRut, computeDv, isValidRut, formatRut } from '../rut.js';

describe('rut.cleanRut', () => {
  it('deja solo dígitos y K mayúscula', () => {
    expect(cleanRut('12.345.678-5')).toBe('123456785');
    expect(cleanRut('12345678-k')).toBe('12345678K');
    expect(cleanRut('  7.654.321-0 ')).toBe('76543210');
  });
  it('maneja null/undefined sin romper', () => {
    expect(cleanRut(null)).toBe('');
    expect(cleanRut(undefined)).toBe('');
  });
});

describe('rut.computeDv', () => {
  it('calcula DV conocidos', () => {
    expect(computeDv('12345678')).toBe('5');
    expect(computeDv('11111111')).toBe('1');
  });
});

describe('rut.isValidRut', () => {
  it('acepta RUTs válidos en varios formatos', () => {
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('123456785')).toBe(true);
    expect(isValidRut('11.111.111-1')).toBe(true);
  });
  it('rechaza DV incorrecto', () => {
    expect(isValidRut('12.345.678-9')).toBe(false);
    expect(isValidRut('11.111.111-2')).toBe(false);
  });
  it('rechaza entradas inválidas', () => {
    expect(isValidRut('')).toBe(false);
    expect(isValidRut('1')).toBe(false);
    expect(isValidRut('abc-d')).toBe(false);
    expect(isValidRut(null)).toBe(false);
  });
  it('es consistente con computeDv (propiedad)', () => {
    for (const cuerpo of ['5', '9430574', '20100200', '76543210']) {
      const dv = computeDv(cuerpo);
      expect(isValidRut(cuerpo + dv)).toBe(true);
      const wrong = dv === '0' ? '1' : '0';
      expect(isValidRut(cuerpo + wrong)).toBe(false);
    }
  });
});

describe('rut.formatRut', () => {
  it('formatea con puntos y guión', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
    expect(formatRut('76543210')).toBe('7.654.321-0');
  });
});
