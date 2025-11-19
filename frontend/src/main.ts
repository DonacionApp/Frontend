import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppRoutingModule } from './app/app-routing.module';
import { CacheInterceptor } from './app/core/interceptors/cache.interceptor';
import { RetryInterceptor } from './app/core/interceptors/retry.interceptor';
import { AuthInterceptor } from './app/core/interceptors/auth.interceptor';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

// Registrar Chart.js con todos los componentes necesarios
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  DoughnutController
} from 'chart.js';

// Registrar componentes de Chart.js globalmente
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  DoughnutController
);

// Registrar el locale español
registerLocaleData(localeEs);

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    importProvidersFrom(
      BrowserModule,
      HttpClientModule,
      AppRoutingModule
    ),
    { provide: LOCALE_ID, useValue: 'es' },
    // Los interceptores se ejecutan en orden: CacheInterceptor → RetryInterceptor → AuthInterceptor
    // 1. CacheInterceptor: Verifica caché antes de hacer petición real
    // 2. RetryInterceptor: Reintenta en caso de errores de red
    // 3. AuthInterceptor: Agrega token y maneja autenticación
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CacheInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: RetryInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
}).catch(err => console.error(err));
