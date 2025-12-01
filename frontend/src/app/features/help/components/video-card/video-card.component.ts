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
    // Si el videoUrl es de YouTube, reproducir en la tarjeta
    if (this.videoUrl && this.videoUrl.includes('youtube.com')) {
      this.showVideo = true;
    } else if (this.videoUrl) {
      // Si es otra URL, abrir en nueva pestaña
      window.open(this.videoUrl, '_blank');
    }
  }

  openInYouTube(): void {
    // Extraer el ID del video de YouTube y abrir en nueva pestaña
    if (this.videoUrl) {
      let youtubeUrl = this.videoUrl;
      
      // Si es una URL de embed, convertirla a URL normal de YouTube
      if (this.videoUrl.includes('youtube.com/embed/')) {
        const videoId = this.videoUrl.split('embed/')[1]?.split('?')[0];
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      }
      
      window.open(youtubeUrl, '_blank');
    }
  }
}
