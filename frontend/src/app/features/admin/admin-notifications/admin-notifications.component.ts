import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MessageModalComponent],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss']
})
export class AdminNotificationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  notificationForm!: FormGroup;
  notificationTypes: any[] = [];
  loadingTypes = false;
  creating = false;
  errorMessage = '';

  // Modal de mensaje
  showMessageModal = false;
  messageModalConfig: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null = null;

  constructor(
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadNotificationTypes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.notificationForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      message: ['', [Validators.required, Validators.minLength(5)]],
      typeNotifyId: ['', [Validators.required]],
      link: ['']
    });
  }

  /**
   * Cargar tipos de notificación
   */
  loadNotificationTypes(): void {
    this.loadingTypes = true;
    this.notificationService.getNotificationTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.notificationTypes = types;
          this.loadingTypes = false;
        },
        error: (error) => {
          console.error('Error loading notification types:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los tipos de notificación';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.loadingTypes = false;
        }
      });
  }

  /**
   * Crear notificación para administradores
   */
  createNotification(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      return;
    }

    this.creating = true;
    this.errorMessage = '';

    const formValue = this.notificationForm.value;
    const notificationData = {
      title: formValue.title,
      message: formValue.message,
      typeNotifyId: Number(formValue.typeNotifyId),
      link: formValue.link || undefined
    };

    this.notificationService.createNotificationForAdmins(notificationData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `Notificación creada exitosamente!\n\nID: ${response.id}\nTítulo: ${response.title}\nEnviada a ${response.userNotify.length} administrador(es)`,
            type: 'success'
          };
          this.notificationForm.reset();
          this.creating = false;
        },
        error: (error) => {
          console.error('Error creating notification:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo crear la notificación';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.creating = false;
        }
      });
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.messageModalConfig = null;
  }
}

