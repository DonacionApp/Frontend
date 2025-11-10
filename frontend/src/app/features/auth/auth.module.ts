import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyResetTokenComponent } from './verify-reset-token/verify-reset-token.component';
import { EmailVerificationComponent } from './email-verification/email-verification.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { VerifyEmailTokenComponent } from './verify-email-token/verify-email-token.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { RegisterUserComponent } from './register-user/register-user.component';
import { GuestGuard } from '../../core/guards/guest.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [GuestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },
  { path: 'reset-password-token', component: VerifyResetTokenComponent },
  { path: 'email-verification', component: EmailVerificationComponent },
  { path: 'register', component: RegisterUserComponent, canActivate: [GuestGuard] },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'verify/email-token', component: VerifyEmailTokenComponent }, // Ruta exacta del correo
  { path: 'verify-email-token/:token', component: VerifyEmailTokenComponent },
  { path: 'verify-email-token', component: VerifyEmailTokenComponent },
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
  RegisterUserComponent,
  EmailVerificationComponent,
  VerifyEmailComponent
  ],
  providers: [
    // Aquí irán los servicios específicos de autenticación
  ]
})
export class AuthModule { }