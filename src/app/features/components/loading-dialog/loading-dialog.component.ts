import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-loading-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-dialog.component.html',
  styleUrls: ['./loading-dialog.component.scss'],
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
export class LoadingDialogComponent {
  @Input() isVisible = signal(false);
  @Input() title = signal('Cargando');
  @Input() message = signal('');
}
