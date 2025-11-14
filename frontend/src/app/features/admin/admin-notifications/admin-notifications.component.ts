import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
          alert(`Error: ${errorMessage}`);
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
          alert(`Notificación creada exitosamente!\n\nID: ${response.id}\nTítulo: ${response.title}\nEnviada a ${response.userNotify.length} administrador(es)`);
          this.notificationForm.reset();
          this.creating = false;
        },
        error: (error) => {
          console.error('Error creating notification:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo crear la notificación';
          alert(`Error: ${errorMessage}`);
          this.creating = false;
        }
      });
  }
}

