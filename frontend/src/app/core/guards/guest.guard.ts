import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Si el usuario NO está autenticado, permitir acceso
    if (!this.authService.isAuthenticated()) {
      return true;
    }

    // Si el usuario está autenticado, redirigir según su rol
    const user = this.authService.currentUserValue;
    
    if (user?.role === 'organization') {
      this.router.navigate(['/organization']);
    } else if (user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (user?.role === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      // Fallback: redirigir al home
      this.router.navigate(['/']);
    }
    
    return false;
  }
}

