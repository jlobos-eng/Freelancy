import { describe, it, expect } from 'vitest';
import { avatarFallback, avatarFor } from '../avatar.js';

describe('avatar.avatarFallback', () => {
  it('genera URL de ui-avatars con el nombre codificado', () => {
    const url = avatarFallback('Jorge Lobos');
    expect(url).toContain('ui-avatars.com');
    expect(url).toContain(encodeURIComponent('Jorge Lobos'));
  });
  it('usa "User" cuando el nombre es vacío/nulo', () => {
    expect(avatarFallback('')).toContain('name=User');
    expect(avatarFallback(null)).toContain('name=User');
  });
  it('cachea: misma entrada devuelve exactamente la misma URL', () => {
    expect(avatarFallback('Ana')).toBe(avatarFallback('Ana'));
  });
});

describe('avatar.avatarFor', () => {
  it('prefiere avatar_url si existe', () => {
    expect(avatarFor({ avatar_url: 'https://x/y.png' })).toBe('https://x/y.png');
  });
  it('cae al fallback si no hay avatar_url', () => {
    expect(avatarFor({ full_name: 'Carla' })).toContain('ui-avatars.com');
    expect(avatarFor(null)).toContain('name=User');
  });
});
