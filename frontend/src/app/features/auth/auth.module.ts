import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyResetTokenComponent } from './verify-reset-token/verify-reset-token.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { RegisterUserComponent } from './register-user/register-user.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },
  { path: 'reset-password-token', component: VerifyResetTokenComponent },
  {path: 'register-user', component: RegisterUserComponent}
  // { path: 'register', component: RegisterComponent }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    LoginComponent, // import as standalone (if component is standalone)
    ButtonComponent,
  ForgotPasswordComponent, // componente standalone placeholder
  ResetPasswordComponent,
  VerifyResetTokenComponent,
  RegisterUserComponent
  ],
  providers: [
    // Aquí irán los servicios específicos de autenticación
  ]
})
export class AuthModule { }