import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-mask-loading-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mask-loading-dialog.component.html',
  styleUrls: ['./mask-loading-dialog.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class MaskLoadingDialogComponent {
  @Input() isVisible = signal(false);
  @Input() periodLabel = signal('');
  @Input() visualizationType: 'mask' | 'original' = 'mask';

  getTitle(): string {
    return this.visualizationType === 'original' ? 'Cargando imágenes originales' : 'Cargando máscaras';
  }
}
