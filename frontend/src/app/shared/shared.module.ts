import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { HasRoleDirective } from './directives/has-role.directive';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';
import { ChatsComponent } from './components/chats/chats.component';

/**
 * SharedModule contiene componentes, directivas y pipes reutilizables
 * Se importa en los módulos de features que lo necesiten
 * 
 * Nota: NotificationToastComponent y ToastContainerComponent son standalone
 * y se importan directamente donde se necesiten
 */
@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    SpinnerComponent,
    HasRoleDirective,
    AccessDeniedComponent,
    ChatsComponent
    // Aquí se pueden importar otros módulos compartidos como Material
  ],
  exports: [
    SpinnerComponent,
    HasRoleDirective,
    AccessDeniedComponent,
    ChatsComponent
    // Exportar todo lo que necesiten usar otros módulos
  ]
})
export class SharedModule { }