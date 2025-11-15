import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { MessageService, IMessage, IChat } from '../../../core/services/message.service';
import { MessagesViewComponent } from './messages-view/messages-view.component';
import { AuthService } from '../../../core/services/auth.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router, ActivatedRoute } from '@angular/router';

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

  selectedFiles: File[] = [];

  readonly MAX_IMAGE_PDF_BYTES = 1 * 1024 * 1024;
  readonly MAX_VIDEO_BYTES = 10 * 1024 * 1024;
  readonly MAX_AUDIO_BYTES = 5 * 1024 * 1024;

  currentUserId: string | number | null = null;
  currentUser: any | null = null;

  private desiredChatId: string | null = null;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private websocketService: WebsocketService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
    , private cd: ChangeDetectorRef
  ) {}

  // Handler para editar mensaje (emitido desde MessagesViewComponent)
  onEditMessage(payload: { id: number; newMessage: string } | any): void {
    try {
      if (!payload || !payload.id) return;
      const id = Number(payload.id);
      const newMessage = String(payload.newMessage || '').trim();
      if (!newMessage) {
        try { this.toastService.error('Error', 'El mensaje no puede estar vacío.'); } catch (e) {}
        return;
      }
      // Actualización optimista en la UI
      try {
        const idx = this.messages.findIndex(m => Number((m as any)?.id) === id);
        if (idx > -1) {
          try { (this.messages[idx] as any).message = newMessage; } catch (e) {}
        }
      } catch (e) {}

      // Emitir la petición al backend via WS (el gateway manejará la actualización y volverá a emitir)
      try { this.websocketService.emitEditMessage(id, this.selectedChat ? Number((this.selectedChat as any).id) : undefined, newMessage); } catch (e) {}
      try { this.toastService.success('Solicitud enviada', 'Se solicitó la edición del mensaje.'); } catch (e) {}
    } catch (e) {}
  }

  // Handler para eliminar mensaje (emitido desde MessagesViewComponent)
  onDeleteMessage(messageId: number | any): void {
    try {
      const id = Number(messageId);
      if (!id) return;
      // Eliminación optimista en la UI
      try { this.messages = this.messages.filter(m => Number((m as any)?.id) !== id); } catch (e) {}
      // Emitir la petición al backend via WS
      try { this.websocketService.emitDeleteMessage(id, this.selectedChat ? Number((this.selectedChat as any).id) : undefined); } catch (e) {}
      try { this.toastService.success('Solicitud enviada', 'Se solicitó la eliminación del mensaje.'); } catch (e) {}
    } catch (e) {}
  }

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

    // Subscribe early to edited/deleted message events so we don't miss edits
    try {
      this.websocketService.onMessageEdited().pipe(takeUntil(this.destroy$)).subscribe(payload => {
        try {
          const chatId = Number(payload?.chatId ?? payload?.chatID ?? payload?.chat_id);
          const msg = payload?.message ?? payload?.msg ?? null;
          if (!chatId || !msg) return;

          if (this.selectedChat && Number(this.selectedChat.id) === chatId) {
            try {
              this.messages = this.messages.map(m => {
                try {
                  if (Number((m as any)?.id) === Number(msg.id)) {
                    return { ...(m as any), message: (msg?.message ?? msg?.msg ?? (m as any).message) } as any;
                  }
                } catch (e) {}
                return m;
              });
              try { this.messagesView?.bindMediaLoadHandlers(); } catch (e) {}
            } catch (e) {}
          } else {
            try {
              this.chats = this.chats.map(c => {
                try {
                  if (Number((c as any)?.id) === chatId) {
                    return { ...(c as any), lastMessage: String(msg?.message ?? (c as any).lastMessage ?? '') } as any;
                  }
                } catch (e) {}
                return c;
              });
            } catch (e) {}
          }
        } catch (e) {}
      });
      } catch (e) {}

      // Subscribe to deletions once (not nested) so we don't miss them
      try {
        this.websocketService.onMessageDeleted().pipe(takeUntil(this.destroy$)).subscribe(payload => {
          try {
            const chatId = Number(payload?.chatId ?? payload?.chatID ?? payload?.chat_id);
            const messageId = Number(payload?.messageId ?? payload?.messageID ?? payload?.message_id ?? payload?.id);
            if (!chatId || !messageId) return;
            if (this.selectedChat && Number(this.selectedChat.id) === chatId) {
              try {
                this.messages = this.messages.filter(m => Number((m as any)?.id) !== messageId);
              } catch (e) {}
              try { this.messagesView?.bindMediaLoadHandlers(); } catch (e) {}
              try { this.cd.detectChanges(); } catch (e) {}
            } else {
              const cidx = this.chats.findIndex(c => Number((c as any)?.id) === chatId);
              if (cidx > -1) {
                try {
                  const lm = (this.chats[cidx] as any).lastMessage;
                  if (lm && typeof lm === 'string' && lm.includes(String(messageId))) {
                    (this.chats[cidx] as any).lastMessage = '';
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
        });
      } catch (e) {}

    this.search$
      .pipe(takeUntil(this.destroy$))
      .subscribe(q => {
        this.search = q;
        this.chatCursor = null;
        this.hasMoreChats = true;
        this.loadChats(true);
      });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(map => {
      const q = map.get('chat');
      if (q) {
        if (!this.selectedChat || String(this.selectedChat.id) !== String(q)) {
          this.desiredChatId = String(q);
          this.chatCursor = null;
          this.hasMoreChats = true;
          this.loadChats(true);
        }
      }
    });

    this.loadChats(true);
    try {
      this.websocketService.onMessageNew().pipe(takeUntil(this.destroy$)).subscribe(payload => {
        try {

          const chatId = Number(payload?.chatId ?? payload?.chatID ?? payload?.chat_id ?? (payload?.message?.chatId));
          let incoming: any[] = [];
    
          if (Array.isArray(payload?.messages)) incoming = payload.messages;
          else if (payload?.message) incoming = Array.isArray(payload.message) ? payload.message : [payload.message];

          if (!isNaN(chatId)) {
            if (this.selectedChat && Number(this.selectedChat.id) === chatId) {
                const existingIds = new Set(this.messages.map(m => m?.id));
                const toAppend: any[] = [];
                incoming.forEach(serverMsg => {
                  try {
                    if (!serverMsg) return;
                    const sid = serverMsg.id;
                    if (sid && existingIds.has(sid)) return;

                    let replaced = false;
                    try {
                      const optIdx = this.messages.findIndex(m => m && (m as any)._optimistic && serverMsg && serverMsg.message && String(m.message) === String(serverMsg.message));
                      if (optIdx !== -1) {
                        this.messages[optIdx] = serverMsg;
                        replaced = true;
                        if (sid) existingIds.add(sid);
                      }
                    } catch (e) {}

                    if (!replaced) {
                      toAppend.push(serverMsg);
                      if (sid) existingIds.add(sid);
                    }
                  } catch (e) {}
                });

                if (toAppend.length > 0) {
                  this.messages = [...this.messages, ...toAppend];
                }
                setTimeout(() => { try { this.messagesView?.bindMediaLoadHandlers(); this.messagesView?.scrollToBottom(); } catch (e) {} }, 40);
            } else {
              const idx = this.chats.findIndex(c => Number((c as any).id) === chatId);
              if (idx > -1) {
                try { (this.chats[idx] as any).unread = ((this.chats[idx] as any).unread || 0) + (Array.isArray(incoming) ? incoming.length : 1); } catch (e) {}
              }
            }
          }
        } catch (e) {}
      });
    } catch (e) {}
    try {
      this.websocketService.onUnreadChats().pipe(takeUntil(this.destroy$)).subscribe(payload => {
        try {
          const cid = String(payload.chatId);
          const idx = this.chats.findIndex(c => String((c as any)?.id) === cid);
          if (idx > -1) {
            (this.chats[idx] as any).unread = Number(payload.unreadInChat || 0);
          } else {
          }
        } catch (e) {}
      });
    } catch (e) {}
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
    if (!initial && !this.hasMoreChats) return;

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

        const mapped = arrayItems.map((it: any) => {
          const id = it?.chat?.id ?? it?.id ?? 0;
          const name = it?.chat?.chatName ?? `Chat #${id}`;
          const lastMessage = it?.lastMessage?.message ?? it?.lastMessageText ?? '';
          const time = it?.lastMessageAt ?? it?.updatedAt ?? it?.createdAt ?? '';
          const avatar = it?.chat?.userChat?.[0]?.user?.profilePhoto ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
          const unread = Number(it?.unreadCount ?? it?.unread ?? 0) || 0;
          const participants = Number(it?.participantsCount ?? it?.participants ?? 0) || 0;
          return { id, chatName: name, lastMessage, avatar, unread, participants, time } as IChat;
        });

        const existingIds = new Set(this.chats.map(c => String((c as any)?.id)));
        const toAdd = mapped.filter(m => m && !existingIds.has(String((m as any).id)));

        if (append) {
          if (toAdd.length > 0) this.chats = [...this.chats, ...toAdd];
        } else {
          this.chats = mapped;
        }

        if (this.desiredChatId) {
          const found = this.chats.find(c => String((c as any)?.id) === String(this.desiredChatId));
          if (found) {
            const sid = this.desiredChatId;
            this.desiredChatId = null;
            try { this.selectChat(found); } catch (e) { this.desiredChatId = sid; }
          }
        }

        let resCursor = res?.cursor ?? res?.nextCursor ?? res?.data?.cursor ?? res?.data?.nextCursor ?? null;
        if (!resCursor && mapped.length > 0) {
          const last = mapped[mapped.length - 1] as any;
          if (last?.time && last?.id) resCursor = `${last.time}_${last.id}`;
        }

        this.chatCursor = resCursor;

        if (arrayItems.length === 0) {
          this.hasMoreChats = false;
        } else if (arrayItems.length < limit) {
          this.hasMoreChats = false;
        } else if (append && toAdd.length === 0) {
          this.hasMoreChats = false;
        } else if (resCursor && prevCursor && resCursor === prevCursor) {
          this.hasMoreChats = false;
        } else {
          this.hasMoreChats = true;
        }
        if (this.desiredChatId) {
          const foundNow = this.chats.find(c => String((c as any)?.id) === String(this.desiredChatId));
          if (foundNow) {
            const sid2 = this.desiredChatId;
            this.desiredChatId = null;
            try { this.selectChat(foundNow); } catch (e) { this.desiredChatId = sid2; }
          } else if (this.hasMoreChats) {
            setTimeout(() => {
              try { this.loadChats(false, true); } catch (e) {}
            }, 50);
          } else {
            this.desiredChatId = null;
          }
        }

        this.loadingChats = false;
      },
      error: () => { this.loadingChats = false; }
    });
  }

  onChatsScroll(e: any): void {
    const el = e.target as HTMLElement;
    if (!el) return;
    if (!this.hasMoreChats || this.loadingChats) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) this.loadChats(false, true);
  }

  selectChat(chat: IChat): void {
    this.selectedChat = chat;
    this.messages = [];
    this.messagesCursor = null;
    this.hasMoreMessages = true;
    
    try {
      const idx = this.chats.findIndex(c => String((c as any)?.id) === String((chat as any)?.id));
      if (idx > -1) {
        try { (this.chats[idx] as any).unread = 0; } catch (e) {}
      }
      try { (this.selectedChat as any).unread = 0; } catch (e) {}
    } catch (e) {}
    try {
      const current = this.route.snapshot.queryParamMap.get('chat');
      if (String(current) !== String((chat as any).id)) {
        this.router.navigate([], { relativeTo: this.route, queryParams: { chat: (chat as any).id }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    } catch (e) {}
    try {
      const token = this.authService.getAccessToken();
      if (token && !this.websocketService.isMessageConnected()) {
        try { this.websocketService.connectMessages(token); } catch (e) {}
      }
      try { this.websocketService.joinChat(Number((chat as any).id)); } catch (e) {}
    } catch (e) {}

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
              // Reconcile with any last-edited message that arrived before we subscribed
              try {
                const last = (this.websocketService as any).getLastMessageEdited ? (this.websocketService as any).getLastMessageEdited() : null;
                if (last && Number(last.chatId) === Number(chatId)) {
                  const msg = last.message ?? last.msg ?? null;
                  if (msg && msg.id) {
                    this.messages = this.messages.map(m => {
                      try { if (Number((m as any)?.id) === Number(msg.id)) return { ...(m as any), message: (msg?.message ?? msg?.msg ?? (m as any).message) } as any; } catch (e) {}
                      return m;
                    });
                  }
                }
              } catch (e) {}
              // Reconcile with any last-deleted message that arrived before we subscribed
              try {
                const lastDel = (this.websocketService as any).getLastMessageDeleted ? (this.websocketService as any).getLastMessageDeleted() : null;
                if (lastDel && Number(lastDel.chatId) === Number(chatId)) {
                  const mid = Number(lastDel.messageId ?? lastDel.messageID ?? lastDel.message_id ?? lastDel.id ?? lastDel.message?.id ?? 0) || 0;
                  if (mid) {
                    this.messages = this.messages.filter(m => Number((m as any)?.id) !== mid);
                    try { this.cd.detectChanges(); } catch (e) {}
                  }
                }
              } catch (e) {}
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
  onFilesSelected(ev: Event): void {
    try {
      const input = ev.target as HTMLInputElement;
      if (!input || !input.files) return;
      const files = Array.from(input.files);
      for (const f of files) {
        const err = this.validateFile(f);
        if (err) {
          try { this.toastService.error('Archivo inválido', err); } catch (e) {}
          continue;
        }
        try { (f as any).__previewUrl = URL.createObjectURL(f); } catch (e) {}
        this.selectedFiles.push(f);
      }
      try { input.value = ''; } catch (e) {}
    } catch (e) {}
  }

  removeSelectedFile(index: number): void {
    try {
      const f = this.selectedFiles[index];
      this.selectedFiles.splice(index, 1);
      try { if (f && (f as any).__previewUrl) { URL.revokeObjectURL((f as any).__previewUrl); } } catch (e) {}
    } catch (e) {}
  }

  validateFile(file: File): string | null {
    if (!file || !file.type) return 'Tipo de archivo desconocido';
    const t = file.type.toLowerCase();
    if (t.startsWith('image/')) {
      if (file.size > this.MAX_IMAGE_PDF_BYTES) return 'Imágenes deben ser máximo 1 MB';
      return null;
    }
    if (t.startsWith('video/')) {
      if (file.size > this.MAX_VIDEO_BYTES) return 'Videos deben ser máximo 10 MB';
      return null;
    }
    if (t.startsWith('audio/')) {
      if (file.size > this.MAX_AUDIO_BYTES) return 'Audios deben ser máximo 5 MB';
      return null;
    }
    if (t === 'application/pdf') {
      if (file.size > this.MAX_IMAGE_PDF_BYTES) return 'PDF debe ser máximo 1 MB';
      return null;
    }
    return 'Tipo de archivo no soportado';
  }

  sendTextMessage(): void {
    if (!this.selectedChat) return;
    const hasText = !!(this.newMessage && this.newMessage.trim());
    const hasFiles = this.selectedFiles && this.selectedFiles.length > 0;
    if (!hasText && !hasFiles) return;

    const fd = new FormData();
    fd.append('chatId', String(this.selectedChat.id));
    if (hasText) fd.append('messageText', this.newMessage.trim());

    this.selectedFiles.forEach(f => fd.append('files', f, f.name));

    const tempId = -Date.now();
    const placeholder: any = {
      id: tempId,
      message: hasText ? this.newMessage.trim() : '',
      files: this.selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type, __previewUrl: URL.createObjectURL(f) })),
      createdAt: new Date().toISOString(),
      user: this.currentUser ? { id: this.currentUser.id, username: this.currentUser.username, profilePhoto: this.currentUser.profilePhoto } : null,
      type: { id: hasFiles ? 2 : 1, type: hasFiles ? 'attachment' : 'texto' },
      read: true,
      _optimistic: true
    };

    this.messages = [...this.messages, placeholder];
    this.newMessage = '';
    const prevFiles = [...this.selectedFiles];
    this.selectedFiles = [];

    setTimeout(() => { try { this.messagesView?.bindMediaLoadHandlers(); this.messagesView?.scrollToBottom(); } catch (e) {} }, 50);

    this.messageService.sendMessage(fd).subscribe({
      next: (res) => {
        try { prevFiles.forEach(f => { try { URL.revokeObjectURL((f as any).__previewUrl); } catch (e) {} }); } catch (e) {}
        setTimeout(() => { try { this.messagesView?.bindMediaLoadHandlers(); this.messagesView?.scrollToBottom(); } catch (e) {} }, 50);
      },
      error: () => {
        this.selectedFiles = prevFiles;
        this.messages = this.messages.filter(m => !(m && (m as any).id === tempId));
        try { this.toastService.error('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.'); } catch (e) {}
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

  getPreviewUrlForFile(f: File | any): string | null {
    try {
      return (f && (f as any).__previewUrl) ? String((f as any).__previewUrl) : null;
    } catch (e) {
      return null;
    }
  }

  ngOnDestroy(): void {
    try { window.removeEventListener('keydown', this._boundGlobalKeydown); } catch (e) {}
    this._cleanupSubscriptions();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private closeSelectedChat(): void {
    const chatId = this.selectedChat ? Number((this.selectedChat as any).id) : null;
    this.selectedChat = null;
    this.messages = [];
    this.messagesCursor = null;
    this.hasMoreMessages = true;

    try {
      if (chatId !== null && !isNaN(chatId)) {
        try { this.websocketService.leaveChat(chatId); } catch (e) {}
      }
    } catch (e) {}

    try {
      const qp = { ...this.route.snapshot.queryParams };
      if (qp && Object.prototype.hasOwnProperty.call(qp, 'chat')) {
        delete qp['chat'];
        this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
      }
    } catch (e) {}
  }

  private _cleanupSubscriptions(): void {
    try { this._currentMessagesSub?.unsubscribe(); } catch (e) {}
  }
}

