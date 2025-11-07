import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { VerifyEmailTokenComponent } from './features/auth/verify-email-token/verify-email-token.component';
import { AccessDeniedComponent } from './shared/components/access-denied/access-denied.component';
import { AuthGuard } from './core/guards/auth.guard';
import { DonorGuard } from './core/guards/donor.guard';
import { OrganizationGuard } from './core/guards/organization.guard';
import { AdminGuard } from './core/guards/admin.guard';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  {
    path: 'post', 
    loadChildren:()=>import('./features/post/post.module').then(m=>m.PostModule)
  },
  {
    path: 'profile/:id',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },
  
  // Página de acceso denegado
  { path: 'access-denied', component: AccessDeniedComponent },
  
  // Rutas directas para enlaces de email (sin prefijo /auth)
  { path: 'verify-email-token/:token', component: VerifyEmailTokenComponent },
  { path: 'verify-email-token', component: VerifyEmailTokenComponent },
  { path: 'auth/verify/email-token', component: VerifyEmailTokenComponent }, // Ruta exacta del correo
  
  // Lazy loading para cada módulo de feature
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'donor',
    loadChildren: () => import('./features/donor/donor.module').then(m => m.DonorModule)
    // Los guards se aplican individualmente en donor.module.ts (register sin guard, profile con guards)
  },
  {
    path: 'organization',
    loadChildren: () => import('./features/organization/organization.module').then(m => m.OrganizationModule)
    // Los guards se aplican individualmente en organization.module.ts (register sin guard, profile con guards)
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard, AdminGuard] // Requiere autenticación Y rol de admin
  },
  
  // Ruta wildcard para 404 - redirigir al home
  { path: '**', redirectTo: '/' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }