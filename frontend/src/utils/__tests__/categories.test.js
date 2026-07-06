import { describe, it, expect } from 'vitest';
import { gigMatchesCategory, workerMatchesCategory, CATEGORIAS } from '../categories.js';

describe('categories.gigMatchesCategory', () => {
  it('"Todos" (o vacío) siempre matchea', () => {
    expect(gigMatchesCategory({ title: 'x' }, 'Todos')).toBe(true);
    expect(gigMatchesCategory({ title: 'x' }, '')).toBe(true);
    expect(gigMatchesCategory(null, 'Todos')).toBe(true);
  });
  it('matchea por campo category exacto (ignorando tildes/mayúsculas)', () => {
    expect(gigMatchesCategory({ category: 'Gásfiter' }, 'gasfiter')).toBe(true);
    expect(gigMatchesCategory({ category: 'Electricista' }, 'Electricista')).toBe(true);
  });
  it('matchea por keyword en título o descripción', () => {
    expect(gigMatchesCategory({ title: 'Necesito un Pintor urgente' }, 'Pintor')).toBe(true);
    expect(gigMatchesCategory({ description: 'reparar cañería, busco gasfiter' }, 'Gásfiter')).toBe(true);
  });
  it('no matchea cuando no hay coincidencia', () => {
    expect(gigMatchesCategory({ title: 'Clases de guitarra' }, 'Electricista')).toBe(false);
    expect(gigMatchesCategory(null, 'Electricista')).toBe(false);
  });
});

describe('categories.workerMatchesCategory', () => {
  it('"Todos" siempre; sin skill nunca', () => {
    expect(workerMatchesCategory({ skill: 'Pintor' }, 'Todos')).toBe(true);
    expect(workerMatchesCategory({}, 'Pintor')).toBe(false);
    expect(workerMatchesCategory(null, 'Pintor')).toBe(false);
  });
  it('matchea por skill sin importar tildes', () => {
    expect(workerMatchesCategory({ skill: 'Gásfiter' }, 'gasfiter')).toBe(true);
    expect(workerMatchesCategory({ skill: 'Electricista' }, 'Pintor')).toBe(false);
  });
});

describe('categories.CATEGORIAS', () => {
  it('incluye "Todos" primero', () => {
    expect(CATEGORIAS[0]).toBe('Todos');
    expect(CATEGORIAS.length).toBeGreaterThan(3);
  });
});
