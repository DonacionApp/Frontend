import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

const routes: Routes = [
  // Ruta principal - Landing Page
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  
  // Rutas de autenticación (temporales - redirigen a landing page)
  {
    path: 'login',
    redirectTo: '/',
    pathMatch: 'full'
  },
  {
    path: 'register',
    redirectTo: '/',
    pathMatch: 'full'
  },
  
  // Lazy loading para cada módulo de feature
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule)
  },
  
  // Ruta wildcard para 404
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    importProvidersFrom(BrowserModule)
  ]
};
