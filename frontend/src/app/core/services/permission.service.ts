import { Injectable } from '@angular/core';
import { AuthService, User } from './auth.service';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  
  constructor(private authService: AuthService) {}

  /**
   * Verifica si el usuario actual tiene un rol específico
   */
  hasRole(requiredRole: string | string[]): Observable<boolean> {
    return this.authService.currentUser$.pipe(
      map(user => {
        if (!user) return false;
        
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        return roles.includes(user.role);
      })
    );
  }

  /**
   * Verifica si el usuario actual tiene cualquiera de los roles especificados
   */
  hasAnyRole(roles: string[]): Observable<boolean> {
    return this.authService.currentUser$.pipe(
      map(user => {
        if (!user) return false;
        return roles.includes(user.role);
      })
    );
  }

  /**
   * Verifica si el usuario es administrador
   */
  isAdmin(): Observable<boolean> {
    return this.hasRole('admin');
  }

  /**
   * Verifica si el usuario es donante
   */
  isDonor(): Observable<boolean> {
    return this.hasRole('donor');
  }

  /**
   * Verifica si el usuario es organización
   */
  isOrganization(): Observable<boolean> {
    return this.hasRole('organization');
  }

  /**
   * Obtiene el rol actual del usuario (síncrono)
   */
  getCurrentRole(): string | null {
    const user = this.authService.currentUserValue;
    return user ? user.role : null;
  }

  /**
   * Verifica si el usuario actual tiene un rol específico (síncrono)
   */
  hasRoleSync(requiredRole: string | string[]): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }
}
