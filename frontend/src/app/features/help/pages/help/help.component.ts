import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VideoCardComponent } from '../../components/video-card/video-card.component';

interface Video {
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterModule, VideoCardComponent],
  templateUrl: './help.component.html'
})
export class HelpComponent {
  activeTab: 'donor' | 'organization' = 'donor';

  donorVideos: Video[] = [
    {
      title: 'Introducción a DonacionApp',
      description: 'Conoce las funcionalidades principales de la plataforma y cómo puedes hacer la diferencia donando.',
      videoUrl: 'https://www.youtube.com/embed/K9yV3ZcMS-w',
      thumbnailUrl: 'https://img.youtube.com/vi/K9yV3ZcMS-w/maxresdefault.jpg'
    },
    {
      title: 'Crear tu cuenta como donante',
      description: 'Como crear y verificar tu cuenta como donante.',
      videoUrl: 'https://www.youtube.com/embed/tT4ctZrRk8Y',
      thumbnailUrl: 'https://img.youtube.com/vi/tT4ctZrRk8Y/maxresdefault.jpg'
    },
    {
      title: 'Configurar tu perfil',
      description: 'Configuracion de tu perfil',
      videoUrl: '#',
      thumbnailUrl: '#'
    }
  ];

  orgVideos: Video[] = [
    {
      title: 'Crear Publicación',
      description: 'Como crear un publicación para solicitar donaciones de alimentos o recursos.',
      videoUrl: 'https://www.youtube.com/embed/Bjp5jAtR_3g',
      thumbnailUrl: 'https://img.youtube.com/vi/Bjp5jAtR_3g/maxresdefault.jpg'
    },
    {
      title: 'Chat en linea',
      description: 'Chat en linea',
      videoUrl: '#',
      thumbnailUrl: '#'
    },
    {
      title: 'Gestión de donaciones recibidas',
      description: 'El proceso correcto para confirmar la recepción de donaciones y generar confianza.',
      videoUrl: '#',
      thumbnailUrl: 'https://img.youtube.com/vi/K9yV3ZcMS-w/maxresdefault.jpg'
    }
  ];

  constructor() {}

  setActiveTab(tab: 'donor' | 'organization'): void {
    this.activeTab = tab;
  }
}
