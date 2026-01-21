import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, Output, EventEmitter } from '@angular/core';
import { SegmentsService } from '../../services/segments.service';
import { ClassColorService } from '../../services/class-color.service';
import { ClassColorPickerComponent } from '../class-color-picker/class-color-picker.component';
import { PixelCoverageItem } from '../../models/api.models';
import { getClassColor } from '../../models/class-catalog';
import { NoThousandSeparatorPipe } from '../../pipes/no-thousand-separator.pipe';

@Component({
  selector: 'app-dashboard-panel',
  standalone: true,
  imports: [CommonModule, NoThousandSeparatorPipe, ClassColorPickerComponent],
  templateUrl: './dashboard-panel.component.html',
  styleUrls: ['./dashboard-panel.component.scss']
})
export class DashboardPanelComponent implements OnInit, OnChanges {
  @Input({ required: true }) dashboardTitle: string = '';
  @Input({ required: true }) statLabel: string = '';
  @Input({ required: true }) visibleSegmentsCount: number = 0;
  @Input({ required: true }) totalSegmentsCount: number = 0;
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
  @Input() totalAreaM2Input: number = 0; // Área total en m² del componente padre
  
  @Output() areaUnitChanged = new EventEmitter<'m2' | 'ha'>();
  @Output() visualizationTypeChanged = new EventEmitter<'mask' | 'original'>();
  @Output() classColorChanged = new EventEmitter<{ className: string; color: string }>();
  
  // ===== COLOR PICKER =====
  showColorPicker: boolean = false;
  selectedColorClass: string = '';
  selectedColorValue: string = '';
  originalClassColors: { className: string; color: string }[] = []; // Colores originales de todas las clases

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
  
  // ===== UNIDADES DE ÁREA =====
  areaUnit = signal<'m2' | 'ha'>('m2'); // 'm2' o 'ha'
  readonly M2_TO_HA = 0.0001; // Conversión: 1 m² = 0.0001 ha
  
  // ===== TIPO DE VISUALIZACIÓN =====
  visualizationType = signal<'mask' | 'original'>('mask'); // 'mask' o 'original'

  constructor(
    private segmentsService: SegmentsService,
    private classColorService: ClassColorService
  ) {}

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
        this.totalAreaM2 = this.totalAreaM2Input > 0 ? this.totalAreaM2Input : 262144.0;
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

    // Si ya tenemos datos del componente padre (máscaras agregadas), no cargar del API
    if (this.pixelCoverageDataInput && this.pixelCoverageDataInput.length > 0) {
      return;
    }

    this.isLoadingCoverage = true;
    this.coverageError = undefined;
    this.dataLoaded = false;  // Marcar como no cargado

    this.segmentsService.getCoverage(this.sceneId).subscribe({
      next: (coverage) => {
        // Filtrar para excluir "unlabeled"
        const allData = coverage.coverage_by_class || [];
        this.pixelCoverageData = allData.filter(item => 
          item.class_name?.toLowerCase() !== 'unlabeled'
        );
        
        // Recalcular totales sin la clase "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
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
      // Si no hay clases seleccionadas, mostrar todas excepto "unlabeled"
      this.filteredPixelCoverageData = [...this.pixelCoverageData]
        .filter(item => item.class_name !== 'unlabeled')  // Excluir "Sin etiqueta"
        .sort((a, b) => 
          (b.coverage_percentage || 0) - (a.coverage_percentage || 0)
        );
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    } else {
      // Filtrar por clases seleccionadas
      // Si tenemos class_id válido (no 0), usar ese; si no, mapear por class_name
      this.filteredPixelCoverageData = this.pixelCoverageData
        .filter(item => {
          // Primero intentar por class_id si es diferente de 0
          if (item.class_id && item.class_id !== 0) {
            const classIdStr = this.getClassIdStringByIndex(item.class_id);
            return this.selectedClassIds.includes(classIdStr);
          }
          
          // Si class_id es 0, intentar mapear por class_name
          // Mapear nombres de clases en español a IDs
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
          
          const classId = classNameToIdMap[item.class_name];
          return classId && this.selectedClassIds.includes(classId);
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

  // ===== CONVERSIÓN DE UNIDADES =====
  toggleAreaUnit(): void {
    this.areaUnit.update(current => current === 'm2' ? 'ha' : 'm2');
    this.areaUnitChanged.emit(this.areaUnit());
  }

  convertArea(areaM2: number): number {
    if (this.areaUnit() === 'ha') {
      return areaM2 * this.M2_TO_HA;
    }
    return areaM2;
  }

  getAreaUnitLabel(): string {
    return this.areaUnit() === 'm2' ? 'm²' : 'ha';
  }

  getAreaUnit(): 'm2' | 'ha' {
    return this.areaUnit();
  }

  toggleVisualizationType(): void {
    const newType = this.visualizationType() === 'mask' ? 'original' : 'mask';
    this.visualizationType.set(newType);
    this.visualizationTypeChanged.emit(newType);
  }

  getVisualizationTypeLabel(): string {
    const label = this.visualizationType() === 'mask' ? 'Máscara' : 'Original';
    return label;
  }

  // ===== MÉTODOS DE COLOR =====
  getClassColor(className: string): string {
    // Primero verificar si hay un color personalizado
    const customColor = this.classColorService.getColor(className);
    if (customColor) {
      return customColor;
    }
    // Si no hay color personalizado, usar el color por defecto del catálogo (método existente)
    return this.getColorForClass(className);
  }

  openColorPicker(className: string): void {
    this.selectedColorClass = className;
    this.selectedColorValue = this.getClassColor(className);
    
    // Construir lista de colores originales de TODAS las clases
    this.originalClassColors = [];
    if (this.pixelCoverageData && this.pixelCoverageData.length > 0) {
      this.pixelCoverageData.forEach(item => {
        if (item.class_name) {
          const color = this.getColorForClass(item.class_name);
          this.originalClassColors.push({
            className: item.class_name,
            color: color
          });
        }
      });
    }
    
    // Ordenar alfabéticamente por nombre de clase
    this.originalClassColors.sort((a, b) => a.className.localeCompare(b.className));
    
    this.showColorPicker = true;
  }

  onColorSelected(color: string): void {
    if (this.selectedColorClass) {
      this.classColorService.setColor(this.selectedColorClass, color);
      this.classColorChanged.emit({ className: this.selectedColorClass, color });
    }
    this.showColorPicker = false;
  }

  onColorPickerClose(): void {
    this.showColorPicker = false;
  }
}
