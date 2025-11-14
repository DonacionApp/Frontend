import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { MessageService, IMessage, IChat } from '../../../core/services/message.service';
import { MessagesViewComponent } from './messages-view/messages-view.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, MessagesViewComponent],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.scss']
})
export class ChatsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('messagesView') private messagesView?: MessagesViewComponent;

  private pendingScrollToBottom = false;
  private prevScrollHeight = 0;

  chats: IChat[] = [] as any;
  chatCursor: string | null = null;
  loadingChats = false;
  hasMoreChats = true;
  search = '';
  public search$ = new Subject<string>();

  selectedChat?: IChat | null = null;
  messages: IMessage[] = [];
  messagesCursor: string | null = null;
  loadingMessages = false;
  hasMoreMessages = true;
  messagesPage = 1;
  messagesLimit = 20;
  messagesTotal: number | null = null;
  private _currentMessagesSub: Subscription | null = null;

  newMessage = '';

  currentUserId: string | number | null = null;
  currentUser: any | null = null;

  constructor(private messageService: MessageService, private authService: AuthService) {}

  private _boundGlobalKeydown = (ev: KeyboardEvent) => {
    try {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.selectedChat) {
        this.closeSelectedChat();
      }
    } catch (e) {}
  };

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUserId = u?.id ?? null;
      this.currentUser = u ?? null;
    });

    this.search$
      .pipe(takeUntil(this.destroy$))
      .subscribe(q => {
        this.search = q;
        this.chatCursor = null;
        this.hasMoreChats = true;
        this.loadChats(true);
      });

    this.loadChats(true);
    try { window.addEventListener('keydown', this._boundGlobalKeydown); } catch (e) {}
  }

  isOwnMessage(m: IMessage): boolean {
    if (!m || !m.user) return false;
    const uid = String(this.currentUserId ?? '');
    const mid = String(m.user.id ?? '');
    return uid !== '' && uid === mid;
  }

  loadChats(initial = true, append = false): void {
    if (this.loadingChats) return;
    this.loadingChats = true;
    const limit = 20;
    const params: any = { limit, orderBy: 'chatName', order: 'ASC' };
    if (this.search && this.search.trim()) params.search = this.search.trim();
    if (!initial && this.chatCursor) params.cursor = this.chatCursor;

    const prevCursor = this.chatCursor;

    this.messageService.getUserMyChats(params).subscribe({
      next: (res) => {
        const items = res?.items ?? res?.data?.items ?? res?.data ?? res;
        const arrayItems = Array.isArray(items) ? items : [];
        console.log('Loaded chats:', arrayItems);

        const mapped = arrayItems.map((it: any) => {
          const id = it?.chat?.id ?? it?.id ?? 0;
          const name = it?.chat?.chatName ?? `Chat #${id}`;
          const lastMessage = it?.lastMessage?.message ?? it?.lastMessageText ?? '';
          const time = it?.lastMessageAt ?? it?.updatedAt ?? '';
          const avatar = it?.chat?.userChat?.[0]?.user?.profilePhoto ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
          const unread = Number(it?.unreadCount ?? it?.unread ?? 0) || 0;
          const participants = Number(it?.participantsCount ?? it?.participants ?? 0) || 0;
          return { id, chatName: name, lastMessage, avatar, unread, participants, time } as IChat;
        });

        if (append) this.chats = [...this.chats, ...mapped]; else this.chats = mapped;

        const resCursor = res?.cursor ?? res?.nextCursor ?? res?.data?.cursor ?? null;
        this.chatCursor = resCursor;
        if (!this.chatCursor && arrayItems.length > 0) {
          const last = arrayItems[arrayItems.length - 1];
          if (last?.lastMessageAt && last?.id) this.chatCursor = `${last.lastMessageAt}_${last.id}`;
        }

        if (arrayItems.length < limit) this.hasMoreChats = false; else this.hasMoreChats = !!this.chatCursor || true;
        if (resCursor && prevCursor && resCursor === prevCursor) this.hasMoreChats = false;

        this.loadingChats = false;
      },
      error: () => { this.loadingChats = false; }
    });
  }

  onChatsScroll(e: any): void {
    const el = e.target as HTMLElement;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) this.loadChats(false, true);
  }

  selectChat(chat: IChat): void {
    this.selectedChat = chat;
    this.messages = [];
    this.messagesCursor = null;
    this.hasMoreMessages = true;
    this.loadMessages(chat.id as number, true);
  }

  loadMessages(chatId: number, initial = true, prepend = false): void {
    if (this.loadingMessages) return;
    this.loadingMessages = true;
    const limit = this.messagesLimit;
    const params: any = { limit };

    if (initial) {
      params.order = 'DESC';
      params.page = 1;
    } else if (prepend) {
      params.order = 'DESC';
      if (typeof this.messagesPage === 'number' && this.messagesPage >= 1) {
        params.page = this.messagesPage + 1;
      } else if (this.messages && this.messages.length > 0) {
        const first = this.messages[0];
        if (first?.createdAt && first?.id) params.cursor = `${first.createdAt}_${first.id}`;
      } else if (this.messagesCursor) {
        params.cursor = this.messagesCursor;
      }
    } else {
      params.order = 'ASC';
      if (this.messagesCursor) params.cursor = this.messagesCursor;
    }

    try { this._currentMessagesSub?.unsubscribe(); } catch (e) {}

    this._currentMessagesSub = this.messageService.loadMessagesByChat(chatId, params).subscribe({
      next: (res) => {
        const msgs = Array.isArray(res) ? res as any[] : (res?.messages ?? []);
        const normalize = (list: any[], order: string | undefined) => {
          if (!Array.isArray(list)) return [];
          const ord = (order || '').toString().toUpperCase();
          if (ord === 'DESC') return list.slice().reverse();
          return list.slice();
        };
        const page = (res && typeof res.page === 'number') ? res.page : null;
        const total = (res && typeof res.total === 'number') ? res.total : null;
        const respLimit = (res && typeof res.limit === 'number') ? res.limit : limit;

        if (total !== null) this.messagesTotal = total;
        if (respLimit) this.messagesLimit = respLimit;
        if (page !== null) this.messagesPage = page;

        const dedupe = (listA: any[], listB: any[]) => {
          const seen = new Set(listB.map(i => i?.id).filter(Boolean));
          return listA.filter(i => i && !seen.has(i.id));
        };

        if (initial) {
          const normalized = normalize(msgs, params.order);
          this.messages = normalized;
          if (this.messages.length > 0) {
            const first = this.messages[0];
            if (first?.createdAt && first?.id) this.messagesCursor = `${first.createdAt}_${first.id}`;
          }
          setTimeout(() => {
            try { this.messagesView?.bindMediaLoadHandlers(); } catch (e) {}
            try { this.messagesView?.scrollToBottom(); } catch (e) {}
          }, 50);
        } else if (prepend) {
          const normalized = normalize(msgs, params.order);
          const toAdd = dedupe(normalized, this.messages);
          this.messages = [...toAdd, ...this.messages];
          if (this.messages.length > 0) {
            const first = this.messages[0];
            if (first?.createdAt && first?.id) this.messagesCursor = `${first.createdAt}_${first.id}`;
          }
          setTimeout(() => {
            try { this.messagesView?.bindMediaLoadHandlers(); } catch (e) {}
          }, 50);
        } else {
          const normalized = normalize(msgs, params.order);
          const toAdd = dedupe(normalized, this.messages);
          this.messages = [...this.messages, ...toAdd];
          setTimeout(() => {
            try { this.messagesView?.bindMediaLoadHandlers(); } catch (e) {}
            try { this.messagesView?.scrollToBottom(); } catch (e) {}
          }, 30);
        }

        if (total !== null && page !== null) {
          this.hasMoreMessages = (page * this.messagesLimit) < total;
        } else if (Array.isArray(msgs)) {
          if (msgs.length < this.messagesLimit) this.hasMoreMessages = false;
        }

        if ((!msgs || msgs.length === 0) && !initial) this.hasMoreMessages = false;

        this.loadingMessages = false;
      },
      error: () => { this.loadingMessages = false; }
    });
  }

  onMessagesScroll(e: any): void { return; }

  sendTextMessage(): void {
    if (!this.selectedChat || !this.newMessage || !this.newMessage.trim()) return;
    const fd = new FormData();
    fd.append('chatId', String(this.selectedChat.id));
    fd.append('messageText', this.newMessage.trim());
    fd.append('typeMessageId', '1');

    const tempId = -Date.now();
    const placeholder: any = {
      id: tempId,
      message: this.newMessage.trim(),
      createdAt: new Date().toISOString(),
      user: this.currentUser ? { id: this.currentUser.id, username: this.currentUser.username, profilePhoto: this.currentUser.profilePhoto } : null,
      type: { id: 1, type: 'texto' },
      read: true,
      _optimistic: true
    };

    this.messages = [...this.messages, placeholder];
    this.newMessage = '';
    setTimeout(() => { try { this.messagesView?.bindMediaLoadHandlers(); this.messagesView?.scrollToBottom(); } catch (e) {} }, 50);

    this.messageService.sendMessage(fd).subscribe({
      next: (res) => {
        const serverMsg = (res && Array.isArray(res.messages) && res.messages.length) ? res.messages[0] : (res?.message ?? res?.data ?? res);
        if (serverMsg) {
          if (!serverMsg.user && this.currentUser) {
            serverMsg.user = { id: this.currentUser.id, username: this.currentUser.username, profilePhoto: this.currentUser.profilePhoto };
          }
          this.messages = this.messages.map(m => (m && (m as any).id === tempId) ? serverMsg : m);
        } else {
          this.messages = this.messages.map(m => { if (m && (m as any).id === tempId) { delete (m as any)._optimistic; } return m; });
        }
        setTimeout(() => { try { this.messagesView?.bindMediaLoadHandlers(); this.messagesView?.scrollToBottom(); } catch (e) {} }, 50);
      },
      error: () => {
        this.messages = this.messages.filter(m => !(m && (m as any).id === tempId));
      }
    });
  }

  renderMessageText(m: IMessage): string { return m?.message ?? ''; }

  getChatAvatar(chat: any): string {
    const fromUser = chat?.userChat && chat.userChat.length ? chat.userChat[0]?.user?.profilePhoto : null;
    const fromAvatar = (chat && (chat as any).avatar) ? (chat as any).avatar : null;
    return fromUser || fromAvatar || 'https://i.pravatar.cc/40';
  }

  getChatName(chat: any): string {
    return chat?.chatName ?? chat?.chat?.chatName ?? (chat && (chat as any).chatName) ?? (`Chat ${chat?.id ?? ''}`);
  }

  getChatLastMessage(chat: any): string {
    return chat?.lastMessage ?? (chat && (chat as any).lastMessage) ?? '';
  }

  getChatTime(chat: any): string {
    const t = chat?.time ?? chat?.lastMessageAt ?? chat?.updatedAt ?? null;
    if (!t) return '';
    try {
      const d = new Date(t);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('es-ES');
    } catch (e) {
      return '';
    }
  }

  getMediaList(m: any): string[] {
    if (!m) return [];
    if (Array.isArray(m.files) && m.files.length) {
      return m.files.map((f: any) => {
        if (!f) return '';
        if (typeof f === 'string') return f;
        return f.url ?? f.path ?? f.fileUrl ?? f.name ?? '';
      }).filter((u: string) => !!u);
    }

    if (Array.isArray(m.message) && m.message.length) return m.message.filter((u: any) => !!u).map((u: any) => String(u));

    if (typeof m.message === 'string' && m.message.trim()) return [m.message.trim()];

    return [];
  }

  isMediaMultiple(m: any): boolean {
    const list = this.getMediaList(m);
    return list.length > 1;
  }

  isImageType(m: any): boolean {
    return (m?.type?.type || '').toLowerCase() === 'imagen';
  }

  isVideoType(m: any): boolean { return (m?.type?.type || '').toLowerCase() === 'video'; }

  ngOnDestroy(): void {
    try { window.removeEventListener('keydown', this._boundGlobalKeydown); } catch (e) {}
    this._cleanupSubscriptions();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private closeSelectedChat(): void {
    this.selectedChat = null;
    this.messages = [];
    this.messagesCursor = null;
    this.hasMoreMessages = true;
  }

  private _cleanupSubscriptions(): void {
    try { this._currentMessagesSub?.unsubscribe(); } catch (e) {}
  }
}

