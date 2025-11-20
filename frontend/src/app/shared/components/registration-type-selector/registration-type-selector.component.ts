import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registration-type-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center mb-6 mt-4">
      <div class="bg-gray-100 rounded-full p-1 flex items-center shadow-sm">
        <button 
          type="button"
          [class]="getButtonClass('donor')"
          (click)="navigateToDonor()"
          [disabled]="currentType === 'donor'">
          Donante
        </button>
        <button 
          type="button"
          [class]="getButtonClass('organization')"
          (click)="navigateToOrganization()"
          [disabled]="currentType === 'organization'">
          Organización
        </button>
      </div>
    </div>
  `,
  styles: [`
    .btn-active {
      @apply px-6 py-2 rounded-full text-sm bg-white shadow-sm font-medium text-gray-900 transition-all;
    }
    .btn-inactive {
      @apply px-6 py-2 rounded-full text-sm text-gray-600 hover:text-gray-900 transition-colors;
    }
    .btn-inactive:disabled {
      @apply cursor-not-allowed opacity-50;
    }
    .btn-inactive:not(:disabled):hover {
      @apply text-gray-900;
    }
  `]
})
export class RegistrationTypeSelectorComponent {
  @Input() currentType: 'donor' | 'organization' = 'donor';

  constructor(private router: Router) {}

  getButtonClass(type: 'donor' | 'organization'): string {
    return this.currentType === type 
      ? 'btn-active' 
      : 'btn-inactive';
  }

  navigateToDonor(): void {
    if (this.currentType !== 'donor') {
      this.router.navigate(['/register/donor']);
    }
  }

  navigateToOrganization(): void {
    if (this.currentType !== 'organization') {
      this.router.navigate(['/register/organization']);
    }
  }
}

