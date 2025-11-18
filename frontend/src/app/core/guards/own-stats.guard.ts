import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class OwnStatsGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const currentUser = this.authService.getCurrentUser();
    
    // Si no está autenticado, redirigir a login
    if (!currentUser) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    // Si es admin, permitir acceso a cualquier estadística
    if (currentUser.role === 'admin') {
      return true;
    }

    const requestedUserId = route.paramMap.get('id');
    const currentUserId = String(currentUser.id);

    // Solo permitir si el ID de la ruta coincide con el usuario actual
    if (requestedUserId !== currentUserId) {
      this.router.navigate(['/access-denied']);
      return false;
    }

    return true;
  }
}
