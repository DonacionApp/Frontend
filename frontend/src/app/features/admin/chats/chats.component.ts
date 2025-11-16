import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { 
  ChatService, 
  Chat, 
  ChatFilters, 
  ChatListResponse,
  CreateChatDTO,
  AddUserToChatDTO,
  Message,
  MessageFilters,
  SendMessageDTO
} from '../../../core/services/chat.service';
import { UserManagementService, UserManagement } from '../../../core/services/user-management.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ConfirmModalComponent, MessageModalComponent],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.scss']
})
export class ChatsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Vista actual: 'list' o 'details'
  currentView: 'list' | 'details' = 'list';
  selectedChat: Chat | null = null;

  // Lista de chats
  chats: Chat[] = [];
  loadingChats = false;
  loadingMore = false;
  currentCursor: string | undefined;
  hasMore = false;

  // Filtros
  filterForm!: FormGroup;
  showFilters = false;

  // Mensajes del chat seleccionado
  messages: Message[] = [];
  loadingMessages = false;
  currentPage = 1;
  messagesLimit = 20;
  messageSearch = '';
  messageOrder: 'ASC' | 'DESC' = 'DESC';

  // Formularios
  createChatForm!: FormGroup;
  addUserForm!: FormGroup;
  sendMessageForm!: FormGroup;

  // Modales
  showCreateChatModal = false;
  showAddUserModal = false;
  showCloseChatModal = false;
  creatingChat = false;
  addingUser = false;
  closingChat = false;
  sendingMessage = false;

  // Usuarios disponibles para agregar
  availableUsers: UserManagement[] = [];
  loadingUsers = false;

  // Archivos para mensaje
  selectedFiles: File[] = [];

  // Modales de confirmación y mensaje
  showConfirmModal = false;
  showMessageModal = false;
  confirmModalConfig: {
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  } | null = null;
  messageModalConfig: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null = null;

  constructor(
    private chatService: ChatService,
    private userService: UserManagementService,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadChats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    this.filterForm = this.fb.group({
      limit: [20],
      search: ['']
    });

    this.createChatForm = this.fb.group({
      chatName: ['', [Validators.required, Validators.minLength(3)]],
      chatStatusId: [1, [Validators.required]],
      participantIds: [[], [Validators.required, Validators.minLength(1)]]
    });

    this.addUserForm = this.fb.group({
      userId: ['', [Validators.required]],
      donator: [false],
      admin: [false]
    });

    this.sendMessageForm = this.fb.group({
      messageText: [''],
      typeMessageId: [1]
    });
  }

  /**
   * Cargar lista de chats
   */
  loadChats(cursor?: string): void {
    if (cursor) {
      this.loadingMore = true;
    } else {
      this.loadingChats = true;
      this.chats = [];
    }

    const filters: ChatFilters = {
      limit: this.filterForm.value.limit || 20,
      search: this.filterForm.value.search || undefined,
      cursor: cursor || this.currentCursor || undefined
    };

    this.chatService.getChats(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (cursor) {
            this.chats = [...this.chats, ...response.items];
            this.loadingMore = false;
          } else {
            this.chats = response.items;
            this.loadingChats = false;
          }
          this.currentCursor = response.cursor;
          this.hasMore = response.hasMore || false;
        },
        error: (error) => {
          console.error('Error loading chats:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los chats';
          alert(`Error: ${errorMessage}`);
          this.loadingChats = false;
          this.loadingMore = false;
          this.chats = [];
        }
      });
  }

  /**
   * Seleccionar chat y ver detalles
   */
  selectChat(chat: Chat): void {
    this.selectedChat = chat;
    this.currentView = 'details';
    this.loadChatMessages();
  }

  /**
   * Volver a la lista de chats
   */
  goBackToList(): void {
    this.currentView = 'list';
    this.selectedChat = null;
    this.messages = [];
  }

  /**
   * Cargar mensajes del chat
   */
  loadChatMessages(): void {
    if (!this.selectedChat) return;

    this.loadingMessages = true;
    const filters: MessageFilters = {
      page: this.currentPage,
      limit: this.messagesLimit,
      search: this.messageSearch || undefined,
      order: this.messageOrder
    };

    this.chatService.getChatMessages(this.selectedChat.id, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.messages = response.messages || [];
          this.loadingMessages = false;
        },
        error: (error) => {
          console.error('Error loading messages:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los mensajes';
          alert(`Error: ${errorMessage}`);
          this.loadingMessages = false;
          this.messages = [];
        }
      });
  }

  /**
   * Aplicar filtros
   */
  applyFilters(): void {
    this.currentCursor = undefined;
    this.loadChats();
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.filterForm.patchValue({
      limit: 20,
      search: ''
    });
    this.currentCursor = undefined;
    this.loadChats();
  }

  /**
   * Cargar más chats (scroll infinito)
   */
  loadMore(): void {
    if (this.currentCursor && !this.loadingMore && !this.loadingChats) {
      this.loadChats(this.currentCursor);
    }
  }

  /**
   * Detectar scroll para cargar más automáticamente
   */
  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    if (this.currentView === 'list' && this.hasMore && !this.loadingMore && !this.loadingChats) {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (scrollPosition >= documentHeight - 100) {
        this.loadMore();
      }
    }
  }

  /**
   * Abrir modal de crear chat
   */
  openCreateChatModal(): void {
    this.showCreateChatModal = true;
    this.loadAvailableUsers();
  }

  /**
   * Cerrar modal de crear chat
   */
  closeCreateChatModal(): void {
    this.showCreateChatModal = false;
    this.createChatForm.reset();
    this.createChatForm.patchValue({ chatStatusId: 1, participantIds: [] });
  }

  /**
   * Cargar usuarios disponibles
   */
  loadAvailableUsers(): void {
    this.loadingUsers = true;
    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.availableUsers = users;
          this.loadingUsers = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          alert('No se pudieron cargar los usuarios');
          this.loadingUsers = false;
        }
      });
  }

  /**
   * Crear chat
   */
  createChat(): void {
    if (this.createChatForm.invalid) {
      this.createChatForm.markAllAsTouched();
      return;
    }

    this.creatingChat = true;
    const formValue = this.createChatForm.value;
    
    const data: CreateChatDTO = {
      chatName: formValue.chatName,
      chatStatusId: formValue.chatStatusId,
      participantIds: formValue.participantIds.map((userId: number) => ({
        userId,
        isAdmin: false
      }))
    };

    this.chatService.createChat(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (chat) => {
          alert('Chat creado exitosamente');
          this.closeCreateChatModal();
          this.loadChats();
          this.creatingChat = false;
        },
        error: (error) => {
          console.error('Error creating chat:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo crear el chat';
          alert(`Error: ${errorMessage}`);
          this.creatingChat = false;
        }
      });
  }

  /**
   * Abrir modal de agregar usuario
   */
  openAddUserModal(): void {
    this.showAddUserModal = true;
    if (this.availableUsers.length === 0) {
      this.loadAvailableUsers();
    }
  }

  /**
   * Cerrar modal de agregar usuario
   */
  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.addUserForm.reset();
    this.addUserForm.patchValue({ donator: false, admin: false });
  }

  /**
   * Agregar usuario al chat
   */
  addUserToChat(): void {
    if (this.addUserForm.invalid || !this.selectedChat) {
      this.addUserForm.markAllAsTouched();
      return;
    }

    this.addingUser = true;
    const formValue = this.addUserForm.value;
    
    const data: AddUserToChatDTO = {
      userId: formValue.userId,
      donator: formValue.donator || undefined,
      admin: formValue.admin || undefined
    };

    this.chatService.addUserToChat(this.selectedChat.id, data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Usuario agregado al chat exitosamente');
          this.closeAddUserModal();
          this.loadChats(); // Recargar para actualizar la lista
          if (this.selectedChat) {
            // Recargar detalles del chat
            this.chatService.getChats({ limit: 1, search: this.selectedChat.id.toString() })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (response) => {
                  if (response.items.length > 0) {
                    this.selectedChat = response.items[0];
                  }
                }
              });
          }
          this.addingUser = false;
        },
        error: (error) => {
          console.error('Error adding user to chat:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo agregar el usuario al chat';
          alert(`Error: ${errorMessage}`);
          this.addingUser = false;
        }
      });
  }

  /**
   * Remover usuario del chat
   */
  removeUserFromChat(userId: number): void {
    if (!this.selectedChat) return;
    
    if (!confirm('¿Estás seguro de remover este usuario del chat?')) {
      return;
    }

    this.chatService.removeUserFromChat(this.selectedChat.id, userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Usuario removido del chat exitosamente');
          this.loadChats(); // Recargar lista
          if (this.selectedChat) {
            // Recargar detalles del chat
            this.chatService.getChats({ limit: 1, search: this.selectedChat.id.toString() })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (response: ChatListResponse) => {
                  if (response.items.length > 0) {
                    this.selectedChat = response.items[0];
                  }
                }
              });
          }
        },
        error: (error: any) => {
          console.error('Error removing user from chat:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo remover el usuario del chat';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  /**
   * Cerrar chat
   */
  closeChat(): void {
    if (!this.selectedChat) return;
    
    if (!confirm('¿Estás seguro de cerrar este chat?')) {
      return;
    }

    this.closingChat = true;
    this.chatService.closeChat(this.selectedChat.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Chat cerrado exitosamente');
          this.goBackToList();
          this.loadChats();
          this.closingChat = false;
        },
        error: (error: any) => {
          console.error('Error closing chat:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo cerrar el chat';
          alert(`Error: ${errorMessage}`);
          this.closingChat = false;
        }
      });
  }

  /**
   * Enviar mensaje
   */
  sendMessage(): void {
    if (!this.selectedChat || (!this.sendMessageForm.value.messageText && this.selectedFiles.length === 0)) {
      return;
    }

    this.sendingMessage = true;
    const formValue = this.sendMessageForm.value;
    
    const data: SendMessageDTO = {
      chatId: this.selectedChat.id,
      typeMessageId: formValue.typeMessageId || undefined,
      messageText: formValue.messageText || undefined,
      files: this.selectedFiles.length > 0 ? this.selectedFiles : undefined
    };

    this.chatService.sendMessage(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sendMessageForm.patchValue({ messageText: '' });
          this.selectedFiles = [];
          this.loadChatMessages();
          this.sendingMessage = false;
        },
        error: (error: any) => {
          console.error('Error sending message:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo enviar el mensaje';
          alert(`Error: ${errorMessage}`);
          this.sendingMessage = false;
        }
      });
  }

  /**
   * Eliminar mensaje
   */
  deleteMessage(messageId: number): void {
    this.confirmModalConfig = {
      title: 'Eliminar Mensaje',
      message: '¿Estás seguro de eliminar este mensaje?',
      type: 'warning',
      onConfirm: () => this.executeDeleteMessage(messageId)
    };
    this.showConfirmModal = true;
  }

  executeDeleteMessage(messageId: number): void {
    this.showConfirmModal = false;
    this.chatService.deleteMessage(messageId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Mensaje eliminado exitosamente',
            type: 'success'
          };
          this.loadChatMessages();
        },
        error: (error: any) => {
          console.error('Error deleting message:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el mensaje';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmModalConfig = null;
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.messageModalConfig = null;
  }

  handleConfirm(): void {
    if (this.confirmModalConfig?.onConfirm) {
      this.confirmModalConfig.onConfirm();
    }
  }

  /**
   * Seleccionar archivos para mensaje
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  /**
   * Remover archivo seleccionado
   */
  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Toggle mostrar/ocultar filtros
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  /**
   * Toggle participante en el formulario de crear chat
   */
  toggleParticipant(userId: number): void {
    const currentParticipants = this.createChatForm.value.participantIds || [];
    const index = currentParticipants.indexOf(userId);
    
    if (index > -1) {
      currentParticipants.splice(index, 1);
    } else {
      currentParticipants.push(userId);
    }
    
    this.createChatForm.patchValue({ participantIds: currentParticipants });
  }
}

