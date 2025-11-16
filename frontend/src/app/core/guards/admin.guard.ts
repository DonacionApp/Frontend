import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService, User } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    // Verificar primero de forma síncrona para respuesta inmediata
    const user = this.authService.currentUserValue;

    if (!this.authService.isAuthenticated() || !user) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    if (user.role === 'admin') {
      return true;
    }

    // Si no es admin, verificar reactivamente por si el estado cambia
    return this.authService.currentUser$.pipe(
      take(1),
      map((currentUser: User | null) => {
        if (!currentUser) {
          this.router.navigate(['/auth/login'], { 
            queryParams: { returnUrl: state.url } 
          });
          return false;
        }

        if (currentUser.role === 'admin') {
          return true;
        }

        // Si no es admin, redirigir a página de acceso denegado
        this.router.navigate(['/access-denied'], {
          queryParams: { 
            requiredRole: 'Administrador',
            currentRole: this.getRoleDisplayName(currentUser.role),
            attemptedUrl: state.url
          }
        });
        return false;
      })
    );
  }

  private getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'admin': 'Administrador',
      'donor': 'Donante',
      'organization': 'Organización'
    };
    return roleNames[role] || role;
  }
}