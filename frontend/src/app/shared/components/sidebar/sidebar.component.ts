import { Component, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../../core/services/auth.service';
import { AlertService } from '../../services/alert.service';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MessageService } from '../../../core/services/message.service';
import { WebsocketService } from '../../../core/services/websocket.service';

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
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() createPost = new EventEmitter<void>();
  private destroy$ = new Subject<void>();
  
  isAuthenticated = false;
  user: User | null = null;
  chats: Chat[] = [];
  chatCursor: string | null = null;
  loadingChats = false;
  hasMoreChats = true;
  chatsSearch = '';
  private search$ = new Subject<string>();
  showOptions = false;
  optionsStyles: { [key: string]: string } = {};
  @ViewChild('optionsBtn', { read: ElementRef }) optionsBtn?: ElementRef<HTMLButtonElement>;
  private documentClickUnlisten?: () => void;
  private windowUnlisten?: () => void;
  private scrollUnlisten?: () => void;
  
  private overlayEl?: HTMLElement | null = null;
  private overlayListeners: Array<() => void> = [];
  private optionsBtnUnlisten?: () => void;
  private debugDocClickUnlisten?: () => void;
  
  private currentChatOverlayEl?: HTMLElement | null = null;
  private currentChatOverlayListeners: Array<() => void> = [];
  private currentChatDocUnlisten?: () => void;
  private currentChatId?: number;

  quickActions: QuickAction[] = [
    { icon: 'document', label: 'Publicaciones', color: 'text-blue-500' },
    { icon: 'heart', label: 'Mis donaciones', count: 12, color: 'text-red-500' },
    { icon: 'users', label: 'Organizaciones', color: 'text-purple-500' },
    { icon: 'message', label: 'Mensajes', color: 'text-indigo-500' },
    { icon: 'bell', label: 'Notificaciones', count: 3, color: 'text-yellow-500' },
    { icon: 'chart', label: 'Estadísticas', color: 'text-orange-500' }
  ];

  constructor(
    private router: Router,
    public authService: AuthService,
    private alertService: AlertService,
    private messageService: MessageService
    ,
    private websocketService: WebsocketService,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.isAuthenticated = !!user;
        if (this.isAuthenticated) {
          this.loadChats(true);
          try {
            const token = this.authService.getAccessToken();
            if (token && !this.websocketService.isMessageConnected()) {
              try { this.websocketService.connectMessages(token); } catch (e) {}
            }
          } catch (e) {}
          // Subscribe to new chat events to update list in real time
          try {
            this.websocketService.onChatNew().pipe(takeUntil(this.destroy$)).subscribe((payload: any) => {
              try {
                const chat = payload?.chat ?? payload;
                if (!chat || !chat.id) return;
                const cid = Number(chat.id);
                const existingIdx = this.chats.findIndex(c => Number((c as any)?.id) === cid);
                const mapped = {
                  id: cid,
                  name: chat?.chatName ?? chat?.name ?? `Chat ${cid}`,
                  lastMessage: (chat?.lastMessage?.message ?? chat?.lastMessageText ?? '') as string,
                  avatar: chat?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(chat?.chatName ?? (chat?.name || `Chat ${cid}`))}`,
                  unread: Number(chat?.unread ?? 0) || 0,
                  participants: Number(chat?.participants ?? 0) || 0,
                  time: chat?.lastMessageAt ?? chat?.updatedAt ?? chat?.createdAt ?? ''
                } as Chat;

                if (existingIdx > -1) {
                  // Update existing chat and move to top
                  try { this.chats[existingIdx] = { ...(this.chats[existingIdx] as any), ...mapped }; } catch (e) {}
                } else {
                  // Prepend new chat to the list
                  try { this.chats = [mapped, ...this.chats]; } catch (e) {}
                }
              } catch (e) {}
            });
          } catch (e) {}
        } else {
          
          this.chats = [];
          this.chatCursor = null;
          this.hasMoreChats = true;
        }
      });

    
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => {
        this.chatsSearch = q;
        this.chatCursor = null;
        this.hasMoreChats = true;
        this.loadChats(true, false);
      });

  }

  toggleOptions(): void {
    // manual overlay toggle
    if (this.overlayEl) {
      this.destroyOptionsOverlay();
      this.showOptions = false;
      return;
    }

    this.createOptionsOverlay();
    this.showOptions = true;
  }

  ngAfterViewInit(): void {
    
    try {
      const btn = this.optionsBtn?.nativeElement as HTMLElement | undefined;
      if (btn) {
        
        this.debugDocClickUnlisten = this.renderer.listen('document', 'click', (evt: MouseEvent) => {
          try {
            const t = evt.target as Element | null;
            if (!t) return;

            
            const mainBtn = this.optionsBtn?.nativeElement as HTMLElement | undefined;
            if (mainBtn && mainBtn.contains(t)) return;

            
            const tag = (t.tagName || '').toLowerCase();
            const isSvgInner = /^(svg|path|circle|rect|g|use)$/i.test(tag);
            if (!isSvgInner) return;

            const btnEl = (t as Element).closest('[data-sidebar-options-btn]') as HTMLElement | null;
            if (btnEl) Promise.resolve().then(() => this.toggleOptions());
          } catch (e) {
            
          }
        });
      }
    } catch (e) {
      console.error('Error in ngAfterViewInit backup listener', e);
    }
  }

  private destroyOptionsOverlay(): void {
    try {
      if (this.overlayEl) {
        
        this.overlayListeners.forEach(u => { try { u(); } catch (e) { } });
        this.overlayListeners = [];

        
        if (this.overlayEl.parentNode) this.overlayEl.parentNode.removeChild(this.overlayEl);
        this.overlayEl = null;
      }
    } catch (e) {
      console.error('Error destroying options overlay', e);
    }

    if (this.documentClickUnlisten) { try { this.documentClickUnlisten(); } catch (e) { } this.documentClickUnlisten = undefined; }
    if (this.windowUnlisten) { try { this.windowUnlisten(); } catch (e) { } this.windowUnlisten = undefined; }
    if (this.scrollUnlisten) { try { this.scrollUnlisten(); } catch (e) { } this.scrollUnlisten = undefined; }
  }
  private createOptionsOverlay(): void {
    try {
      this.destroyOptionsOverlay();

      const btn = this.optionsBtn?.nativeElement as HTMLElement | undefined;
      const rect = btn ? btn.getBoundingClientRect() : ({ bottom: 60, top: 60, left: window.innerWidth - 80, right: window.innerWidth - 16, width: 32 } as DOMRect);

      const width = 188;
      const caretSize = 8;
      const padding = 6;
      const menuHeightEstimate = 56 + padding * 2;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < menuHeightEstimate && spaceAbove > menuHeightEstimate;

      const container = this.renderer.createElement('div') as HTMLElement;
      this.overlayEl = container;
      this.renderer.setAttribute(container, 'data-debug', 'sidebar-options-overlay');

      this.renderer.setStyle(container, 'position', 'fixed');
      this.renderer.setStyle(container, 'width', `${width}px`);
      this.renderer.setStyle(container, 'z-index', '2147483647');
      this.renderer.setStyle(container, 'background', '#ffffff');
      this.renderer.setStyle(container, 'pointer-events', 'auto');
      this.renderer.setStyle(container, 'border-radius', '8px');
      this.renderer.setStyle(container, 'box-shadow', '0 6px 20px rgba(0,0,0,0.12)');
      this.renderer.setStyle(container, 'outline', '1px solid rgba(14,165,233,0.12)');
      this.renderer.setStyle(container, 'border', '1px solid rgba(0,0,0,0.06)');
      this.renderer.setStyle(container, 'padding', `${padding}px 0`);
      this.renderer.setStyle(container, 'display', 'flex');
      this.renderer.setStyle(container, 'flex-direction', 'column');
      this.renderer.setStyle(container, 'overflow', 'hidden');

      
      const caret = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setStyle(caret, 'width', '0');
      this.renderer.setStyle(caret, 'height', '0');
      this.renderer.setStyle(caret, 'position', 'absolute');

      if (placeAbove) {
        const top = Math.max(8, rect.top - menuHeightEstimate - caretSize - 6);
        this.renderer.setStyle(container, 'top', `${top}px`);
        
        this.renderer.setStyle(caret, 'border-left', `${caretSize}px solid transparent`);
        this.renderer.setStyle(caret, 'border-right', `${caretSize}px solid transparent`);
        this.renderer.setStyle(caret, 'border-top', `${caretSize}px solid #ffffff`);
        this.renderer.setStyle(caret, 'bottom', `-${caretSize}px`);
      } else {
        const top = Math.min(window.innerHeight - 40, rect.bottom + 6);
        this.renderer.setStyle(container, 'top', `${top}px`);
        
        this.renderer.setStyle(caret, 'border-left', `${caretSize}px solid transparent`);
        this.renderer.setStyle(caret, 'border-right', `${caretSize}px solid transparent`);
        this.renderer.setStyle(caret, 'border-bottom', `${caretSize}px solid #ffffff`);
        this.renderer.setStyle(caret, 'top', `-${caretSize}px`);
      }

      
      const btnCenter = rect.left + (rect.width || 32) / 2;
      let left = Math.round(btnCenter - width / 2);
      const margin = 8;
      if (left < margin) left = margin;
      if (left + width + margin > window.innerWidth) left = window.innerWidth - width - margin;
      this.renderer.setStyle(container, 'left', `${left}px`);

      
      const caretLeft = Math.round(btnCenter - left - caretSize);
      this.renderer.setStyle(caret, 'left', `${caretLeft}px`);

      

      this.renderer.appendChild(container, caret);

      
      const makeOption = (text: string, color?: string, onClick?: () => void) => {
        const item = this.renderer.createElement('button') as HTMLButtonElement;
        this.renderer.setProperty(item, 'type', 'button');
        this.renderer.setProperty(item, 'innerHTML', `<span style="font-size:13px;color:${color || '#111'}">${text}</span>`);
        this.renderer.setStyle(item, 'display', 'flex');
        this.renderer.setStyle(item, 'align-items', 'center');
        this.renderer.setStyle(item, 'width', '100%');
        this.renderer.setStyle(item, 'padding', '10px 14px');
        this.renderer.setStyle(item, 'text-align', 'left');
        this.renderer.setStyle(item, 'background', 'transparent');
        this.renderer.setStyle(item, 'border', 'none');
        this.renderer.setStyle(item, 'cursor', 'pointer');
        this.renderer.listen(item, 'mouseenter', () => this.renderer.setStyle(item, 'background', '#f3f4f6'));
        this.renderer.listen(item, 'mouseleave', () => this.renderer.setStyle(item, 'background', 'transparent'));
        const u = this.renderer.listen(item, 'click', (ev: MouseEvent) => { ev.stopPropagation(); if (onClick) onClick(); });
        this.overlayListeners.push(u);
        return item;
      };

      // 'Marcar todos como leídos' removed per UX request

      if (this.authService.currentUserValue?.role === 'admin') {
        const opt2 = makeOption('Crear chat (estático)', '#e11d48', () => this.createStaticChat());
        this.renderer.appendChild(container, opt2);
      }

      
      const opt3 = makeOption('Ver todos los chats', '#0ea5e9', () => this.onMessagesClick());
      this.renderer.appendChild(container, opt3);

      this.renderer.appendChild(document.body, container);

      
      this.documentClickUnlisten = this.renderer.listen('document', 'click', (evt: MouseEvent) => {
        const target = evt.target as Node;
        const btnEl = this.optionsBtn?.nativeElement as HTMLElement | undefined;
        if (btnEl && btnEl.contains(target)) return;
        if (this.overlayEl && this.overlayEl.contains(target)) return;
        this.destroyOptionsOverlay();
        this.showOptions = false;
      });

      this.windowUnlisten = this.renderer.listen('window', 'resize', () => { this.destroyOptionsOverlay(); this.showOptions = false; });
      this.scrollUnlisten = this.renderer.listen('window', 'scroll', () => { this.destroyOptionsOverlay(); this.showOptions = false; });

      
    } catch (e) {
      console.error('Error creating options overlay', e);
    }
  }

  // -------------------- Per-chat floating menu --------------------
  openChatMenu(ev: Event, chatId: number): void {
    ev.stopPropagation();
    // get the button element that was clicked
    const btn = ev.currentTarget as HTMLElement | null;
    const rect = btn ? btn.getBoundingClientRect() : ({ top: 100, left: 100, bottom: 120, width: 32 } as DOMRect);
    this.destroyChatOverlay();
    this.createChatOverlay(chatId, rect);
  }

  private createChatOverlay(chatId: number, rect: DOMRect): void {
    try {
      this.destroyChatOverlay();
      this.currentChatId = chatId;

      const width = 300;
      const padding = 6;

      const container = this.renderer.createElement('div') as HTMLElement;
      this.currentChatOverlayEl = container;
      this.renderer.setAttribute(container, 'data-debug', `chat-menu-${chatId}`);

      this.renderer.setStyle(container, 'position', 'fixed');
      this.renderer.setStyle(container, 'width', `${width}px`);
      this.renderer.setStyle(container, 'z-index', '2147483647');
      this.renderer.setStyle(container, 'background', '#ffffff');
      this.renderer.setStyle(container, 'border-radius', '8px');
      this.renderer.setStyle(container, 'box-shadow', '0 8px 30px rgba(0,0,0,0.12)');
      this.renderer.setStyle(container, 'border', '1px solid rgba(0,0,0,0.06)');
      this.renderer.setStyle(container, 'padding', `${padding}px`);
      this.renderer.setStyle(container, 'display', 'flex');
      this.renderer.setStyle(container, 'flex-direction', 'column');

      // position below the button if space
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < 120 && rect.top > 120;
      if (placeAbove) {
        const top = Math.max(8, rect.top - 140);
        this.renderer.setStyle(container, 'top', `${top}px`);
      } else {
        this.renderer.setStyle(container, 'top', `${rect.bottom + 8}px`);
      }

      let left = Math.round(rect.left + (rect.width || 32) / 2 - width / 2);
      const margin = 8;
      if (left < margin) left = margin;
      if (left + width + margin > window.innerWidth) left = window.innerWidth - width - margin;
      this.renderer.setStyle(container, 'left', `${left}px`);

      // header
      const header = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setStyle(header, 'font-weight', '600');
      this.renderer.setStyle(header, 'font-size', '13px');
      this.renderer.setStyle(header, 'margin-bottom', '8px');
      const chat = this.chats.find(c => c.id === chatId);
      this.renderer.setProperty(header, 'textContent', chat ? chat.name : `Chat ${chatId}`);
      this.renderer.appendChild(container, header);

      // options
      const makeOption = (text: string, color?: string, onClick?: () => void) => {
        const item = this.renderer.createElement('button') as HTMLButtonElement;
        this.renderer.setProperty(item, 'type', 'button');
        this.renderer.setProperty(item, 'innerHTML', `<span style="font-size:13px;color:${color || '#111'}">${text}</span>`);
        this.renderer.setStyle(item, 'display', 'block');
        this.renderer.setStyle(item, 'width', '100%');
        this.renderer.setStyle(item, 'padding', '8px 10px');
        this.renderer.setStyle(item, 'text-align', 'left');
        this.renderer.setStyle(item, 'background', 'transparent');
        this.renderer.setStyle(item, 'border', 'none');
        this.renderer.setStyle(item, 'cursor', 'pointer');
        const u = this.renderer.listen(item, 'click', (ev: MouseEvent) => { ev.stopPropagation(); if (onClick) onClick(); });
        this.currentChatOverlayListeners.push(u);
        return item;
      };

      const optRead = makeOption('Marcar como leído', '#111', () => this.markChatAsRead(chatId));
      this.renderer.appendChild(container, optRead);

      const optShow = makeOption('Ver mensajes', '#0ea5e9', () => {
        // load messages and render into a messages container
        this.messageService.loadMessagesByChat(chatId, { limit: 10 }).subscribe({
          next: (res) => {
            const msgs = Array.isArray(res) ? res as any[] : (res && (res.messages ?? [])) || [];
            // remove existing messages list if any
            const existing = container.querySelector('[data-messages-list]');
            if (existing) existing.remove();
            const list = this.renderer.createElement('div') as HTMLElement;
            this.renderer.setAttribute(list, 'data-messages-list', 'true');
            this.renderer.setStyle(list, 'max-height', '220px');
            this.renderer.setStyle(list, 'overflow', 'auto');
            this.renderer.setStyle(list, 'margin-top', '8px');
            msgs.forEach((m: any) => {
              const row = this.renderer.createElement('div') as HTMLElement;
              this.renderer.setStyle(row, 'padding', '6px 4px');
              this.renderer.setStyle(row, 'border-bottom', '1px solid rgba(0,0,0,0.04)');
              const who = this.renderer.createElement('div') as HTMLElement;
              this.renderer.setStyle(who, 'font-size', '12px');
              this.renderer.setStyle(who, 'font-weight', '600');
              this.renderer.setProperty(who, 'textContent', m?.user?.username ?? m?.user?.email ?? 'Usuario');
              const text = this.renderer.createElement('div') as HTMLElement;
              this.renderer.setStyle(text, 'font-size', '13px');
              this.renderer.setProperty(text, 'textContent', m?.message ?? '');
              this.renderer.appendChild(row, who);
              this.renderer.appendChild(row, text);
              this.renderer.appendChild(list, row);
            });
            this.renderer.appendChild(container, list);
          },
          error: (err) => {
            this.alertService.showAlert('No se pudieron cargar los mensajes.', 'error');
          }
        });
      });
      this.renderer.appendChild(container, optShow);

      this.renderer.appendChild(document.body, container);

      // close on outside click
      this.currentChatDocUnlisten = this.renderer.listen('document', 'click', (evt: MouseEvent) => {
        const target = evt.target as Node;
        if (this.currentChatOverlayEl && this.currentChatOverlayEl.contains(target)) return;
        this.destroyChatOverlay();
      });
    } catch (e) {
      console.error('Error creating chat overlay', e);
    }
  }

  private destroyChatOverlay(): void {
    try {
      if (this.currentChatOverlayEl) {
        this.currentChatOverlayListeners.forEach(u => { try { u(); } catch (e) { } });
        this.currentChatOverlayListeners = [];
        if (this.currentChatOverlayEl.parentNode) this.currentChatOverlayEl.parentNode.removeChild(this.currentChatOverlayEl);
        this.currentChatOverlayEl = null;
        this.currentChatId = undefined;
      }
    } catch (e) {
      console.error('Error destroying chat overlay', e);
    }
    if (this.currentChatDocUnlisten) { try { this.currentChatDocUnlisten(); } catch (e) { } this.currentChatDocUnlisten = undefined; }
  }

  private markChatAsRead(chatId: number): void {
    const prev = this.chats.map(c => ({ ...c }));
    this.chats = this.chats.map(c => c.id === chatId ? { ...c, unread: 0 } : c);
    this.messageService.markChatAsRead(chatId).subscribe({
      next: () => {
        this.alertService.success('Leído', 'El chat se marcó como leído.');
        this.destroyChatOverlay();
      },
      error: (err) => {
        console.error('Error marcando chat como leído:', err);
        this.chats = prev;
        this.alertService.showAlert('No se pudo marcar como leído.', 'error');
        this.destroyChatOverlay();
      }
    });
  }

  // CDK overlay handles creation/attachment of the options template

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.documentClickUnlisten) { try { this.documentClickUnlisten(); } catch (e) { } }
    if (this.windowUnlisten) { try { this.windowUnlisten(); } catch (e) { } }
    if (this.scrollUnlisten) { try { this.scrollUnlisten(); } catch (e) { } }
    if (this.optionsBtnUnlisten) { try { this.optionsBtnUnlisten(); } catch (e) {} }
    if (this.debugDocClickUnlisten) { try { this.debugDocClickUnlisten(); } catch (e) {} }
    this.destroyOptionsOverlay();
  }

  onCreatePost(): void {
    this.createPost.emit();
  }

  onSearchChange(value: string): void {
    this.search$.next(value ?? '');
  }

  onOptionsClick(): void {
    // keep backward-compatible alert placeholder
    this.alertService.showAlert('Aquí aparecerán opciones del panel de mensajes.', 'info');
  }

  async markAllAsRead(): Promise<void> {
    // Optimistic local update: set unread to 0 for all chats
    const prev = this.chats.map(c => ({ ...c }));
    this.chats = this.chats.map(c => ({ ...c, unread: 0 }));
    this.hasMoreChats = false; // no need to load more for unread purposes

    // Call backend endpoint to mark as read when available
    this.messageService.markAllMyChatsAsRead().subscribe({
      next: () => {
        this.alertService.success('Leídos', 'Todos los mensajes se marcaron como leídos.');
        this.destroyOptionsOverlay();
        this.showOptions = false;
      },
      error: (err) => {
        console.error('Error marcando chats como leídos:', err);
        // revert optimistic update
        this.chats = prev;
        this.alertService.showAlert('No se pudieron marcar todos como leídos.', 'error');
        this.destroyOptionsOverlay();
        this.showOptions = false;
      }
    });
  }

  createStaticChat(): void {
    // Only admins can create the static chat; UI already guards but double-check
    if (this.authService.currentUserValue?.role !== 'admin') {
      this.alertService.showAlert('Solo administradores pueden crear chats.', 'warning');
      return;
    }

    const id = Date.now();
    const newChat: Chat = {
      id,
      name: 'Chat estático',
      lastMessage: 'Chat creado (estático)',
      avatar: `https://ui-avatars.com/api/?name=Chat+${id}`,
      unread: 0,
      participants: 1,
      time: new Date().toISOString(),
      online: false
    };

    // Prepend to list so it's visible
    this.chats = [newChat, ...this.chats];
    this.destroyOptionsOverlay();
    this.showOptions = false;
    this.alertService.success('Chat creado', 'Se creó un chat estático localmente.');
  }

  onPostsClick(): void {
    this.router.navigate(['/post']);
  }

  onMyDonationsClick(): void {
    if (this.user?.role === 'organization') {
      this.router.navigate(['/organization']);
    } else if (this.user?.role === 'donor') {
      this.router.navigate(['/organization']);
    } else {
      this.router.navigate(['/post']);
    }
  }

  onDonateClick(): void {
    // Funcionalidad próximamente
    this.alertService.showAlert('Esta funcionalidad estará disponible próximamente.', 'info');
  }

  onOrganizationsClick(): void {
    this.router.navigate(['/organization/list']);
  }

  onMessagesClick(): void {
    this.router.navigate(['/chat']);
  }

  onNotificationsClick(): void {
    this.router.navigate(['/notifications']);
  }

  onStatisticsClick(): void {
    this.router.navigate(['/dashboard/estadisticas']);
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
    console.log('Navigating to chat', chatId);
    this.router.navigate(['/chat'],{ queryParams: { chat: chatId }}  );
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

