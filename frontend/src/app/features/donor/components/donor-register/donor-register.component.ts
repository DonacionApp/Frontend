import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DonorService, DonorFormData } from '../../../donor/services/donor.service';
import { HierarchicalLocationSelectorComponent, LocationSelection } from '../../../../shared/components/hierarchical-location-selector/hierarchical-location-selector.component';

@Component({
  selector: 'app-donor-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HierarchicalLocationSelectorComponent],
  providers: [DonorService],
  templateUrl: './donor-register.component.html'
})
export class DonorRegisterComponent implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  currentStep = 1;
  totalSteps = 3;
  selectedUserType: 'donor' | null = 'donor';
  selectedFile: File | null = null;
  showPassword = false;
  showConfirmPassword = false;
  locationSelection: LocationSelection = { country: null, state: null, city: null };

  constructor(
    private fb: FormBuilder,
    private donorService: DonorService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]],
      dateOfBirth: ['', [Validators.required, this.minimumAgeValidator(18)]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      city: ['', [Validators.required]],
      country: ['', [Validators.required]],
      state: ['', [Validators.required]],
      postalCode: ['', [Validators.pattern(/^[0-9]+$/), Validators.minLength(4), Validators.maxLength(6)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.minLength(6), Validators.maxLength(12)]],
      profilePhoto: [null],
      acceptTerms: [false, [Validators.requiredTrue]],
      acceptNewsletter: [false]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Establecer valores por defecto con objetos correctos
    this.registerForm.patchValue({
      country: { iso2: 'CO', name: 'Colombia' },
      state: { iso2: 'CO-ANT', name: 'Antioquia' },
      city: { name: 'Medellín' }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    if (confirmPassword && confirmPassword.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }

  minimumAgeValidator(minAge: number) {
    return (control: any) => {
      if (!control.value) {
        return null;
      }
      
      const today = new Date();
      const birthDate = new Date(control.value);
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return { minimumAge: { requiredAge: minAge, actualAge: age - 1 } };
      }
      
      if (age < minAge) {
        return { minimumAge: { requiredAge: minAge, actualAge: age } };
      }
      
      return null;
    };
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const formData = this.registerForm.value;
      
      // 🔍 DEBUG CRÍTICO - Ver qué hay en los campos
      console.log('=== 🔍 DEBUG FRONTEND ===');
      console.log('1. FORM DATA COMPLETO:', formData);
      console.log('2. COUNTRY:', formData.country);
      console.log('3. COUNTRY ISO2:', formData.country?.iso2);
      console.log('4. COUNTRY TYPE:', typeof formData.country);
      console.log('5. STATE:', formData.state);
      console.log('6. CITY:', formData.city);
      console.log('7. LOCATION SELECTION:', this.locationSelection);
      
      // ⚠️ VALIDACIÓN - Si country no tiene iso2, PARAR
      if (!formData.country || !formData.country.iso2) {
        console.error('❌ COUNTRY NO TIENE ISO2 - VALOR:', formData.country);
        alert('Por favor selecciona un país válido del listado');
        this.isLoading = false;
        return;
      }

            // Construir el objeto municipio CORRECTAMENTE con códigos validados
            let stateCode = formData.state?.iso2 || 'ANT';
            
            // Corregir códigos problemáticos
            if (stateCode.startsWith('CO-')) {
              stateCode = stateCode.replace('CO-', '');
              console.log(`🔧 Código de estado corregido en frontend: ${formData.state?.iso2} → ${stateCode}`);
            }
            
            // Validar código de estado (códigos reales del backend)
            const validColombiaStates = ['QUI', 'CUN', 'CHO', 'NSA', 'MET', 'RIS', 'ATL', 'ARA', 'GUA', 'TOL', 'CAU', 'VAU', 'MAG', 'CAL', 'GUV', 'LAG', 'ANT', 'CAQ', 'CAS', 'BOL', 'VID', 'AMA', 'PUT', 'NAR', 'COR', 'CES', 'SAP', 'SAN', 'SUC', 'BOY', 'VAC', 'HUI', 'DC'];
            
            if (!validColombiaStates.includes(stateCode)) {
              console.warn(`⚠️ Código de estado inválido en frontend: ${stateCode}, usando ANT por defecto`);
              stateCode = 'ANT';
            }
            
            const municipioData = {
              pais: {
                iso2: formData.country.iso2, // ⚠️ Esto debe tener valor
                name: formData.country.name
              },
              state: {
                iso2: stateCode, // Código corregido y validado
                name: formData.state?.name || 'Antioquia'
              },
              city: {
                name: formData.city?.name || 'Medellín'
              }
            };

      console.log('8. MUNICIPIO CONSTRUIDO:', municipioData);
      console.log('9. MUNICIPIO.PAIS.ISO2:', municipioData.pais.iso2);

      // Estructurar datos completos del formulario según el formato del backend
      const registerData: DonorFormData = {
        username: formData.email, // Usar email como username
        email: formData.email,
        password: formData.password,
        rolId: 2, // ID del rol de usuario/donante
        profilePhoto: this.selectedFile ? 'https://photo-donor' : undefined,
        people: {
          name: `${formData.firstName} ${formData.lastName}`,
          birdthDate: formData.dateOfBirth,
          tipodDni: 2, // Cédula de Ciudadanía
          dni: formData.dni,
          residencia: formData.address || 'Sin dirección',
          telefono: formData.phone.replace(/\D/g, '').substring(0, 10), // Solo números, máximo 10 caracteres
          supportId: 'https://support-file',
          municipio: municipioData, // Usar municipioData en lugar de municipio
          // Campos adicionales del frontend (NO se envían al backend)
          direccion: formData.address || 'Sin dirección',
          pais: formData.country?.name || 'Colombia',
          departamento: formData.state?.name || 'No especificado',
          ciudad: formData.city?.name || 'No especificada',
          codigoPostal: formData.postalCode || null,
          fotoPerfil: this.selectedFile,
          aceptaTerminos: formData.acceptTerms,
          aceptaNewsletter: formData.acceptNewsletter || false
        }
      };

      console.log('10. DONOR DATA FINAL:', registerData);
      console.log('11. JSON ENVIADO:', JSON.stringify(registerData, null, 2));
      console.log('========================');

      this.donorService.registerDonor(registerData).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          
          // Verificar si es una respuesta real o simulada
          if (response.emailNotification) {
            this.successMessage = '¡Registro exitoso! (Modo simulación - Backend con problemas)';
            console.log('📧 Código de verificación simulado:', response.emailNotification.code);
          } else {
            this.successMessage = '¡Registro exitoso! Revisa tu correo para verificar tu cuenta.';
          }
          
          this.errorMessage = '';
          
          // Log para desarrollo
          console.log('✅ Registro exitoso:', response);
          
          // Redirigir a la pantalla de verificación de correo
          setTimeout(() => {
            this.router.navigate(['/email-verification'], {
              queryParams: { 
                email: formData.email,
                simulated: response.emailNotification ? 'true' : 'false',
                code: response.emailNotification?.code || null
              }
            });
          }, 3000);
        },
        error: (error: any) => {
          this.isLoading = false;
          
          // Log detallado para desarrollo
          console.error('❌ Error en el registro:', {
            error: error,
            status: error.status,
            message: error.message,
            url: error.url,
            timestamp: new Date().toISOString()
          });
          
          // Manejo de errores amigable para el usuario
          let userMessage = '';
          
          if (error.status === 400) {
            // Error de validación
            if (error.error && error.error.message) {
              if (Array.isArray(error.error.message)) {
                userMessage = error.error.message.join(', ');
              } else {
                userMessage = error.error.message;
              }
            } else {
              userMessage = 'Por favor, verifica que todos los campos estén completos correctamente.';
            }
          } else if (error.status === 409) {
            // Conflicto (usuario ya existe)
            userMessage = 'Este email o documento ya está registrado. Por favor, usa otros datos.';
          } else if (error.status === 500) {
            // Error del servidor
            userMessage = 'Error del servidor. Por favor, inténtalo de nuevo en unos minutos.';
          } else if (error.status === 0) {
            // Sin conexión
            userMessage = 'No hay conexión al servidor. Verifica tu conexión a internet.';
          } else {
            // Error genérico
            userMessage = 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';
          }
          
          this.errorMessage = userMessage;
          this.successMessage = '';
          
          // Log adicional para debugging
          console.warn('🔍 Información adicional del error:', {
            userMessage: userMessage,
            originalError: error.error,
            headers: error.headers
          });
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} es requerido`;
      }
      if (field.errors['email']) {
        return 'Email inválido';
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} debe tener al menos ${field.errors['minlength'].requiredLength} caracteres`;
      }
      if (field.errors['maxlength']) {
        return `${this.getFieldLabel(fieldName)} no puede tener más de ${field.errors['maxlength'].requiredLength} caracteres`;
      }
      if (field.errors['pattern']) {
        return `${this.getFieldLabel(fieldName)} tiene un formato inválido`;
      }
      if (field.errors['passwordMismatch']) {
        return 'Las contraseñas no coinciden';
      }
      if (field.errors['min']) {
        return `${this.getFieldLabel(fieldName)} debe ser mayor a ${field.errors['min'].min}`;
      }
      if (field.errors['minimumAge']) {
        return `Debes tener al menos ${field.errors['minimumAge'].requiredAge} años para registrarte`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      firstName: 'Nombre',
      lastName: 'Apellido',
      email: 'Email',
      password: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      phone: 'Teléfono',
      dateOfBirth: 'Fecha de nacimiento',
      address: 'Dirección',
      city: 'Ciudad',
      country: 'País',
      state: 'Estado/Departamento',
      postalCode: 'Código postal',
      dni: 'Documento de identidad',
      profilePhoto: 'Foto de perfil',
      acceptTerms: 'Términos y condiciones'
    };
    return labels[fieldName] || fieldName;
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  getProgressPercentage(): number {
    return (this.currentStep / this.totalSteps) * 100;
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  onUserTypeChange(userType: 'donor'): void {
    this.selectedUserType = userType;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        this.errorMessage = 'Solo se permiten archivos JPG, JPEG y PNG';
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.errorMessage = 'El archivo no puede ser mayor a 5MB';
        return;
      }
      
      this.selectedFile = file;
      this.registerForm.patchValue({ profilePhoto: file });
      this.errorMessage = '';
    }
  }

  removeFile(): void {
    this.selectedFile = null;
    this.registerForm.patchValue({ profilePhoto: null });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onLocationSelectionChange(selection: LocationSelection): void {
    this.locationSelection = selection;
    
    console.log('🔄 Location selection changed:', selection);
    
    // Actualizar el formulario con los objetos completos (no solo nombres)
    this.registerForm.patchValue({
      country: selection.country, // Objeto completo con iso2
      state: selection.state,     // Objeto completo con iso2
      city: selection.city         // Objeto completo con name
    });
    
    console.log('📝 Form updated with:', {
      country: selection.country,
      state: selection.state,
      city: selection.city
    });
  }
}
