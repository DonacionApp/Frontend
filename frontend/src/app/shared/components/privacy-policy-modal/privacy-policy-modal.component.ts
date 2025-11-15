import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-privacy-policy-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './privacy-policy-modal.component.html',
  styleUrls: ['./privacy-policy-modal.component.scss']
})
export class PrivacyPolicyModalComponent {
  constructor(public dialogRef: MatDialogRef<PrivacyPolicyModalComponent>) {}

  close(): void {
    this.dialogRef.close();
  }
}

