import { Injectable, ApplicationRef, ComponentRef, createComponent, EnvironmentInjector } from '@angular/core';
import { AlertComponent, AlertConfig } from '../components/alert/alert.component';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private alertComponentRef: ComponentRef<AlertComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  private createAlertComponent(): AlertComponent {
    if (!this.alertComponentRef) {
      // Crear el componente
      this.alertComponentRef = createComponent(AlertComponent, {
        environmentInjector: this.injector
      });

      // Adjuntar a la aplicación
      this.appRef.attachView(this.alertComponentRef.hostView);

      // Añadir al DOM
      const domElem = (this.alertComponentRef.hostView as any).rootNodes[0] as HTMLElement;
      document.body.appendChild(domElem);
    }

    return this.alertComponentRef.instance;
  }

  private destroyAlertComponent(): void {
    if (this.alertComponentRef) {
      this.appRef.detachView(this.alertComponentRef.hostView);
      this.alertComponentRef.destroy();
      this.alertComponentRef = null;
    }
  }

  async confirm(config: AlertConfig): Promise<boolean> {
    const component = this.createAlertComponent();
    const result = await component.show(config);
    
    // Pequeño delay antes de destruir para la animación de salida
    setTimeout(() => {
      this.destroyAlertComponent();
    }, 200);

    return result;
  }

  showLoading(title: string = 'Cargando...', message: string = 'Por favor espera'): void {
    const component = this.createAlertComponent();
    component.showLoading(title, message);
  }

  close(): void {
    if (this.alertComponentRef) {
      this.alertComponentRef.instance.close();
      setTimeout(() => {
        this.destroyAlertComponent();
      }, 200);
    }
  }

  async success(title: string, message: string): Promise<void> {
    await this.confirm({
      title,
      message,
      type: 'success',
      showCancelButton: false,
      confirmButtonText: 'Aceptar'
    });
  }

  async error(title: string, message: string): Promise<void> {
    await this.confirm({
      title,
      message,
      type: 'error',
      showCancelButton: false,
      confirmButtonText: 'Aceptar'
    });
  }

  async warning(title: string, message: string, confirmText: string = 'Sí', cancelText: string = 'No'): Promise<boolean> {
    return await this.confirm({
      title,
      message,
      type: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    });
  }
}
