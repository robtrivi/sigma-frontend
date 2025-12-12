import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { SegmentsService } from '../../services/segments.service';
import { PixelCoverageItem } from '../../models/api.models';
import { getClassColor } from '../../models/class-catalog';

@Component({
  selector: 'app-dashboard-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-panel.component.html',
  styleUrls: ['./dashboard-panel.component.scss']
})
export class DashboardPanelComponent implements OnInit, OnChanges {
  @Input({ required: true }) dashboardTitle: string = '';
  @Input({ required: true }) statLabel: string = '';
  @Input({ required: true }) visibleCellsCount: number = 0;
  @Input({ required: true }) totalCells: number = 0;
  @Input({ required: true }) coverageLabel: string = '';
  @Input({ required: true }) coveragePercentage: number = 0;
  
  // ===== COBERTURA POR PÍXELES =====
  @Input() sceneId?: string;
  @Input() usePixelCoverage: boolean = false;
  @Input() imageResolution: string = '';
  @Input() selectedClassIds: string[] = []; // Clases seleccionadas para filtrado
  @Input() selectedClassesCount: number = 0; // Cantidad de clases seleccionadas
  
  pixelCoverageData: PixelCoverageItem[] = [];
  filteredPixelCoverageData: PixelCoverageItem[] = [];
  totalPixels: number = 262144; // 512 * 512
  filteredTotalPixels: number = 262144;
  isLoadingCoverage: boolean = false;
  coverageError?: string;

  constructor(private segmentsService: SegmentsService) {}

  ngOnInit(): void {
    if (this.sceneId) {
      this.loadPixelCoverage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cuando sceneId cambia, cargar los datos
    if (changes['sceneId'] && !changes['sceneId'].firstChange) {
      if (this.sceneId) {
        this.loadPixelCoverage();
      }
    }
    
    // Cuando selectedClassIds cambia, filtrar los datos
    if (changes['selectedClassIds']) {
      this.filterPixelCoverageByClass();
    }
  }

  loadPixelCoverage(): void {
    if (!this.sceneId) return;

    this.isLoadingCoverage = true;
    this.coverageError = undefined;

    this.segmentsService.getCoverage(this.sceneId).subscribe({
      next: (coverage) => {
        this.pixelCoverageData = coverage.coverage_by_class;
        this.totalPixels = coverage.total_pixels;
        this.filterPixelCoverageByClass();
        this.isLoadingCoverage = false;
      },
      error: (error) => {
        this.coverageError = 'Error al cargar cobertura por píxeles';
        this.isLoadingCoverage = false;
      }
    });
  }

  private filterPixelCoverageByClass(): void {
    if (this.selectedClassIds.length === 0) {
      // Si no hay clases seleccionadas, mostrar todas
      this.filteredPixelCoverageData = [...this.pixelCoverageData];
      this.filteredTotalPixels = this.totalPixels;
    } else {
      // Filtrar por clases seleccionadas
      // selectedClassIds contiene strings como 'grass', 'vegetation', etc.
      this.filteredPixelCoverageData = this.pixelCoverageData.filter(item => {
        // Buscar si el class_id (numérico) coincide con alguna clase seleccionada
        // Usamos la posición en CLASS_CATALOG para mapear class_id
        const classIdStr = this.getClassIdStringByIndex(item.class_id);
        return this.selectedClassIds.includes(classIdStr);
      });
      
      // Calcular total de píxeles filtrados
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
    }
  }

  private getClassIdStringByIndex(classIndex: number): string {
    // Mapear índice numérico a ID de clase
    // Los índices corresponden directamente a la posición en CLASS_CATALOG
    const classIds = [
      'unlabeled', 'paved-area', 'dirt', 'grass', 'gravel', 'water', 'rocks', 'pool',
      'vegetation', 'roof', 'wall', 'window', 'door', 'fence', 'fence-pole', 'person',
      'dog', 'car', 'bicycle', 'tree', 'bald-tree', 'ar-marker', 'obstacle', 'conflicting'
    ];
    return classIds[classIndex] || `class_${classIndex}`;
  }

  getColorForClass(className: string): string {
    // Mapear nombre de clase a ID de clase para obtener el color correcto
    const classNameToIdMap: { [key: string]: string } = {
      'Sin etiqueta': 'unlabeled',
      'Área pavimentada': 'paved-area',
      'Tierra': 'dirt',
      'Césped': 'grass',
      'Grava': 'gravel',
      'Agua': 'water',
      'Rocas': 'rocks',
      'Piscina': 'pool',
      'Vegetación': 'vegetation',
      'Techo': 'roof',
      'Pared': 'wall',
      'Ventana': 'window',
      'Puerta': 'door',
      'Cerca': 'fence',
      'Poste de cerca': 'fence-pole',
      'Persona': 'person',
      'Perro': 'dog',
      'Automóvil': 'car',
      'Bicicleta': 'bicycle',
      'Árbol': 'tree',
      'Árbol sin hojas': 'bald-tree',
      'Marcador AR': 'ar-marker',
      'Obstáculo': 'obstacle',
      'Conflicto': 'conflicting'
    };
    
    // Obtener el ID de clase correspondiente
    const classId = classNameToIdMap[className] || className.toLowerCase().replace(/\s+/g, '-');
    
    // Usar la función getClassColor del catalog que tiene todos los colores correctos
    return getClassColor(classId);
  }
}
