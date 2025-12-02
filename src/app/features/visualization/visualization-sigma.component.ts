import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapGridComponent } from './components/map-grid/map-grid.component';
import { ControlPanelComponent } from './components/control-panel/control-panel.component';
import { DashboardPanelComponent } from './components/dashboard/dashboard-panel.component';
import { VisualizationHeaderComponent } from './components/header/visualization-header.component';
import { ChartBar, ClassDistributionStat, ClassType, MapCell, MonthFilter } from './models/visualization.models';

@Component({
  selector: 'app-visualization-sigma',
  standalone: true,
  imports: [CommonModule, MapGridComponent, ControlPanelComponent, DashboardPanelComponent, VisualizationHeaderComponent],
  templateUrl: './visualization-sigma.component.html',
  styleUrls: ['./visualization-sigma.component.scss']
})
export class VisualizationSigmaComponent {
  uploadedFile: string = '';
  hoveredCell: MapCell | null = null;
  activeMonth: string = 'octubre';

  months: MonthFilter[] = [
    { id: 'agosto', label: 'Agosto 2025', selected: false },
    { id: 'septiembre', label: 'Septiembre 2025', selected: false },
    { id: 'octubre', label: 'Octubre 2025', selected: true }
  ];

  classTypes: ClassType[] = [
    { id: 'green', label: 'Áreas Verdes', color: '#4a7c2c', icon: 'pi-sun', selected: true },
    { id: 'building', label: 'Edificios', color: '#8b7355', icon: 'pi-building', selected: true },
    { id: 'street', label: 'Calles', color: '#808080', icon: 'pi-minus', selected: true },
    { id: 'parking', label: 'Parqueaderos', color: '#a9a9a9', icon: 'pi-car', selected: true },
    { id: 'water', label: 'Cuerpos de Agua', color: '#4a90e2', icon: 'pi-inbox', selected: true }
  ];

  mapCells: MapCell[] = [
    // Fila 1
    { id: 1, name: 'Área Verde A', type: 'Áreas Verdes', classId: 'green', area: '3,125 m²', color: '#4a7c2c', selected: false },
    { id: 2, name: 'Área Verde B', type: 'Áreas Verdes', classId: 'green', area: '2,890 m²', color: '#4a7c2c', selected: false },
    { id: 3, name: 'Calle Principal', type: 'Calles', classId: 'street', area: '1,562 m²', color: '#808080', selected: false },
    { id: 4, name: 'Área Verde C', type: 'Áreas Verdes', classId: 'green', area: '3,450 m²', color: '#4a7c2c', selected: false },
    { id: 5, name: 'Edificio 1', type: 'Edificios', classId: 'building', area: '2,340 m²', color: '#8b7355', selected: false },
    // Fila 2
    { id: 6, name: 'Área Verde D', type: 'Áreas Verdes', classId: 'green', area: '2,675 m²', color: '#4a7c2c', selected: false },
    { id: 7, name: 'Lago', type: 'Cuerpos de Agua', classId: 'water', area: '1,875 m²', color: '#4a90e2', selected: false },
    { id: 8, name: 'Área Verde E', type: 'Áreas Verdes', classId: 'green', area: '3,125 m²', color: '#4a7c2c', selected: false },
    { id: 9, name: 'Parqueadero', type: 'Parqueaderos', classId: 'parking', area: '2,250 m²', color: '#a9a9a9', selected: false },
    { id: 10, name: 'Edificio 2', type: 'Edificios', classId: 'building', area: '2,810 m²', color: '#8b7355', selected: false },
    // Fila 3
    { id: 11, name: 'Biblioteca', type: 'Edificios', classId: 'building', area: '1,950 m²', color: '#8b7355', selected: false },
    { id: 12, name: 'Avenida Sur', type: 'Calles', classId: 'street', area: '1,406 m²', color: '#808080', selected: false },
    { id: 13, name: 'Área Verde F', type: 'Áreas Verdes', classId: 'green', area: '2,340 m²', color: '#4a7c2c', selected: false },
    { id: 14, name: 'Calle Este', type: 'Calles', classId: 'street', area: '1,718 m²', color: '#808080', selected: false },
    { id: 15, name: 'Parqueadero 2', type: 'Parqueaderos', classId: 'parking', area: '1,875 m²', color: '#a9a9a9', selected: false },
    // Fila 4
    { id: 16, name: 'Parqueadero 3', type: 'Parqueaderos', classId: 'parking', area: '2,125 m²', color: '#a9a9a9', selected: false },
    { id: 17, name: 'Área Verde G', type: 'Áreas Verdes', classId: 'green', area: '3,675 m²', color: '#4a7c2c', selected: false },
    { id: 18, name: 'Edificio 3', type: 'Edificios', classId: 'building', area: '2,575 m²', color: '#8b7355', selected: false },
    { id: 19, name: 'Calle Oeste', type: 'Calles', classId: 'street', area: '1,562 m²', color: '#808080', selected: false },
    { id: 20, name: 'Fuente', type: 'Cuerpos de Agua', classId: 'water', area: '312 m²', color: '#4a90e2', selected: false }
  ];

