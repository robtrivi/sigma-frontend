import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mask-loading-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mask-loading-dialog.component.html',
  styleUrls: ['./mask-loading-dialog.component.scss']
})
export class MaskLoadingDialogComponent {
  @Input() isVisible = signal(false);
  @Input() periodLabel = signal('');
  @Input() visualizationType: 'mask' | 'original' = 'mask';

  getTitle(): string {
    return this.visualizationType === 'original' ? 'Cargando imágenes originales' : 'Cargando máscaras';
  }
}
