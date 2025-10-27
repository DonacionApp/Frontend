import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
// ButtonComponent import removed because it's not used in this template
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { OrganizationRegistrationService } from '../../../core/services';
import { RegistrationStateService } from '../../../core/services/registration-state.service';
import { HttpEventType } from '@angular/common/http';

type UploadFile = {
  file: File;
  name: string;
  progress: number;
  error?: string | null;
};

@Component({
  selector: 'app-organization-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-3xl">
        <h2 class="text-center text-3xl font-bold text-gray-900 mb-4">Crear Cuenta - Organización</h2>
        <p class="text-center text-sm text-gray-600 mb-6">Únete a nuestra comunidad de donantes y organizaciones</p>

        <div class="bg-white py-6 px-6 shadow sm:rounded-lg">
          <!-- Wizard steps -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex-1 text-center" [class.font-bold]="step===1">1. Datos</div>
            <div class="flex-1 text-center" [class.font-bold]="step===2">2. Ubicación</div>
            <div class="flex-1 text-center" [class.font-bold]="step===3">3. Documentos</div>
          </div>

          <form [formGroup]="orgForm" (ngSubmit)="onSubmit()">
            <div *ngIf="step===1">
              <label class="block text-sm font-medium text-gray-700">Nombre de la Organización *</label>
              <input formControlName="organizationName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />

              <label class="block text-sm font-medium text-gray-700 mt-4">Correo Electrónico *</label>
              <input formControlName="email" type="email" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />

              <div class="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Contraseña *</label>
                  <input formControlName="password" type="password" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Confirmar Contraseña *</label>
                  <input formControlName="confirmPassword" type="password" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                </div>
              </div>

                <label class="block text-sm font-medium text-gray-700 mt-4">Descripción</label>
                <textarea formControlName="description" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"></textarea>

                <div class="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Fecha de Constitución / Nacimiento</label>
                    <input formControlName="birdthDate" type="date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700">Tipo de Documento</label>
                    <select formControlName="tipodDni" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                      <option [value]="1">NIT</option>
                      <option [value]="2">Cédula</option>
                      <option [value]="3">Pasaporte</option>
                    </select>
                  </div>
                </div>

                <label class="block text-sm font-medium text-gray-700 mt-4">Documento (DNI / NIT) (opcional)</label>
                <input formControlName="dni" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>

            <div *ngIf="step===2">
              <label class="block text-sm font-medium text-gray-700">País *</label>
              <select formControlName="countryIso" (change)="onCountryChange($any($event.target).value)" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <option value="">Seleccione país</option>
                <option *ngFor="let c of countries" [value]="c.iso2">{{ c.name }} ({{ c.iso2 }})</option>
              </select>

              <label class="block text-sm font-medium text-gray-700 mt-4">Estado/Provincia *</label>
              <select formControlName="stateIso" (change)="onStateChange($any($event.target).value)" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <option value="">Seleccione estado</option>
                <option *ngFor="let s of states" [value]="s.iso2">{{ s.name }} ({{ s.iso2 }})</option>
              </select>

              <label class="block text-sm font-medium text-gray-700 mt-4">Ciudad *</label>
              <select formControlName="cityName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <option value="">Seleccione ciudad</option>
                <option *ngFor="let city of cities" [value]="city.name">{{ city.name }}</option>
              </select>

              <label class="block text-sm font-medium text-gray-700 mt-4">Dirección *</label>
              <input formControlName="address" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>

            <div *ngIf="step===3">
              <label class="block text-sm font-medium text-gray-700">Teléfono de Contacto *</label>
              <input formControlName="phone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />

              <label class="block text-sm font-medium text-gray-700 mt-4">Sitio web (opcional)</label>
              <input formControlName="website" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />

              <label class="block text-sm font-medium text-gray-700 mt-4">Documentos de soporte (PDF/JPG, máximo 5MB cada uno)</label>
              <input type="file" (change)="onFilesSelected($event)" multiple class="mt-2" />

              <div *ngIf="uploadFiles.length" class="mt-4 space-y-2">
                <div *ngFor="let f of uploadFiles" class="p-2 border rounded">
                  <div class="flex justify-between items-center">
                    <div class="truncate">{{ f.name }}</div>
                    <div class="text-sm text-red-600" *ngIf="f.error">{{ f.error }}</div>
                  </div>
                  <div class="w-full bg-gray-200 rounded h-2 mt-2">
                    <div [style.width.%]="f.progress" class="bg-green-500 h-2 rounded"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-between">
              <button type="button" class="px-4 py-2 bg-gray-200 rounded" (click)="prev()" [disabled]="step===1">Anterior</button>
              <div class="flex gap-2">
                <button type="button" class="px-4 py-2 bg-blue-500 text-white rounded" *ngIf="step<3" (click)="next()" [disabled]="!canProceed()">Siguiente</button>
                <button type="submit" class="px-4 py-2 bg-orange-500 text-white rounded" *ngIf="step===3" [disabled]="isSubmitting">Registrar Organización</button>
              </div>
            </div>
          </form>

          <div *ngIf="message" class="mt-4 p-3 rounded" [ngClass]="{'bg-green-50 text-green-800': success, 'bg-red-50 text-red-800': !success}">
            {{ message }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class OrganizationRegisterComponent implements OnInit {
  step = 1;
  orgForm: any;

  countries: Array<any> = [];
  states: Array<any> = [];
  cities: Array<any> = [];

  uploadFiles: UploadFile[] = [];
  allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  maxFileSize = 5 * 1024 * 1024; // 5MB

  isSubmitting = false;
  message: string | null = null;
  success = false;

  constructor(
    private fb: FormBuilder,
    private regService: OrganizationRegistrationService,
    private router: Router,
    private state: RegistrationStateService
  ) {
    // Inicializar formulario en el constructor para evitar usar this.fb antes de la inicialización
    this.orgForm = this.fb.group({
      organizationName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      description: [''],
      countryIso: [''],
      stateIso: [''],
      cityName: [''],
      address: ['', Validators.required],
      phone: ['', Validators.required],
  // Campos requeridos por el backend (dni ahora opcional)
  birdthDate: ['', Validators.required],
  tipodDni: [1, Validators.required],
  dni: [''],
      website: ['']
    });
  }

  private formatDateToDdMmYyyy(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    // dateStr expected in 'YYYY-MM-DD' from <input type="date">; convert to 'DD-MM-YYYY'
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }

  ngOnInit(): void {
    this.loadCountries();
  }

  loadCountries(): void {
    this.regService.getCountries().subscribe({
      next: (res: any[]) => this.countries = res || [],
      error: () => this.countries = []
    });
  }

  onCountryChange(iso: string): void {
    this.orgForm.patchValue({ countryIso: iso, stateIso: '', cityName: '' });
    if (iso) {
      this.regService.getStates(iso).subscribe({ next: (s: any[]) => this.states = s || [], error: () => this.states = [] });
    } else {
      this.states = [];
      this.cities = [];
    }
  }

  onStateChange(isoState: string): void {
    const isoCountry = this.orgForm.value.countryIso;
    this.orgForm.patchValue({ stateIso: isoState, cityName: '' });
    if (isoCountry && isoState) {
      this.regService.getCities(isoCountry, isoState).subscribe({ next: (c: any[]) => this.cities = c || [], error: () => this.cities = [] });
    } else {
      this.cities = [];
    }
  }

  onFilesSelected(event: any): void {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fileMeta: UploadFile = { file: f, name: f.name, progress: 0, error: null };
      const valid = this.validateFile(fileMeta);
      if (valid) {
        this.uploadFiles.push(fileMeta);
      } else {
        // push with error so UI shows it
        this.uploadFiles.push(fileMeta);
      }
    }
  }

  validateFile(f: UploadFile): boolean {
    if (f.file.size > this.maxFileSize) {
      f.error = 'Archivo demasiado grande (máx 5MB).';
      return false;
    }
    if (!this.allowedTypes.includes(f.file.type)) {
      f.error = 'Tipo de archivo no permitido.';
      return false;
    }
    f.error = null;
    return true;
  }

  removeFile(idx: number): void {
    this.uploadFiles.splice(idx, 1);
  }

  canProceed(): boolean {
    if (this.step === 1) {
      return !!(this.orgForm.get('organizationName') && this.orgForm.get('organizationName').valid && this.orgForm.get('email') && this.orgForm.get('email').valid && this.orgForm.get('password') && this.orgForm.get('password').valid && this.orgForm.get('confirmPassword') && this.orgForm.get('confirmPassword').valid);
    }
    if (this.step === 2) {
      return !!(this.orgForm.get('countryIso')?.value && this.orgForm.get('stateIso')?.value && this.orgForm.get('cityName')?.value && this.orgForm.get('address') && this.orgForm.get('address').valid);
    }
    return true;
  }

  next(): void {
    if (this.canProceed()) this.step++;
  }

  prev(): void {
    if (this.step > 1) this.step--;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    // Basic password confirm
    if (this.orgForm.value.password !== this.orgForm.value.confirmPassword) {
      this.message = 'Las contraseñas no coinciden';
      this.success = false;
      return;
    }

    // Validate files before sending
    const invalid = this.uploadFiles.find(f => !!f.error);
    if (invalid) {
      this.message = 'Corrija los archivos antes de continuar.';
      this.success = false;
      return;
    }

    // Coerce/format fields to match backend expectations
    const tipod = Number(this.orgForm.value.tipodDni) || 1;
    const birdth = this.formatDateToDdMmYyyy(this.orgForm.value.birdthDate);

    const payload = {
      username: this.orgForm.value.organizationName,
      email: this.orgForm.value.email,
      password: this.orgForm.value.password,
      // El backend espera el id de rol para organización. Usamos 3 según el formato del backend.
      rolId: 3,
      profilePhoto: this.orgForm.value.website || '',
      people: {
        name: this.orgForm.value.organizationName,
        birdthDate: birdth || '',
        tipodDni: tipod,
        dni: this.orgForm.value.dni || '',
        residencia: this.orgForm.value.address,
        telefono: this.orgForm.value.phone,
        supportId: '',
        municipio: {
          pais: { iso2: this.orgForm.value.countryIso },
          state: { iso2: this.orgForm.value.stateIso },
          city: { name: this.orgForm.value.cityName }
        }
      }
    };

    this.isSubmitting = true;
    this.message = null;

    // Si no hay archivos, el backend probablemente espera JSON puro.
    if (!this.uploadFiles.length) {
      this.regService.registerOrganizationJson(payload).subscribe({
        next: (res: any) => {
          // Respuesta esperada: 201 o body con estado 'pending'
          this.success = true;
          if (res?.status === 'pending' || res?.message?.toLowerCase?.().includes('pending')) {
            this.message = 'Registro recibido. Su organización está en estado "pendiente". Le guiaremos al panel de verificación.';
          } else {
            this.message = res?.message || 'Registro completado.';
          }
          this.state.setSuccessMessage(this.message || '');
          setTimeout(() => this.router.navigate(['/verification']), 1500);
          this.isSubmitting = false;
        },
        error: (err: any) => {
          this.isSubmitting = false;
          this.success = false;
          // Mostrar mensajes del backend si existen
          if (err?.status === 400) {
            // backend puede devolver un array o string de errores
            const body = err.error;
            if (typeof body === 'string') {
              this.message = body;
            } else if (body?.message) {
              this.message = body.message;
            } else if (Array.isArray(body)) {
              this.message = body.join(',');
            } else {
              this.message = 'Datos inválidos. Revise el formulario.';
            }
          } else if (err?.status === 409) {
            this.message = err.error?.message || 'Ya existe una cuenta con esos datos.';
          } else {
            this.message = 'Error del servidor. Intente de nuevo más tarde.';
          }
        }
      });
      return;
    }

    // Si hay archivos, enviar multipart/form-data
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    this.uploadFiles.forEach((uf) => formData.append('files', uf.file, uf.name));

    this.regService.registerOrganization(formData).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          const percent = event.total ? Math.round(100 * (event.loaded / event.total)) : 0;
          this.uploadFiles.forEach(f => f.progress = percent);
        } else if (event.type === HttpEventType.Response) {
          const res = event.body;
          this.success = true;
          this.message = res?.message || 'Registro completado.';
          this.state.setSuccessMessage(this.message || '');
          setTimeout(() => this.router.navigate(['/verification']), 1500);
          this.isSubmitting = false;
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.success = false;
        if (err?.status === 400) {
          this.message = err.error?.message || 'Datos inválidos. Revise el formulario.';
        } else if (err?.status === 409) {
          this.message = err.error?.message || 'Ya existe una cuenta con esos datos.';
        } else {
          this.message = 'Error del servidor. Intente de nuevo más tarde.';
        }
      }
    });
  }

}