  onFileSelect(file: File): void {
    this.uploadedFile = file?.name ?? '';
  }

  onCellHover(cell: MapCell): void {
    this.hoveredCell = cell;
  }

  onCellLeave(): void {
    this.hoveredCell = null;
  }

  onCellClick(cell: MapCell): void {
    cell.selected = !cell.selected;
  }

  onMonthFilterChange(): void {
    const selectedMonths = this.months.filter(m => m.selected);
    if (selectedMonths.length > 0) {
      this.activeMonth = selectedMonths[0].id;
    }
  }

  onClassFilterChange(): void {
    // Filtro se aplica automáticamente a través de getFilteredCells()
  }

  getFilteredCells(): MapCell[] {
    return this.mapCells.filter(cell => {
      const classType = this.classTypes.find(c => c.id === cell.classId);
      return classType?.selected;
    });
  }

  getSelectedMonths(): MonthFilter[] {
    return this.months.filter(m => m.selected);
  }

  setActiveMonth(monthId: string): void {
    this.activeMonth = monthId;
  }

  getStatusMessage(): string {
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      const labels = selectedMonths.map(m => m.label.split(' ')[0]).join(', ');
      return `Filtro temporal activo: ${labels} 2025`;
    } else if (selectedMonths.length === 1) {
      return 'Mapa segmentado listo para visualizar';
    }
    return 'Estado: Esperando carga de imagen';
  }

  getDashboardTitle(): string {
    const selectedCells = this.mapCells.filter(c => c.selected);
    if (selectedCells.length > 0) {
      return 'Resumen de Subregión';
    }
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      return 'Resumen Temporal';
    }
    return 'Resumen del Mapa';
  }

  getStatLabel(): string {
    const selectedCells = this.mapCells.filter(c => c.selected);
    if (selectedCells.length > 0) {
      return 'Celdas seleccionadas';
    }
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      return 'Períodos';
    }
    return 'Celdas visibles';
  }

  getVisibleCellsCount(): number {
    const selectedCells = this.mapCells.filter(c => c.selected);
    if (selectedCells.length > 0) {
      return selectedCells.length;
    }
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      return selectedMonths.length;
    }
    return this.getFilteredCells().length;
  }

  getCoverageLabel(): string {
    return 'Cobertura verde';
  }

  getCoveragePercentage(): number {
    const selectedCells = this.mapCells.filter(c => c.selected);
    const cells = selectedCells.length > 0 ? selectedCells : this.getFilteredCells();
    const greenCells = cells.filter(c => c.classId === 'green').length;
    return Math.round((greenCells / cells.length) * 100) || 0;
  }

  getClassDistribution(): ClassDistributionStat[] {
    const filteredCells = this.getFilteredCells();
    const totalCells = filteredCells.length || 1;
    
    return this.classTypes
      .filter(ct => ct.selected)
      .map(classType => {
        const count = filteredCells.filter(c => c.classId === classType.id).length;
        const percentage = Math.round((count / totalCells) * 100);
        return {
          label: classType.label,
          icon: classType.icon,
          percentage,
          gradient: this.getGradient(classType.id)
        };
      });
  }

  getGradient(classId: string): string {
    const gradients: { [key: string]: string } = {
      'green': 'linear-gradient(90deg, #4a7c2c, #6ba84a)',
      'building': 'linear-gradient(90deg, #8b7355, #6b5344)',
      'street': 'linear-gradient(90deg, #808080, #606060)',
      'parking': 'linear-gradient(90deg, #a9a9a9, #898989)',
      'water': 'linear-gradient(90deg, #4a90e2, #2e7cb0)'
    };
    return gradients[classId] || 'linear-gradient(90deg, #4a7c2c, #6ba84a)';
  }

  getChartData(): ChartBar[] {
    const distribution = this.getClassDistribution();
    return distribution.map(item => ({
      label: item.label.split(' ')[0],
      height: item.percentage,
      gradient: item.gradient
    }));
  }

  getToolbarInfo(): string {
    const selectedCells = this.mapCells.filter(c => c.selected);
    if (selectedCells.length > 0) {
      return `Subregión activa: ${selectedCells.length} celdas | ${this.getCoveragePercentage()}% cobertura verde`;
    }
    
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      const labels = selectedMonths.map(m => m.label.split(' ')[0]).join(', ');
      return `Período: ${labels} 2025 | Comparación de ${selectedMonths.length} mapas`;
    }
    
    const visibleCells = this.getFilteredCells().length;
    return `Mapa segmentado: ${selectedMonths[0]?.label || 'Octubre 2025'} | ${visibleCells} celdas visibles`;
  }

  clearFilters(): void {
    this.classTypes.forEach(ct => ct.selected = true);
    this.mapCells.forEach(c => c.selected = false);
  }

  downloadReport(): void {
    alert('Modal de descarga de informe - Funcionalidad simulada');
  }
}
