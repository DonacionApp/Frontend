import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  // { path: 'register', component: RegisterComponent }
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
  CommonModule,
  RouterModule.forChild(routes),
  LoginComponent, // Importar el componente standalone
  ForgotPasswordComponent // componente standalone placeholder
  ],
  providers: [
    // Aquí irán los servicios específicos de autenticación
  ]
})
export class AuthModule { }