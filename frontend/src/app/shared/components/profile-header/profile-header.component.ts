import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostUser } from '../../../core/services/posts.service';
import { UserMinimal } from '../../../core/services/user-profile.service';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss']
})
export class ProfileHeaderComponent {
  @Input() user: PostUser | null = null;
  @Input() minimal: UserMinimal | null = null;
  @Input() postsCount: number = 0;
  @Input() donationsCount: number = 0;
  @Input() isLoading: boolean = false;

  get displayResidence(): string {
    return this.minimal?.residencia || '';
  }

  get displayLocation(): string {
    const city = this.minimal?.municipio?.city?.name;
    const state = this.minimal?.municipio?.state?.name;
    const country = this.minimal?.municipio?.country?.name;
    return [city, state, country].filter(Boolean).join(', ');
  }

  get roleLabel(): string {
    const raw = this.minimal?.rol?.toLowerCase();
    if (!raw) return '';
    if (raw.includes('admin')) return 'Administrador';
    if (raw.includes('organ')) return 'Organización';
    if (raw.includes('don')) return 'Donador';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}
