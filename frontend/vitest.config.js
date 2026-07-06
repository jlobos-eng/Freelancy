// Configuración de Vitest para el frontend.
// Los tests viven junto al código en src/**/__tests__/*.test.js.
// Entorno 'node' porque por ahora probamos lógica pura (utils). Cuando
// agreguemos tests de componentes React, cambiar a 'jsdom' + @testing-library.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    globals: false,
  },
});
