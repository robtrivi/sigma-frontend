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
  @Input() coverageAreaM2: number = 0;  // Área en metros cuadrados del elemento de cobertura
  @Input() selectedPeriodo: string = ''; // Período seleccionado
  
  // ===== COBERTURA POR PÍXELES =====
  @Input() sceneId?: string;
  @Input() usePixelCoverage: boolean = false;
  @Input() imageResolution: string = '';
  @Input() selectedClassIds: string[] = []; // Clases seleccionadas para filtrado
  @Input() selectedClassesCount: number = 0; // Cantidad de clases seleccionadas
  @Input() pixelCoverageDataInput: PixelCoverageItem[] = []; // Datos de cobertura del componente padre
  @Input() totalPixelsInput: number = 0; // Total de píxeles del componente padre
  
  pixelCoverageData: PixelCoverageItem[] = [];
  filteredPixelCoverageData: PixelCoverageItem[] = [];
  totalPixels: number = 262144; // 512 * 512
  totalAreaM2: number = 262144.0;  // Área total en m²
  pixelAreaM2: number = 1.0;  // Área por píxel en m²
  filteredTotalPixels: number = 262144;
  filteredTotalAreaM2: number = 262144.0;
  isLoadingCoverage: boolean = false;
  coverageError?: string;
  dataLoaded: boolean = false;  // Flag para rastrear si los datos han sido cargados

  constructor(private segmentsService: SegmentsService) {}

  ngOnInit(): void {
    if (this.sceneId) {
      this.loadPixelCoverage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cuando los datos vienen del componente padre (múltiples máscaras agregadas)
    // PERO solo si no tenemos datos del API (sceneId)
    if (changes['pixelCoverageDataInput'] && this.pixelCoverageDataInput && this.pixelCoverageDataInput.length > 0) {
      // Solo asignar si no hay sceneId (no se están cargando datos del API)
      if (!this.sceneId) {
        this.pixelCoverageData = [...this.pixelCoverageDataInput];
        this.totalPixels = this.totalPixelsInput > 0 ? this.totalPixelsInput : 262144;
        this.dataLoaded = true;
        this.filterPixelCoverageByClass();
      }
    }
    
    // Cuando sceneId cambia, cargar los datos individuales
    if (changes['sceneId'] && !changes['sceneId'].firstChange) {
      if (this.sceneId) {
        this.dataLoaded = false;  // Resetear flag cuando sceneId cambia
        this.loadPixelCoverage();
      }
    }
    
    // Cuando selectedClassIds cambia, filtrar SOLO si los datos han sido cargados
    if (changes['selectedClassIds'] && this.dataLoaded && this.pixelCoverageData && this.pixelCoverageData.length > 0) {
      this.filterPixelCoverageByClass();
    }
  }

  loadPixelCoverage(): void {
    if (!this.sceneId) return;

    this.isLoadingCoverage = true;
    this.coverageError = undefined;
    this.dataLoaded = false;  // Marcar como no cargado

    this.segmentsService.getCoverage(this.sceneId).subscribe({
      next: (coverage) => {
        // Asignar directamente sin transformación compleja
        this.pixelCoverageData = coverage.coverage_by_class || [];
        this.totalPixels = coverage.total_pixels ?? 262144;
        this.totalAreaM2 = coverage.total_area_m2 ?? 262144.0;
        this.pixelAreaM2 = coverage.pixel_area_m2 ?? 1.0;
        
        // Marcar como cargado ANTES de filtrar
        this.dataLoaded = true;
        
        this.filterPixelCoverageByClass();
        this.isLoadingCoverage = false;
      },
      error: (error) => {
        this.coverageError = 'Error al cargar cobertura por píxeles';
        this.isLoadingCoverage = false;
        this.dataLoaded = false;
      }
    });
  }

  private filterPixelCoverageByClass(): void {
    if (!this.pixelCoverageData || this.pixelCoverageData.length === 0) {
      return;
    }

    if (this.selectedClassIds.length === 0) {
      // Si no hay clases seleccionadas, mostrar todas
      this.filteredPixelCoverageData = [...this.pixelCoverageData].sort((a, b) => 
        (b.coverage_percentage || 0) - (a.coverage_percentage || 0)
      );
      this.filteredTotalPixels = this.totalPixels;
      this.filteredTotalAreaM2 = this.totalAreaM2;
    } else {
      // Filtrar por clases seleccionadas
      this.filteredPixelCoverageData = this.pixelCoverageData
        .filter(item => {
          const classIdStr = this.getClassIdStringByIndex(item.class_id);
          return this.selectedClassIds.includes(classIdStr);
        })
        .sort((a, b) => 
          (b.coverage_percentage || 0) - (a.coverage_percentage || 0)
        );
      
      // Calcular total de píxeles y área filtrados
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
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
