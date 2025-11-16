


import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { MessageService, IMessage, IChat } from '../../../core/services/message.service';
import { MessagesViewComponent } from './messages-view/messages-view.component';
import { FloatingMenuComponent, FloatingMenuItem } from '../floating-menu/floating-menu.component';
import { AuthService } from '../../../core/services/auth.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { AlertService } from '../../services/alert.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, MessagesViewComponent, FloatingMenuComponent],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.scss']
})
export class ChatsComponent implements OnInit, OnDestroy {
    // Detecta si una URL es PDF
    isPdfFile(url: string): boolean {
      return url?.toLowerCase().endsWith('.pdf') || url?.toLowerCase().includes('.pdf?');
    }
  userPickerSearch: string = '';

  getUserPickerDisplay(uid: number): string {
    const u = this.userPickerList.find((user: any) => user.id === uid);
    return (u && (u.username || u.email || (u.people && u.people.name))) || String(uid);
  }

  getChatById(id: string | null): IChat | undefined {
    return this.chats.find(c => String(c.id) === String(id));
  }

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
  // Estados de validación por archivo (usando índice como clave)
  fileValidationStates: Map<number, 'validating' | 'valid' | 'error'> = new Map();
  fileValidationErrors: Map<number, string> = new Map();

  readonly MAX_IMAGE_PDF_BYTES = 1 * 1024 * 1024;
  readonly MAX_VIDEO_BYTES = 10 * 1024 * 1024;
  readonly MAX_AUDIO_BYTES = 5 * 1024 * 1024;

  currentUserId: string | number | null = null;
  currentUser: any | null = null;

