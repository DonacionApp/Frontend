import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { Component, Inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      [attr.aria-label]="label"
      class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-green-400 hover:text-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      (click)="goBack()"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span class="hidden sm:inline">{{ label }}</span>
    </button>
  `,
})
export class BackButtonComponent {
  @Input() label = 'Regresar';
  @Input() fallbackUrl = '/';
  @Input() forceFallback = false;

  constructor(
    private location: Location,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  goBack(): void {
    const canUseHistory = isPlatformBrowser(this.platformId) && window.history.length > 1;

    if (!this.forceFallback && canUseHistory) {
      this.location.back();
      return;
    }

    this.router.navigateByUrl(this.fallbackUrl || '/');
  }
}
