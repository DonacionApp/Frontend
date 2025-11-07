import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PostUser } from '../../../core/services/posts.service';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss']
})
export class ProfileHeaderComponent {
  @Input() user: PostUser | null = null;
  @Input() postsCount: number = 0;
  @Input() isLoading: boolean = false;
}
