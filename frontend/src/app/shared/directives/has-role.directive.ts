import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

/**
 * Directiva estructural para mostrar/ocultar elementos según roles
 * 
 * Uso:
 * <div *appHasRole="'admin'">Solo admins ven esto</div>
 * <div *appHasRole="['donor', 'organization']">Donantes y organizaciones ven esto</div>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private requiredRoles: string[] = [];
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  @Input()
  set appHasRole(roles: string | string[]) {
    this.requiredRoles = Array.isArray(roles) ? roles : [roles];
    this.updateView();
  }

  ngOnInit(): void {
    // Suscribirse a cambios en el usuario
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateView();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView(): void {
    const user = this.authService.currentUserValue;
    const hasRequiredRole = user && this.requiredRoles.includes(user.role);

    if (hasRequiredRole && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasRequiredRole && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
