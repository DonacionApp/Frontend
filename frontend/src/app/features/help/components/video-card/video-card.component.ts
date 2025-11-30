import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-card.component.html',
  host: { 'class': 'block h-full' }
})
export class VideoCardComponent implements OnInit {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() videoUrl: string = '';
  @Input() thumbnailUrl: string = '';

  showVideo: boolean = false;
  safeVideoUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    if (this.videoUrl) {
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.videoUrl);
    }
  }

  playVideo(): void {
    this.showVideo = true;
  }
}
