import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin globals de Vitest, Testing Library no limpia el DOM solo entre pruebas.
afterEach(() => {
  cleanup();
});

// jsdom no implementa scrollIntoView; Select lo usa para mantener visible la opción activa.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
