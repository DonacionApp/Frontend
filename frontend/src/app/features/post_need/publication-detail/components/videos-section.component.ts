import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface VideoFile {
  url: string;
  name: string;
}

@Component({
  selector: 'app-videos-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Videos</h3>
      <div class="space-y-3">
        <video 
          *ngFor="let video of videos"
          [src]="video.url" 
          controls 
          class="w-full rounded-lg shadow-sm"
          [attr.aria-label]="video.name"
        ></video>
      </div>
    </div>
  `
})
export class VideosSectionComponent {
  @Input() videos: VideoFile[] = [];
}

