import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom sayfa kaydırmayı bilmez; ekran değişince çağrıldığını testler bununla görür.
window.scrollTo = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
