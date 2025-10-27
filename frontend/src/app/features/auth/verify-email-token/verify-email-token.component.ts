import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Componente intermedio que captura el token desde la ruta del enlace del correo
 * y redirige a /auth/verify-email con el token como query param
 */
@Component({
  selector: 'app-verify-email-token',
  standalone: true,
  template: `<div style="text-align: center; padding: 40px;">
    <p>Verificando tu correo electrónico...</p>
    <p style="font-size: 14px; color: #666;">Por favor espera un momento.</p>
  </div>`
})
export class VerifyEmailTokenComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Capturar token desde la ruta (ej: /auth/verify-email-token/:token)
    const token = this.route.snapshot.paramMap.get('token') || this.route.snapshot.queryParamMap.get('token');
    
    console.debug('VerifyEmailTokenComponent: token capturado =', token);
    
    if (token) {
      // Redirigir a /auth/verify-email con el token como query param
      this.router.navigate(['/auth/verify-email'], { 
        queryParams: { token },
        replaceUrl: true 
      });
    } else {
      // Si no hay token, ir directo a la página de verificación manual
      this.router.navigate(['/auth/verify-email'], { replaceUrl: true });
    }
  }
}
