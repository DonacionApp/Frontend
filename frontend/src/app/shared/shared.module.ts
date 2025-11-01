import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { HasRoleDirective } from './directives/has-role.directive';
import { AccessDeniedComponent } from './components/access-denied/access-denied.component';

/**
 * SharedModule contiene componentes, directivas y pipes reutilizables
 * Se importa en los módulos de features que lo necesiten
 */
@NgModule({
  imports: [
    CommonModule,
    SpinnerComponent,
    HasRoleDirective,
    AccessDeniedComponent
    // Aquí se pueden importar otros módulos compartidos como Material
  ],
  exports: [
    SpinnerComponent,
    HasRoleDirective,
    AccessDeniedComponent
    // Exportar todo lo que necesiten usar otros módulos
  ]
})
export class SharedModule { }