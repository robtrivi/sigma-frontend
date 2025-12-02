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
  @Input() title: string = '🌱 SIGMA v2 - Prototipo';
  @Input() subtitle: string = 'Sistema Integrado de Gestión y Monitoreo de Áreas Verdes';
  @Input() description: string = 'Pantallas dinámicas con filtros, dashboards y reportes listos para análisis geoespacial';
  @Input() badge: string = 'Actualización diciembre 2025';
}
