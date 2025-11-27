import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { VisualizationService } from './services/visualization.service';
import { MapCell, MapLegend, SubRegion } from './models/map.model';

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './visualization.component.html',
  styleUrls: ['./visualization.component.scss']
})
export class VisualizationComponent implements OnInit {
  private visualizationService = inject(VisualizationService);
  private messageService = inject(MessageService);

  protected mapCells = signal<MapCell[]>([]);
  protected legend = signal<MapLegend[]>([]);
  protected hoveredCell = signal<MapCell | null>(null);
  protected selectedCells = signal<MapCell[]>([]);
  protected subRegion = signal<SubRegion | null>(null);
  protected loading = signal(true);

  ngOnInit() {
    this.loadMapData();
  }

  private loadMapData() {
    this.loading.set(true);

    this.visualizationService.generateMapCells().subscribe(cells => {
      this.mapCells.set(cells);
      this.loading.set(false);
    });

    this.visualizationService.getMapLegend().subscribe(legend => {
      this.legend.set(legend);
    });
  }

  onCellHover(cell: MapCell) {
    this.hoveredCell.set(cell);
  }

  onCellLeave() {
    this.hoveredCell.set(null);
  }

  onCellClick(cell: MapCell) {
    const cells = this.mapCells();
    const index = cells.findIndex(c => c.id === cell.id);
    
    if (index !== -1) {
      cells[index].selected = !cells[index].selected;
      this.mapCells.set([...cells]);
      
      const selected = cells.filter(c => c.selected);
      this.selectedCells.set(selected);

      if (selected.length > 0) {
        this.analyzeSubRegion(selected.map(c => c.id));
      } else {
        this.subRegion.set(null);
      }
    }
  }

  private analyzeSubRegion(cellIds: string[]) {
    this.visualizationService.getSubRegionAnalysis(cellIds).subscribe(subRegion => {
      this.subRegion.set(subRegion);
    });
  }

  clearSelection() {
    const cells = this.mapCells().map(c => ({ ...c, selected: false }));
    this.mapCells.set(cells);
    this.selectedCells.set([]);
    this.subRegion.set(null);
  }

  getCellColor(type: string): string {
    const colors: Record<string, string> = {
      green: '#4a7c2c',
      building: '#8b7355',
      street: '#808080',
      parking: '#a9a9a9',
      water: '#4a90e2'
    };
    return colors[type] || '#cccccc';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      green: 'Áreas Verdes',
      building: 'Edificios',
      street: 'Calles',
      parking: 'Parqueaderos',
      water: 'Cuerpos de Agua'
    };
    return labels[type] || type;
  }
}
