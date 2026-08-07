import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    grecaptcha?: any;
  }
}

export interface RecaptchaHandlers {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class RecaptchaService {
  private readonly siteKey: string = (environment as any)['recaptchaSiteKey'] || '';
  private readonly scriptId = 'recaptcha-v2-script';
  private readonly onloadCallbackName = 'onRecaptchaApiLoaded';
  private scriptPromise: Promise<boolean> | null = null;

  constructor(private zone: NgZone) {}

  get isEnabled(): boolean {
    return !!this.siteKey && typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  async render(container: HTMLElement, handlers: RecaptchaHandlers): Promise<number | null> {
    if (!this.isEnabled) return null;

    const ready = await this.loadScript();
    if (!ready) return null;

    try {
      return window.grecaptcha.render(container, {
        sitekey: this.siteKey,
        callback: (token: string) => this.zone.run(() => handlers.onToken(token)),
        'expired-callback': () => this.zone.run(() => handlers.onExpired?.()),
        'error-callback': () => this.zone.run(() => handlers.onError?.())
      });
    } catch (err) {
      console.warn('No se pudo montar el widget de reCAPTCHA:', err);
      return null;
    }
  }

  reset(widgetId: number | null): void {
    if (widgetId === null || widgetId === undefined) return;
    if (!window.grecaptcha) return;
    try {
      window.grecaptcha.reset(widgetId);
    } catch (err) {
      console.warn('No se pudo reiniciar el widget de reCAPTCHA:', err);
    }
  }

  private loadScript(): Promise<boolean> {
    if (this.scriptPromise) return this.scriptPromise;

    this.scriptPromise = new Promise<boolean>((resolve) => {
      if (window.grecaptcha && window.grecaptcha.render) {
        resolve(true);
        return;
      }

      (window as any)[this.onloadCallbackName] = () => resolve(true);

      const existing = document.getElementById(this.scriptId);
      if (existing) return;

      const script = document.createElement('script');
      script.id = this.scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?onload=${this.onloadCallbackName}&render=explicit`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.warn('No se pudo cargar el script de reCAPTCHA.');
        this.scriptPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }
}
