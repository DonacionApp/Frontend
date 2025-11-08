import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from '../button/button.component';

interface Chat {
  id: number;
  name: string;
  lastMessage: string;
  avatar: string;
  unread: number;
  time: string;
  online: boolean;
}

interface QuickAction {
  icon: string;
  label: string;
  count?: number;
  color: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, ButtonComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Output() createPost = new EventEmitter<void>();

  chats: Chat[] = [
    {
      id: 1,
      name: 'María González',
      lastMessage: '¿Todavía tienes la ropa disponible?',
      avatar: 'https://i.pravatar.cc/150?img=1',
      unread: 2,
      time: '10:30',
      online: true
    },
    {
      id: 2,
      name: 'Juan Pérez',
      lastMessage: 'Gracias por la donación!',
      avatar: 'https://i.pravatar.cc/150?img=2',
      unread: 0,
      time: 'Ayer',
      online: false
    },
    {
      id: 3,
      name: 'Fundación Esperanza',
      lastMessage: 'Necesitamos ayuda urgente',
      avatar: 'https://i.pravatar.cc/150?img=3',
      unread: 5,
      time: '2d',
      online: true
    },
    {
      id: 4,
      name: 'Carlos Ruiz',
      lastMessage: '¿Cuándo puedo recoger los artículos?',
      avatar: 'https://i.pravatar.cc/150?img=4',
      unread: 0,
      time: '3d',
      online: false
    },
    {
      id: 5,
      name: 'Ana Torres',
      lastMessage: 'Perfecto, nos vemos mañana',
      avatar: 'https://i.pravatar.cc/150?img=5',
      unread: 1,
      time: '1sem',
      online: true
    }
  ];

  quickActions: QuickAction[] = [
    { icon: 'heart', label: 'Mis donaciones', count: 12, color: 'text-red-500' },
    { icon: 'bookmark', label: 'Guardados', count: 8, color: 'text-blue-500' },
    { icon: 'users', label: 'Organizaciones', color: 'text-green-500' },
    { icon: 'bell', label: 'Notificaciones', count: 3, color: 'text-yellow-500' }
  ];

  onCreatePost(): void {
    this.createPost.emit();
  }

  openChat(chatId: number): void {
    console.log('Opening chat:', chatId);
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
    };
    return icons[icon] || '';
  }
}

