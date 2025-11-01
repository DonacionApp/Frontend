import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access-denied.component.html',
  styleUrls: ['./access-denied.component.scss']
})
export class AccessDeniedComponent implements OnInit {
  requiredRole: string = '';
  currentRole: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.requiredRole = params['requiredRole'] || 'específico';
      this.currentRole = params['currentRole'] || 'actual';
    });
  }

  goToHome(): void {
    const user = this.authService.currentUserValue;
    
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    // Redirigir según el rol del usuario
    switch (user.role) {
      case 'admin':
        this.router.navigate(['/admin']);
        break;
      case 'donor':
        this.router.navigate(['/donor/profile']);
        break;
      case 'organization':
        this.router.navigate(['/organization/profile']);
        break;
      default:
        this.router.navigate(['/']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
