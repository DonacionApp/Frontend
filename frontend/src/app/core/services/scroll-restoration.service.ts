import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollRestorationService {
  private storage = sessionStorage;

  savePosition(key: string, position?: number): void {
    try {
      const pos = typeof position === 'number' ? position : window.pageYOffset;
      this.storage.setItem(key, String(pos));
    } catch (e) {
      // no-op
    }
  }

  restorePosition(key: string, delayMs = 300): void {
    try {
      const saved = this.storage.getItem(key);
      if (!saved) return;

      const top = parseInt(saved, 10);
      // Pequeña espera para asegurar que el DOM esté listo y las listas renderizadas
      setTimeout(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top, behavior: 'auto' });
          this.storage.removeItem(key);
        });
      }, delayMs);
    } catch (e) {
      // no-op
    }
  }
}
