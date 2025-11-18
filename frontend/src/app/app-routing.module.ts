import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { VerifyEmailTokenComponent } from './features/auth/verify-email-token/verify-email-token.component';
import { AccessDeniedComponent } from './shared/components/access-denied/access-denied.component';
import { AuthGuard } from './core/guards/auth.guard';
import { DonorGuard } from './core/guards/donor.guard';
import { OrganizationGuard } from './core/guards/organization.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { VerifiedGuard } from './core/guards/verified.guard';
import { OwnStatsGuard } from './core/guards/own-stats.guard';
import { NotificationsCenterComponent } from './features/notifications/notifications-center.component';
import { ChatsComponent } from './shared/components/chats/chats.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'post', 
    loadChildren:()=>import('./features/post/post.module').then(m=>m.PostModule)
  },
  {
    path:'chat',
    component:ChatsComponent,
    canActivate:[AuthGuard]
  },
  {
    path: 'profile/:id',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },
  
  // Ruta pública para ver estadísticas de un usuario (protegida con OwnStatsGuard)
  {
    path: 'usuario/:id/stats',
    loadComponent: () => import('./features/profile/public-stats-view/public-stats-view.component').then(m => m.PublicStatsViewComponent),
  },
  
  // Ruta privada para ver las estadísticas propias (con AuthGuard)
  {
    path: 'dashboard/estadisticas',
    loadComponent: () => import('./features/dashboard/stats/stats.component').then(m => m.StatsComponent),
    canActivate: [AuthGuard]
  },
  
  // Página de acceso denegado
  { path: 'access-denied', component: AccessDeniedComponent },
  
  // Rutas directas para enlaces de email (sin prefijo /auth)
  { path: 'verify-email-token/:token', component: VerifyEmailTokenComponent },
  { path: 'verify-email-token', component: VerifyEmailTokenComponent },
  { path: 'auth/verify/email-token', component: VerifyEmailTokenComponent }, // Ruta exacta del correo

  // Ruta de notificaciones (protegida por autenticación)
  { path: 'notifications', component: NotificationsCenterComponent, canActivate: [AuthGuard] },
  
  // Ruta pública para política de privacidad
  { 
    path: 'privacy-policy', 
    loadComponent: () => import('./features/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  
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