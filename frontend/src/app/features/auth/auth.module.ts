import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // { path: 'register', component: RegisterComponent },
  // { path: 'forgot-password', component: ForgotPasswordComponent }
];

@NgModule({
  declarations: [
    // Los componentes standalone no se declaran aquí
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    LoginComponent // Importar el componente standalone
  ],
  providers: [
    // Aquí irán los servicios específicos de autenticación
  ]
})
export class AuthModule { }