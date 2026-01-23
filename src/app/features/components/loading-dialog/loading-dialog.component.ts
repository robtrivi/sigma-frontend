import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-dialog.component.html',
  styleUrls: ['./loading-dialog.component.scss']
})
export class LoadingDialogComponent {
  @Input() isVisible = signal(false);
  @Input() title = signal('Cargando');
  @Input() message = signal('');
}
