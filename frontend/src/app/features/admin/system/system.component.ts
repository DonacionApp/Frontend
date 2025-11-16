import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SystemService, UpdateSystemContentDTO } from '../../../core/services/system.service';

@Component({
  selector: 'app-system',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './system.component.html',
  styleUrls: ['./system.component.scss']
})
export class SystemComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Estado de carga
  loadingPolicies = false;
  loadingTerms = false;
  loadingAboutUs = false;
  savingPolicies = false;
  savingTerms = false;
  savingAboutUs = false;

  // Contenido actual
  policiesContent = '';
  termsContent = '';
  aboutUsContent = '';

  // Formularios
  policiesForm!: FormGroup;
  termsForm!: FormGroup;
  aboutUsForm!: FormGroup;

  // Pestaña activa
  activeTab: 'policies' | 'terms' | 'about-us' = 'policies';

  // Mensajes de error
  errorMessage = '';

  constructor(
    private systemService: SystemService,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadAllContent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    this.policiesForm = this.fb.group({
      content: ['', [Validators.required]]
    });

    this.termsForm = this.fb.group({
      content: ['', [Validators.required]]
    });

    this.aboutUsForm = this.fb.group({
      content: ['', [Validators.required]]
    });
  }

  /**
   * Cargar todo el contenido del sistema
   */
  loadAllContent(): void {
    this.loadPolicies();
    this.loadTerms();
    this.loadAboutUs();
  }

  /**
   * Cambiar pestaña activa
   */
  switchTab(tab: 'policies' | 'terms' | 'about-us'): void {
    this.activeTab = tab;
    this.errorMessage = '';
  }

  /**
   * Cargar políticas
   */
  loadPolicies(): void {
    this.loadingPolicies = true;
    this.errorMessage = '';

    this.systemService.getPolicies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.policiesContent = response.policies || '';
          this.policiesForm.patchValue({ content: this.policiesContent });
          this.loadingPolicies = false;
        },
        error: (error) => {
          console.error('Error loading policies:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar las políticas';
          alert(`Error: ${errorMessage}`);
          this.loadingPolicies = false;
        }
      });
  }

  /**
   * Guardar políticas
   */
  savePolicies(): void {
    if (this.policiesForm.invalid) {
      this.policiesForm.markAllAsTouched();
      return;
    }

    this.savingPolicies = true;
    this.errorMessage = '';

    const data: UpdateSystemContentDTO = {
      content: this.policiesForm.value.content
    };

    this.systemService.updatePolicies(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.policiesContent = response.policies;
          alert('Políticas actualizadas correctamente');
          this.savingPolicies = false;
        },
        error: (error) => {
          console.error('Error saving policies:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron actualizar las políticas';
          alert(`Error: ${errorMessage}`);
          this.savingPolicies = false;
        }
      });
  }

  /**
   * Cargar términos y condiciones
   */
  loadTerms(): void {
    this.loadingTerms = true;
    this.errorMessage = '';

    this.systemService.getTerms()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.termsContent = response.terms || '';
          this.termsForm.patchValue({ content: this.termsContent });
          this.loadingTerms = false;
        },
        error: (error) => {
          console.error('Error loading terms:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los términos y condiciones';
          alert(`Error: ${errorMessage}`);
          this.loadingTerms = false;
        }
      });
  }

  /**
   * Guardar términos y condiciones
   */
  saveTerms(): void {
    if (this.termsForm.invalid) {
      this.termsForm.markAllAsTouched();
      return;
    }

    this.savingTerms = true;
    this.errorMessage = '';

    const data: UpdateSystemContentDTO = {
      content: this.termsForm.value.content
    };

    this.systemService.updateTerms(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.termsContent = response.terms;
          alert('Términos y condiciones actualizados correctamente');
          this.savingTerms = false;
        },
        error: (error) => {
          console.error('Error saving terms:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron actualizar los términos y condiciones';
          alert(`Error: ${errorMessage}`);
          this.savingTerms = false;
        }
      });
  }

  /**
   * Cargar información "Acerca de Nosotros"
   */
  loadAboutUs(): void {
    this.loadingAboutUs = true;
    this.errorMessage = '';

    this.systemService.getAboutUs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.aboutUsContent = response.aboutUs || '';
          this.aboutUsForm.patchValue({ content: this.aboutUsContent });
          this.loadingAboutUs = false;
        },
        error: (error) => {
          console.error('Error loading about us:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo cargar la información "Acerca de Nosotros"';
          alert(`Error: ${errorMessage}`);
          this.loadingAboutUs = false;
        }
      });
  }

  /**
   * Guardar información "Acerca de Nosotros"
   */
  saveAboutUs(): void {
    if (this.aboutUsForm.invalid) {
      this.aboutUsForm.markAllAsTouched();
      return;
    }

    this.savingAboutUs = true;
    this.errorMessage = '';

    const data: UpdateSystemContentDTO = {
      content: this.aboutUsForm.value.content
    };

    this.systemService.updateAboutUs(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.aboutUsContent = response.aboutUs;
          alert('Información "Acerca de Nosotros" actualizada correctamente');
          this.savingAboutUs = false;
        },
        error: (error) => {
          console.error('Error saving about us:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar la información "Acerca de Nosotros"';
          alert(`Error: ${errorMessage}`);
          this.savingAboutUs = false;
        }
      });
  }
}

