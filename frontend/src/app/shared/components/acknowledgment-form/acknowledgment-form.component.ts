import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AcknowledgmentService, CreateAcknowledgmentDTO } from '../../../core/services/acknowledgment.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-acknowledgment-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acknowledgment-form.component.html',
  styleUrls: ['./acknowledgment-form.component.scss']
})
export class AcknowledgmentFormComponent implements OnInit {
  @Input() donationId?: number;
  @Input() postId?: number;
  @Input() maxLength: number = 500;
  @Input() placeholder: string = 'Escribe tu agradecimiento aquí...';
  @Output() acknowledgmentCreated = new EventEmitter<void>();

  message: string = '';
  submitting: boolean = false;
  error: string = '';
  remainingChars: number = this.maxLength;

  constructor(
    private acknowledgmentService: AcknowledgmentService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.remainingChars = this.maxLength;
  }

  onMessageChange(): void {
    this.remainingChars = this.maxLength - this.message.length;
    this.error = '';
    
    if (this.message.trim().length > 0) {
      const validation = this.acknowledgmentService.validateContent(this.message);
      if (!validation.isValid && validation.reason) {
        this.error = validation.reason;
      }
    }
  }

  onSubmit(): void {
    if (!this.message.trim()) {
      this.error = 'El mensaje no puede estar vacío';
      return;
    }

    if (this.message.length > this.maxLength) {
      this.error = `El mensaje no puede exceder ${this.maxLength} caracteres`;
      return;
    }

    const validation = this.acknowledgmentService.validateContent(this.message);
    if (!validation.isValid) {
      this.error = validation.reason || 'El contenido contiene palabras inapropiadas';
      return;
    }

    this.submitting = true;
    this.error = '';

    if (!this.donationId && !this.postId) {
      this.error = 'Se requiere un ID de donación o publicación';
      this.submitting = false;
      return;
    }

    if (this.donationId) {
      this.acknowledgmentService.createDonationReview(this.donationId, this.message).subscribe({
        next: () => {
          this.message = '';
          this.remainingChars = this.maxLength;
          this.submitting = false;
          this.toastService.success('Éxito', 'Agradecimiento enviado exitosamente');
          this.acknowledgmentCreated.emit();
        },
        error: (err) => {
          this.submitting = false;
          const errorMsg = err?.error?.message || err?.message || 'Error al enviar el agradecimiento';
          this.error = errorMsg;
          this.toastService.error('Error', errorMsg);
        }
      });
    } else {
      const data: CreateAcknowledgmentDTO = {
        message: this.message.trim(),
        ...(this.postId && { postId: this.postId })
      };

      this.acknowledgmentService.createAcknowledgment(data).subscribe({
        next: () => {
          this.message = '';
          this.remainingChars = this.maxLength;
          this.submitting = false;
          this.toastService.success('Éxito', 'Agradecimiento enviado exitosamente');
          this.acknowledgmentCreated.emit();
        },
        error: (err) => {
          this.submitting = false;
          const errorMsg = err?.error?.message || err?.message || 'Error al enviar el agradecimiento';
          this.error = errorMsg;
          this.toastService.error('Error', errorMsg);
        }
      });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === 'Enter') {
      this.onSubmit();
    }
  }
}

