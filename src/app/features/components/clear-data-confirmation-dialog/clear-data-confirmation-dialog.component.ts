import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-clear-data-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clear-data-confirmation-dialog.component.html',
  styleUrl: './clear-data-confirmation-dialog.component.scss'
})
export class ClearDataConfirmationDialogComponent {
  @Output() dialogClosed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onCancel(): void {
    this.dialogClosed.emit();
  }

  onAccept(): void {
    this.confirm.emit();
    this.dialogClosed.emit();
  }
}
