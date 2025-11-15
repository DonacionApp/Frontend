import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './terms-modal.component.html',
  styleUrls: ['./terms-modal.component.scss']
})
export class TermsModalComponent {
  constructor(public dialogRef: MatDialogRef<TermsModalComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}