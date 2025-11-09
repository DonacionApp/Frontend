import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class DonorGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.currentUserValue;

    // Verificar si está autenticado
    if (!this.authService.isAuthenticated() || !user) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: state.url } 
      });
      return false;
    }

    // Verificar si tiene rol de donante o admin (los admins pueden acceder a todo)
    if (user.role === 'donor' || user.role === 'admin') {
      return true;
    }

    // Si no es donante ni admin, redirigir a página de acceso denegado
    this.router.navigate(['/access-denied'], {
      queryParams: { 
        requiredRole: 'Donante',
        currentRole: this.getRoleDisplayName(user.role)
      }
    });
    return false;
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
