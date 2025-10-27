import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button.component';

const routes: Routes = [
  // Rutas de autenticación existentes (de la rama principal)
  // { path: 'login', component: LoginComponent },
  // { path: 'forgot-password', component: ForgotPasswordComponent },
  // { path: 'reset-password/:token', component: ResetPasswordComponent },
  // { path: 'reset-password-token', component: VerifyResetTokenComponent },
  
  // Rutas de verificación de email (nueva funcionalidad)
  // Las rutas de verificación se manejan en app-routing.module.ts
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    ButtonComponent,
  ],
  providers: [
    // Aquí irán los servicios específicos de autenticación
  ]
})
export class AuthModule { }