  private desiredChatId: string | null = null;
  isMobileView = false;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private websocketService: WebsocketService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute
    , private cd: ChangeDetectorRef
  ) {}

  isAdmin(): boolean {
    try {
      const r = (this.currentUser && (this.currentUser as any).role && (this.currentUser as any)) ? String((this.currentUser as any).role).toLowerCase() : '';
      return r === 'admin' || r === 'administrador';
    } catch (e) { return false; }
  }

  // Floating menu / inline form state for better UX (replace prompt flows)
  showCreateChatForm = false;
  createChatName = '';
  createChatLoading = false;
  showUserPicker = false;
  userPickerLoading = false;
  userPickerList: any[] = [];
  userPickerSelected: Set<number> = new Set();

  // admin actions per chat (map by chat id)
  adminActionState: Record<string, { action?: string; input?: string; loading?: boolean }> = {};


  // menu items
  createChatMenuItems: FloatingMenuItem[] = [ { label: 'Crear chat', action: 'create' } ];

  // Estado para mostrar usuarios listados por chat
  usersListState: Record<string, { open: boolean; loading: boolean; users: any[] }> = {};

  // Estado para agregar usuarios a un chat
  showAddUsersModal: string | null = null; // chatId
  addUsersModalLoading = false;
  addUsersModalList: any[] = [];
  addUsersModalSelected: Set<number> = new Set();
  addUsersModalSearch: string = '';
  addUsersModalSubmitting = false;

  getAdminMenuItems(chat: any): FloatingMenuItem[] {
    return [
      { label: 'Listar usuarios', action: 'list', data: { chatId: chat?.id } },
      { label: 'Agregar usuario', action: 'add', data: { chatId: chat?.id } },
    ];
  }

  onCreateMenuSelect(item: FloatingMenuItem): void {
    try {
      if (!this.isAdmin()) { try { window.alert('Solo administradores pueden crear chats.'); } catch (e) {} return; }
      if (item && item.action === 'create') {
        this.showCreateChatForm = true;
        this.createChatName = '';
        this.openUserPicker();
      }
    } catch (e) {}
  }

  openUserPicker(): void {
    this.showUserPicker = true;
    this.userPickerLoading = true;
    this.userPickerList = [];
    this.userPickerSelected = new Set();
    this.userPickerSearch = '';
    // Cargar usuarios
    this.messageService.searchUsers ?
      firstValueFrom(this.messageService.searchUsers({})).then(users => {
        this.userPickerList = Array.isArray(users) ? users : [];
        this.userPickerLoading = false;
      }).catch(() => { this.userPickerLoading = false; })
      :
      fetch('http://localhost:5000/user').then(r => r.json()).then(users => {
        this.userPickerList = Array.isArray(users) ? users : [];
        this.userPickerLoading = false;
      }).catch(() => { this.userPickerLoading = false; });
  }

  get filteredUserPickerList(): any[] {
    const term = (this.userPickerSearch || '').toLowerCase().trim();
    if (!term) return this.userPickerList;
    return this.userPickerList.filter((u: any) =>
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.people && u.people.name && u.people.name.toLowerCase().includes(term))
    );
  }

  closeUserPicker(): void {
    this.showUserPicker = false;
    this.userPickerList = [];
    this.userPickerSelected = new Set();
  }

  toggleUserPickerSelect(uid: number): void {
    if (this.userPickerSelected.has(uid)) this.userPickerSelected.delete(uid);
    else this.userPickerSelected.add(uid);
  }

  async createChatFromForm(): Promise<void> {
    try {
      if (!this.isAdmin()) { try { window.alert('Solo administradores pueden crear chats.'); } catch (e) {} return; }
      const name = String(this.createChatName || '').trim();
      if (!name) { try { this.alertService.error('Error', 'El nombre del chat es requerido.'); } catch (e) {} return; }
     
      const ids = Array.from(this.userPickerSelected);
      if (!ids.length) { try { this.alertService.error('Error', 'Selecciona al menos un usuario.'); } catch (e) {} return; }
      const participantIds: Array<{ userId: number; isAdmin?: boolean; isDonator?: boolean }> = [];
      if (this.currentUserId) participantIds.push({ userId: Number(this.currentUserId), isAdmin: true });
      for (const id of ids) {
        if (Number(id) !== Number(this.currentUserId)) participantIds.push({ userId: Number(id), isAdmin: false });
      }
      const body = { chatName: name, chatStatusId: 1, participantIds };
      this.createChatLoading = true;
      await firstValueFrom(this.messageService.createChatAdmin(body));
      this.createChatLoading = false;
      this.showCreateChatForm = false;
      this.closeUserPicker();
      try { this.alertService.success('OK', 'Chat creado correctamente.'); } catch (e) {}
      this.loadChats(true);
    } catch (err) {
      console.error('Error creando chat', err);
      this.createChatLoading = false;
      try { this.alertService.error('Error', 'No se pudo crear el chat.'); } catch (e) {}
    }
  }

  cancelCreateChat(): void {
    this.showCreateChatForm = false;
    this.createChatName = '';
    this.closeUserPicker();
  }

  onAdminMenuSelect(item: FloatingMenuItem, chat: any): void {
    try {
      if (!this.isAdmin()) { try { window.alert('Solo administradores.'); } catch (e) {} return; }
      const cid = String(chat?.id ?? '');
      const act = String(item?.action || '').toLowerCase();
      if (act === 'list') {
        // Mostrar menú flotante con usuarios
        this.usersListState[cid] = { open: true, loading: true, users: [] };
        firstValueFrom(this.messageService.getUsersByChat(Number(chat.id))).then(users => {
          this.usersListState[cid] = { open: true, loading: false, users: Array.isArray(users) ? users : [] };
        }).catch(err => {
          this.usersListState[cid] = { open: false, loading: false, users: [] };
          try { this.alertService.error('Error', 'No se pudo cargar usuarios.'); } catch (e) {}
        });
        return;
      }

      if (act === 'add') {
        this.openAddUsersModal(chat);
      } else if (act === 'remove') {
        this.adminActionState[cid] = { action: act, input: '', loading: false };
      }
    } catch (e) {}
  }

  async openAddUsersModal(chat: any) {
    const cid = String(chat?.id ?? '');
    this.showAddUsersModal = cid;
    this.addUsersModalLoading = true;
    this.addUsersModalList = [];
    this.addUsersModalSelected = new Set();
    this.addUsersModalSearch = '';
    try {
      // Cargar todos los usuarios
      let allUsers: any[] = [];
      if (this.messageService.searchUsers) {
        allUsers = await firstValueFrom(this.messageService.searchUsers({}));
      } else {
        const res = await fetch('http://localhost:5000/user');
        allUsers = await res.json();
      }
      // Cargar usuarios del chat
      const chatUsers = await firstValueFrom(this.messageService.getUsersByChat(Number(chat.id)));
      const chatUserIds = new Set((Array.isArray(chatUsers) ? chatUsers : []).map((u: any) => u.user?.id ?? u.id));
      // Filtrar solo los que NO están en el chat
      this.addUsersModalList = (Array.isArray(allUsers) ? allUsers : []).filter((u: any) => !chatUserIds.has(u.id));
    } catch (e) {
      this.addUsersModalList = [];
    }
    this.addUsersModalLoading = false;
  }

  get filteredAddUsersModalList(): any[] {
    const term = (this.addUsersModalSearch || '').toLowerCase().trim();
    if (!term) return this.addUsersModalList;
    return this.addUsersModalList.filter((u: any) =>
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.people && u.people.name && u.people.name.toLowerCase().includes(term))
    );
  }

  toggleAddUsersModalSelect(uid: number): void {
    if (this.addUsersModalSelected.has(uid)) this.addUsersModalSelected.delete(uid);
    else this.addUsersModalSelected.add(uid);
  }

  closeAddUsersModal(): void {
    this.showAddUsersModal = null;
    this.addUsersModalList = [];
    this.addUsersModalSelected = new Set();
    this.addUsersModalSearch = '';
    this.addUsersModalLoading = false;
    this.addUsersModalSubmitting = false;
  }

  async submitAddUsersToChat(chat: any) {
    if (!this.showAddUsersModal || this.addUsersModalSubmitting) return;
    const cid = String(chat?.id ?? '');
    const ids = Array.from(this.addUsersModalSelected);
    if (!ids.length) {
      try { this.alertService.error('Error', 'Selecciona al menos un usuario.'); } catch (e) {}
      return;
    }
    this.addUsersModalSubmitting = true;
    try {
      for (const uid of ids) {
        await firstValueFrom(this.messageService.addUserToChat({ userId: uid, admin: false }, Number(chat.id)));
      }
      try { this.alertService.success('OK', 'Usuarios agregados correctamente.'); } catch (e) {}
      this.closeAddUsersModal();
      // Recargar usuarios del chat si está abierto el menú
      if (this.usersListState && this.usersListState[cid]?.open) {
        this.usersListState[cid].loading = true;
        const users = await firstValueFrom(this.messageService.getUsersByChat(Number(chat.id)));
        this.usersListState[cid] = { open: true, loading: false, users: Array.isArray(users) ? users : [] };
      }
    } catch (e) {
      try { this.alertService.error('Error', 'No se pudieron agregar los usuarios.'); } catch (e2) {}
    }
    this.addUsersModalSubmitting = false;
  }

  closeUsersList(chat: any): void {
    try {
      const cid = String(chat?.id ?? '');
      if (this.usersListState[cid]) this.usersListState[cid].open = false;
    } catch (e) {}
  }

  async removeUserFromChat(chat: any, userId: number): Promise<void> {
    const cid = String(chat?.id ?? '');
    if (!userId) return;
    if (!this.usersListState[cid]) return;
    // Marcar visualmente como "eliminando"
    this.usersListState[cid].users = this.usersListState[cid].users.map(u =>
      (u.id === userId || u.user?.id === userId) ? { ...u, _removing: true } : u
    );
    this.usersListState[cid].loading = true;
    try {
      await firstValueFrom(this.messageService.removeUserFromChat(Number(chat.id), userId));
      // Quitar de la lista tras éxito
      this.usersListState[cid].users = this.usersListState[cid].users.filter(u => u.id !== userId && u.user?.id !== userId);
      this.usersListState[cid].loading = false;
      try { this.alertService.success('OK', 'Usuario eliminado del chat.'); } catch (e) {}
    } catch (err) {
      // Si falla, quitar el estado de "eliminando"
      this.usersListState[cid].users = this.usersListState[cid].users.map(u => {
        if (u._removing) { const { _removing, ...rest } = u; return rest; }
        return u;
      });
      this.usersListState[cid].loading = false;
      try { this.alertService.error('Error', 'No se pudo eliminar el usuario.'); } catch (e) {}
    }
  }

  async submitAdminAction(chat: any): Promise<void> {
    try {
      const cid = String(chat?.id ?? '');
      const state = this.adminActionState[cid];
      if (!state || !state.action) return;
      if (state.action === 'add') {
        const uid = Number(state.input);
        if (!uid || isNaN(uid)) { try { this.alertService.error('Error', 'Id de usuario inválido.'); } catch (e) {} return; }
        state.loading = true;
        try {
          await firstValueFrom(this.messageService.addUserToChat({  userId: uid, admin: false }, Number(chat.id)));
          try { this.alertService.success('OK', 'Usuario agregado.'); } catch (e) {}
        } catch (err) { console.error(err); try { this.alertService.error('Error', 'No se pudo agregar el usuario.'); } catch (e) {} }
        state.loading = false;
        delete this.adminActionState[cid];
      } else if (state.action === 'remove') {
        const rid = Number(state.input);
        if (!rid || isNaN(rid)) { try { this.alertService.error('Error', 'Id inválido.'); } catch (e) {} return; }
        state.loading = true;
        try {
          await firstValueFrom(this.messageService.removeUserFromChat(Number(chat.id), rid));
          try { this.alertService.success('OK', 'Usuario removido del chat.'); } catch (e) {}
        } catch (err) { console.error(err); try { this.alertService.error('Error', 'No se pudo remover al usuario.'); } catch (e) {} }
        state.loading = false;
        delete this.adminActionState[cid];
      }
    } catch (e) {}
  }

  cancelAdminAction(chat: any): void {
    try { const cid = String(chat?.id ?? ''); delete this.adminActionState[cid]; } catch (e) {}
  }

  // Create a chat (admin only) - minimal flow using prompts for now
  async onCreateChat(): Promise<void> {
    try {
      if (!this.isAdmin()) { window.alert('Solo administradores pueden crear chats.'); return; }
      const name = window.prompt('Nombre del chat:');
      if (!name || !String(name).trim()) return;
      const membersCsv = window.prompt('IDs de participantes separados por comas (ej: 24,26). Dejar vacío para solo tú como admin.');
      const ids = (membersCsv || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
      const participantIds: Array<{ userId: number; isAdmin?: boolean }> = [];
      // add current user as admin
      if (this.currentUserId) participantIds.push({ userId: Number(this.currentUserId), isAdmin: true });
      for (const id of ids) {
        if (Number(id) !== Number(this.currentUserId)) participantIds.push({ userId: Number(id), isAdmin: false });
      }

      const body = { chatName: String(name).trim(), chatStatusId: 1, participantIds };
      try {
        await firstValueFrom(this.messageService.createChat(body));
        try { window.alert('Chat creado correctamente.'); } catch (e) {}
        // reload chats
        try { this.loadChats(true); } catch (e) {}
      } catch (err) {
        console.error('Error creando chat', err);
        try { window.alert('No se pudo crear el chat.'); } catch (e) {}
      }
    } catch (e) {}
  }

  // Admin menu per chat: add/remove users
  async onAdminManageChat(chat: IChat): Promise<void> {
    try {
      if (!this.isAdmin()) { window.alert('Solo administradores.'); return; }
      if (!chat || !chat.id) return;
      const actionRaw = window.prompt('Acción para este chat (add/remove/list):');
      if (!actionRaw) return;
      const action = String(actionRaw || '').trim();
      if (!action) return;
      const act = String(action).toLowerCase();
      if (act === 'list') {
        try {
          const users = await firstValueFrom(this.messageService.getUsersByChat(Number(chat.id)));
          console.log('Users in chat', users);
          try { window.alert('Listado en consola (ver Developer Tools).'); } catch (e) {}
          return;
        } catch (err) { console.error(err); window.alert('Error cargando usuarios del chat'); return; }
      }

      if (act === 'add') {
        const q = window.prompt('Buscar usuarios por nombre/username/email (palabra):');
        if (!q) return;
        try {
          const res = await firstValueFrom(this.messageService.searchUsers({ search: q }));
          console.log('Resultados búsqueda usuarios:', res);
          try { window.alert('Resultados mostrados en consola. Copia el id del usuario a agregar.'); } catch (e) {}
          const uidStr = window.prompt('Ingresa el id del usuario a agregar:');
          const uid = uidStr ? Number(uidStr) : NaN;
          if (!uid || isNaN(uid)) return;
          // call addUserToChat
          try {
            await firstValueFrom(this.messageService.addUserToChat({  userId: uid, admin: false }, Number(chat.id)));
            try { window.alert('Usuario agregado.'); } catch (e) {}
          } catch (err) { console.error(err); window.alert('No se pudo agregar el usuario.'); }
        } catch (err) {
          console.error('Error buscando usuarios', err);
          try { window.alert('Error buscando usuarios.'); } catch (e) {}
        }
        return;
      }

      if (act === 'remove') {
        try {
          const users = await firstValueFrom(this.messageService.getUsersByChat(Number(chat.id)));
          console.log('Usuarios en chat (use id del wrapper o user id):', users);
          try { window.alert('Listado en consola. Ingresa el id del registro a eliminar (userchat id).'); } catch (e) {}
          const uidStr = window.prompt('Ingresa el id del registro userchat a eliminar:');
          const uid = uidStr ? Number(uidStr) : NaN;
          if (!uid || isNaN(uid)) return;
          try {
            await firstValueFrom(this.messageService.removeUserFromChat(Number(chat.id), uid));
            try { window.alert('Usuario removido del chat.'); } catch (e) {}
          } catch (err) { console.error(err); window.alert('No se pudo remover al usuario.'); }
        } catch (err) {
          console.error('Error cargando usuarios del chat', err);
          try { window.alert('Error obteniendo usuarios del chat.'); } catch (e) {}
        }
        return;
      }
    } catch (e) {}
  }

  onEditMessage(payload: { id: number; newMessage: string } | any): void {
    try {
      if (!payload || !payload.id) return;
      const id = Number(payload.id);
      const newMessage = String(payload.newMessage || '').trim();
      if (!newMessage) {
        try { this.alertService.error('Error', 'El mensaje no puede estar vacío.'); } catch (e) {}
        return;
      }
      try {
        const idx = this.messages.findIndex(m => Number((m as any)?.id) === id);
        if (idx > -1) {
          try { (this.messages[idx] as any).message = newMessage; } catch (e) {}
        }
      } catch (e) {}

      try { this.websocketService.emitEditMessage(id, this.selectedChat ? Number((this.selectedChat as any).id) : undefined, newMessage); } catch (e) {}
      try { this.alertService.success('Solicitud enviada', 'Se solicitó la edición del mensaje.'); } catch (e) {}
    } catch (e) {}
  }

  onDeleteMessage(messageId: number | any): void {
    try {
      const id = Number(messageId);
      if (!id) return;
      try { this.messages = this.messages.filter(m => Number((m as any)?.id) !== id); } catch (e) {}
      
      try { this.websocketService.emitDeleteMessage(id, this.selectedChat ? Number((this.selectedChat as any).id) : undefined); } catch (e) {}
      try { this.alertService.success('Solicitud enviada', 'Se solicitó la eliminación del mensaje.'); } catch (e) {}
    } catch (e) {}
  }

  private _boundGlobalKeydown = (ev: KeyboardEvent) => {
    try {
      if ((ev.key === 'Escape' || ev.key === 'Esc') && this.selectedChat) {
        this.closeSelectedChat();
      }
    } catch (e) {}
  };

  private _boundResize = () => {
    this.checkMobileView();
    this.cd.detectChanges();
  };

  ngOnInit(): void {
    // Detectar si es móvil
    this.checkMobileView();
    window.addEventListener('resize', this._boundResize);
    
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUserId = u?.id ?? null;
      this.currentUser = u ?? null;
      try {
        const token = this.authService.getAccessToken();
        if (token && !this.websocketService.isMessageConnected()) {
          try { this.websocketService.connectMessages(token); } catch (e) {}
        }
      } catch (e) {}

      try {
        this.websocketService.onChatNew().pipe(takeUntil(this.destroy$)).subscribe((payload: any) => {
          try {
            const chat = payload?.chat ?? payload;
            if (!chat || !chat.id) return;
            const cid = Number(chat.id);
            const existingIdx = this.chats.findIndex(c => Number((c as any)?.id) === cid);
            const mapped: IChat = {
              id: cid,
              chatName: chat?.chatName ?? chat?.name ?? `Chat ${cid}`,
              lastMessage: chat?.lastMessage?.message ?? chat?.lastMessageText ?? '',
              avatar: chat?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(chat?.chatName ?? (chat?.name || `Chat ${cid}`))}`,
              unread: Number(chat?.unread ?? 0) || 0,
              participants: Number(chat?.participants ?? 0) || 0,
              time: chat?.lastMessageAt ?? chat?.updatedAt ?? chat?.createdAt ?? ''
            } as any;

            if (existingIdx > -1) {
              try { this.chats[existingIdx] = { ...(this.chats[existingIdx] as any), ...mapped }; } catch (e) {}
            } else {
              try { this.chats = [mapped, ...this.chats]; } catch (e) {}
            }
          } catch (e) {}
        });
      } catch (e) {}
    });

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
      
      files.forEach((f, index) => {
        const fileIndex = this.selectedFiles.length + index;
        
        // Iniciar validación
        this.fileValidationStates.set(fileIndex, 'validating');
        this.fileValidationErrors.delete(fileIndex);
        
        // Simular validación asíncrona
        setTimeout(() => {
          const err = this.validateFile(f);
          if (err) {
            this.fileValidationStates.set(fileIndex, 'error');
            this.fileValidationErrors.set(fileIndex, err);
            try { this.alertService.error('Archivo inválido', err); } catch (e) {}
            return;
          }
          
          // Archivo válido
          this.fileValidationStates.set(fileIndex, 'valid');
          try { (f as any).__previewUrl = URL.createObjectURL(f); } catch (e) {}
          this.selectedFiles.push(f);
        }, 300);
      });
      
      try { input.value = ''; } catch (e) {}
    } catch (e) {}
  }

  removeSelectedFile(index: number): void {
    try {
      const f = this.selectedFiles[index];
      this.selectedFiles.splice(index, 1);
      this.fileValidationStates.delete(index);
      this.fileValidationErrors.delete(index);
      try { if (f && (f as any).__previewUrl) { URL.revokeObjectURL((f as any).__previewUrl); } } catch (e) {}
    } catch (e) {}
  }
  
  getFileValidationState(index: number): 'validating' | 'valid' | 'error' | null {
    return this.fileValidationStates.get(index) || null;
  }
  
  getFileValidationError(index: number): string {
    return this.fileValidationErrors.get(index) || '';
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
        try { this.alertService.error('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.'); } catch (e) {}
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
    try { window.removeEventListener('resize', this._boundResize); } catch (e) {}
    this._cleanupSubscriptions();
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeSelectedChat(): void {
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

  private checkMobileView(): void {
    this.isMobileView = window.innerWidth < 768; // md breakpoint de Tailwind
  }
}

