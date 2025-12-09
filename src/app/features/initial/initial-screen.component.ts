import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VisualizationHeaderComponent } from '../components/header/visualization-header.component';
import { MapCell, MonthFilter, ClassType } from '../models/visualization.models';

@Component({
  selector: 'app-initial-screen',
  standalone: true,
  imports: [CommonModule, RouterLink, VisualizationHeaderComponent],
  templateUrl: './initial-screen.component.html',
  styleUrls: ['./initial-screen.component.scss']
})
export class InitialScreenComponent {
  uploadedFile: string = '';
  hoveredCell: MapCell | null = null;

  months: MonthFilter[] = [
    { id: 'agosto', label: 'Agosto 2025', selected: false },
    { id: 'septiembre', label: 'Septiembre 2025', selected: false },
    { id: 'octubre', label: 'Octubre 2025', selected: false }
  ];

  classTypes: ClassType[] = [
    { id: 'green', label: 'Áreas Verdes', color: '#4a7c2c', icon: 'pi-sun', selected: true },
    { id: 'building', label: 'Edificios', color: '#8b7355', icon: 'pi-building', selected: true },
    { id: 'street', label: 'Calles', color: '#808080', icon: 'pi-minus', selected: true },
    { id: 'parking', label: 'Parqueaderos', color: '#a9a9a9', icon: 'pi-car', selected: true },
    { id: 'water', label: 'Cuerpos de Agua', color: '#4a90e2', icon: 'pi-inbox', selected: true }
  ];

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.uploadedFile = file?.name ?? '';
  }

  onCellHover(cell: MapCell): void {
    this.hoveredCell = cell;
  }

  onCellLeave(): void {
    this.hoveredCell = null;
  }

  onMonthFilterChange(): void {
  }

  onClassFilterChange(): void {
  }

  clearFilters(): void {
    this.uploadedFile = '';
    this.classTypes.forEach(ct => ct.selected = true);
  }

  navigateToVisualization(): void {
  }
}
