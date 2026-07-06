import { describe, it, expect } from 'vitest';
import { jitterCoord } from '../geo.js';

const LAT = -33.4489, LNG = -70.6693; // Santiago

function metersBetween(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

describe('geo.jitterCoord', () => {
  it('es determinista para el mismo seed', () => {
    const a = jitterCoord(LAT, LNG, 'worker-uuid-1');
    const b = jitterCoord(LAT, LNG, 'worker-uuid-1');
    expect(a).toEqual(b);
  });
  it('distintos seeds dan resultados distintos', () => {
    const a = jitterCoord(LAT, LNG, 'worker-uuid-1');
    const b = jitterCoord(LAT, LNG, 'worker-uuid-2');
    expect(a).not.toEqual(b);
  });
  it('nunca devuelve la coordenada exacta (privacidad)', () => {
    const a = jitterCoord(LAT, LNG, 'worker-uuid-1');
    expect(a.lat === LAT && a.lng === LNG).toBe(false);
  });
  it('respeta el radio máximo (~200m por defecto)', () => {
    for (const seed of ['a','b','c','d','e','xyz','1234','uuid-9999']) {
      const p = jitterCoord(LAT, LNG, seed);
      expect(metersBetween({lat:LAT,lng:LNG}, p)).toBeLessThanOrEqual(205);
    }
  });
  it('devuelve la misma referencia si falta lat/lng', () => {
    expect(jitterCoord(null, LNG, 's')).toEqual({ lat: null, lng: LNG });
    expect(jitterCoord(LAT, null, 's')).toEqual({ lat: LAT, lng: null });
  });
});
