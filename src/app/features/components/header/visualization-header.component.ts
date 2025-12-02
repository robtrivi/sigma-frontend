import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-visualization-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './visualization-header.component.html',
  styleUrls: ['./visualization-header.component.scss']
})
export class VisualizationHeaderComponent {
  @Input() title: string = 'SIGMA';
  @Input() subtitle: string = 'Sistema Integrado de Gestión y Monitoreo de Áreas Verdes';
  @Input() description: string = 'Explorador geoespacial con filtros, tableros y reportes listos para decisión.';
  @Input() badge: string = 'Panel operativo';
}
