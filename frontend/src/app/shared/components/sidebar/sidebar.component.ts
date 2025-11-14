import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../../core/services/auth.service';
import { AlertService } from '../../services/alert.service';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MessageService } from '../../../core/services/message.service';

interface Chat {
  id: number;
  name: string;
  lastMessage: string;
  avatar: string;
  unread: number;
  participants: number;
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
  imports: [CommonModule, RouterModule, ButtonComponent, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Output() createPost = new EventEmitter<void>();
  private destroy$ = new Subject<void>();
  
  isAuthenticated = false;
  user: User | null = null;
  // chat list populated from backend
  chats: Chat[] = [];
  chatCursor: string | null = null;
  loadingChats = false;
  hasMoreChats = true;
  chatsSearch = '';
  private search$ = new Subject<string>();

  quickActions: QuickAction[] = [
    { icon: 'document', label: 'Publicaciones', color: 'text-blue-500' },
    { icon: 'heart', label: 'Mis donaciones', count: 12, color: 'text-red-500' },
    { icon: 'gift', label: 'Donar Artículo', color: 'text-green-500' },
    { icon: 'users', label: 'Organizaciones', color: 'text-purple-500' },
    { icon: 'message', label: 'Mensajes', color: 'text-indigo-500' },
    { icon: 'bell', label: 'Notificaciones', count: 3, color: 'text-yellow-500' },
    { icon: 'chart', label: 'Estadísticas', color: 'text-orange-500' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private alertService: AlertService
    ,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Suscribirse al estado del usuario
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.isAuthenticated = !!user;
        if (this.isAuthenticated) {
          this.loadChats(true);
        } else {
          // clear chats when logged out
          this.chats = [];
          this.chatCursor = null;
          this.hasMoreChats = true;
        }
      });

    // subscribe to live search with debounce
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => {
        this.chatsSearch = q;
        this.chatCursor = null;
        this.hasMoreChats = true;
        this.loadChats(true, false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCreatePost(): void {
    this.createPost.emit();
  }

  onSearchChange(value: string): void {
    this.search$.next(value ?? '');
  }

  onOptionsClick(): void {
    this.alertService.showAlert('Aquí aparecerán opciones del panel de mensajes.', 'info');
  }

  onPostsClick(): void {
    this.router.navigate(['/post']);
  }

  onMyDonationsClick(): void {
    if (this.user?.role === 'organization') {
      this.router.navigate(['/organization']);
    } else if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else {
      this.router.navigate(['/post']);
    }
  }

  onDonateClick(): void {
    // Funcionalidad próximamente
    this.alertService.showAlert('Esta funcionalidad estará disponible próximamente.', 'info');
  }

  onOrganizationsClick(): void {
    // Funcionalidad próximamente
    this.alertService.showAlert('Esta funcionalidad estará disponible próximamente.', 'info');
  }

  onMessagesClick(): void {
    // Funcionalidad próximamente
    this.alertService.showAlert('Esta funcionalidad estará disponible próximamente.', 'info');
  }

  onNotificationsClick(): void {
    this.router.navigate(['/notifications']);
  }

  onStatisticsClick(): void {
    // Funcionalidad próximamente
    this.alertService.showAlert('Esta funcionalidad estará disponible próximamente.', 'info');
  }

  onProfileClick(): void {
    if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (this.user?.role === 'organization') {
      this.router.navigate(['/organization/profile']);
    }
  }

  onQuickActionClick(action: QuickAction): void {
    switch (action.label) {
      case 'Publicaciones':
        this.onPostsClick();
        break;
      case 'Mis donaciones':
        this.onMyDonationsClick();
        break;
      case 'Donar Artículo':
        this.onDonateClick();
        break;
      case 'Organizaciones':
        this.onOrganizationsClick();
        break;
      case 'Mensajes':
        this.onMessagesClick();
        break;
      case 'Notificaciones':
        this.onNotificationsClick();
        break;
      case 'Estadísticas':
        this.onStatisticsClick();
        break;
      default:
        break;
    }
  }

  openChat(chatId: number): void {
    this.router.navigate(['/chat', chatId]);
  }

  formatRelative(dateString?: string): string {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffH = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffH / 24);

    if (diffSec < 60) return 'hace segundos';
    if (diffMin < 60) return `hace ${diffMin}m`;
    if (diffH < 24) return `hace ${diffH}h`;
    if (diffDays <= 2) return diffDays === 1 ? 'ayer' : `hace ${diffDays} días`;

    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    if (d.getFullYear() !== now.getFullYear()) {
      (options as any).year = 'numeric';
    }
    return d.toLocaleDateString('es-ES', options);
  }

  loadChats(initial = true, append = false): void {
    if (!this.user) return;
    if (this.loadingChats) return;
    this.loadingChats = true;
    const limit = 20;
    const params: any = { limit, orderBy: 'lastMessage', order: 'ASC' };
    if (this.chatsSearch && this.chatsSearch.trim()) {
      const q = this.chatsSearch.trim();
      params.searchParam = q;
      params.search = q;
      params.q = q;
    }
    if (!initial && this.chatCursor) params.cursor = this.chatCursor;

    const prevCursor = this.chatCursor;

    this.messageService.getUserMyChats(params).subscribe({
      next: (res) => {
        const items = res?.items ?? res?.data?.items ?? res?.data ?? res;
        const arrayItems = Array.isArray(items) ? items : [];

        const existingIds = new Set(this.chats.map(c => c.id));

        const newRawItems = append ? arrayItems.filter((it: any) => {
          const id = it?.chat?.id ?? it?.id ?? 0;
          return !existingIds.has(id);
        }) : arrayItems;

        // If no new items when appending, stop further loads
        if (append && newRawItems.length === 0) {
          this.hasMoreChats = false;
          this.loadingChats = false;
          return;
        }

        const mapped = newRawItems.map((it: any) => {
          const id = it?.chat?.id ?? it?.id ?? 0;
          const name = it?.chat?.chatName ?? `Chat #${id}`;
          const lastMessage = it?.lastMessage?.message ?? it?.lastMessageText ?? '';
          const time = it?.lastMessageAt ?? it?.updatedAt ?? '';
          const avatar = it?.chat?.userChat?.[0]?.user?.profilePhoto ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
          const unread = Number(it?.unreadCount ?? it?.unread ?? 0) || 0;
          const participants = Number(it?.participantsCount ?? it?.participants ?? 0) || 0;
          const online = false;
          return { id, name, lastMessage, avatar, unread, participants, time, online } as Chat;
        });

        if (append) this.chats = [...this.chats, ...mapped]; else this.chats = mapped;

        // detect next cursor from response
        const resCursor = res?.cursor ?? res?.nextCursor ?? res?.data?.cursor ?? null;
        this.chatCursor = resCursor;

        // If backend didn't return a cursor, try to build one from last item
        if (!this.chatCursor && arrayItems.length > 0) {
          const last = arrayItems[arrayItems.length - 1];
          if (last?.lastMessageAt && last?.id) this.chatCursor = `${last.lastMessageAt}_${last.id}`;
        }

        // If backend returned the same cursor we requested, stop to avoid infinite loop
        if (resCursor && prevCursor && resCursor === prevCursor) {
          this.hasMoreChats = false;
        }

        // If fewer than requested items were returned, likely no more pages
        if (arrayItems.length < limit) {
          this.hasMoreChats = false;
        } else if (!this.chatCursor) {
          // if we couldn't compute a cursor and items == limit, be conservative and allow more loads
          this.hasMoreChats = true;
        }

        this.loadingChats = false;
      },
      error: (err) => {
        console.error('Error cargando chats:', err);
        this.loadingChats = false;
      }
    });
  }

  loadMoreChats(): void {
    if (!this.hasMoreChats || this.loadingChats) return;
    this.loadChats(false, true);
  }

  onSearchChats(): void {
    this.chatCursor = null;
    this.hasMoreChats = true;
    this.loadChats(true, false);
  }

  onChatsScroll(evt: any): void {
    const el = evt.target as HTMLElement;
    if (!el) return;
    const threshold = 120; // px from bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      this.loadMoreChats();
    }
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      gift: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
      bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
      users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      message: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
      bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
    };
    return icons[icon] || '';
  }
}

