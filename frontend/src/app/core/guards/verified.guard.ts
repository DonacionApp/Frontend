import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class VerifiedGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Verificar si está autenticado
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    const user = this.authService.currentUserValue;
    
    // Los admins pueden acceder a todo sin verificación
    if (user?.role === 'admin') {
      return true;
    }

    // Verificar si está verificado (para usuarios no admin)
    if (!this.authService.isVerified()) {
      // Redirigir a página de verificación o mostrar mensaje
      if (user?.role === 'organization') {
        this.router.navigate(['/organization/profile'], {
          queryParams: { message: 'Debes verificar tu cuenta para acceder a esta funcionalidad' }
        });
      } else if (user?.role === 'donor') {
        this.router.navigate(['/donor/profile'], {
          queryParams: { message: 'Debes verificar tu cuenta para acceder a esta funcionalidad' }
        });
      } else {
        this.router.navigate(['/access-denied'], {
        queryParams: { 
          reason: 'verification_required',
          message: 'Debes verificar tu cuenta para acceder a esta funcionalidad'
        }
      });
      }
      return false;
    }

    return true;
  }
}

