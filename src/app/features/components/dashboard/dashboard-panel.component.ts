import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, Output, EventEmitter } from '@angular/core';
import { SegmentsService } from '../../services/segments.service';
import { ClassColorService } from '../../services/class-color.service';
import { ClassColorPickerComponent } from '../class-color-picker/class-color-picker.component';
import { PixelCoverageItem } from '../../models/api.models';
import { getClassColor } from '../../models/class-catalog';
import { NoThousandSeparatorPipe } from '../../pipes/no-thousand-separator.pipe';
import { CoverageItemByCategory, groupCoverageByCategory, COVERAGE_CATEGORIES } from '../../models/coverage-categories';

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
  @Input() coveragePercentageForCategories: number = 0; // Porcentaje de cobertura en modo categorías (con datos completos)
  @Input() coverageAreaM2ForCategories: number = 0; // Área de cobertura en modo categorías (con datos completos)
  @Input() selectedPeriodo: string = ''; // Período seleccionado
  
  // ===== COBERTURA POR PÍXELES =====
  @Input() sceneId?: string;
  @Input() usePixelCoverage: boolean = false;
  @Input() imageResolution: string = '';
  @Input() selectedClassIds: string[] = []; // Clases seleccionadas para filtrado
  @Input() selectedClassesCount: number = 0; // Cantidad de clases seleccionadas
  @Input() pixelCoverageDataInput: PixelCoverageItem[] = []; // Datos de cobertura del componente padre (ya filtrados por clases)
  @Input() totalPixelsInput: number = 0; // Total de píxeles del componente padre
  @Input() totalAreaM2Input: number = 0; // Área total en m² del componente padre
  @Input() pixelCoverageDataCompleteInput: PixelCoverageItem[] = []; // Datos de cobertura SIN filtrar por clases (para modo categorías)
  @Input() totalPixelsCompleteInput: number = 0; // Total de píxeles completo (sin filtrar)
  @Input() totalAreaM2CompleteInput: number = 0; // Área total completa en m² (sin filtrar)
  @Input() selectedCategoryIds: string[] = []; // Categorías seleccionadas en el panel de control
  
  @Output() areaUnitChanged = new EventEmitter<'m2' | 'ha'>();
  @Output() visualizationTypeChanged = new EventEmitter<'mask' | 'original'>();
  @Output() classColorChanged = new EventEmitter<{ className: string; color: string }>();
  @Output() coverageModeChanged = new EventEmitter<'classes' | 'categories'>();
  
  // ===== COLOR PICKER =====
  showColorPicker: boolean = false;
  selectedColorClass: string = '';
  selectedColorValue: string = '';
  originalClassColors: { className: string; color: string }[] = []; // Colores originales de todas las clases
  
  selectedColorCategory: string = '';
  selectedCategoryColorValue: string = '';
  originalCategoryColors: { categoryName: string; color: string }[] = [];

  pixelCoverageData: PixelCoverageItem[] = [];
  filteredPixelCoverageData: PixelCoverageItem[] = [];
  totalPixels: number = 262144; // 512 * 512
  totalAreaM2: number = 262144;  // Área total en m²
  totalAreaM2Complete: number = 262144;  // Área total completa (sin filtrar por clases)
  pixelAreaM2: number = 1;  // Área por píxel en m²
  filteredTotalPixels: number = 262144;
  filteredTotalAreaM2: number = 262144;
  isLoadingCoverage: boolean = false;
  coverageError?: string;
  dataLoaded: boolean = false;  // Flag para rastrear si los datos han sido cargados
  
  // ===== UNIDADES DE ÁREA =====
  areaUnit = signal<'m2' | 'ha'>('m2'); // 'm2' o 'ha'
  readonly M2_TO_HA = 0.0001; // Conversión: 1 m² = 0.0001 ha
  
  // ===== TIPO DE VISUALIZACIÓN =====
  visualizationType = signal<'mask' | 'original'>('mask'); // 'mask' o 'original'
  
  // ===== AGRUPAMIENTO POR CATEGORÍAS =====
  coverageViewMode = signal<'classes' | 'categories'>('classes'); // 'classes' o 'categories'
  categorizedCoverageData: CoverageItemByCategory[] = [];

  get selectedCategoriesCount(): number {
    return this.categorizedCoverageData.length;
  }

  constructor(
    private readonly segmentsService: SegmentsService,
    private readonly classColorService: ClassColorService
  ) {}

  ngOnInit(): void {
    if (this.sceneId) {
      this.loadPixelCoverage();
    }
  }

  private handlePixelCoverageDataInputChange(): void {
    if (!this.pixelCoverageDataInput || this.pixelCoverageDataInput === undefined) {
      return;
    }

    if (this.pixelCoverageDataInput.length > 0) {
      this.pixelCoverageData = [...this.pixelCoverageDataInput];
      this.filteredPixelCoverageData = [...this.pixelCoverageDataInput];
      this.totalPixels = this.totalPixelsInput > 0 ? this.totalPixelsInput : 262144;
      this.totalAreaM2 = this.totalAreaM2Input > 0 ? this.totalAreaM2Input : 262144;
      this.filteredTotalPixels = this.totalPixels;
      this.filteredTotalAreaM2 = this.totalAreaM2;
      this.dataLoaded = true;
      
      if (this.coverageViewMode() === 'categories') {
        this.updateCategorizedCoverageData();
      }
    } else {
      this.pixelCoverageData = [];
      this.filteredPixelCoverageData = [];
      this.categorizedCoverageData = [];
      this.dataLoaded = false;
    }
  }

  private handlePixelCoverageDataCompleteInputChange(): void {
    if (!this.pixelCoverageDataCompleteInput || this.pixelCoverageDataCompleteInput === undefined) {
      return;
    }

    if (this.pixelCoverageDataCompleteInput.length > 0) {
      this.totalAreaM2Complete = this.totalAreaM2CompleteInput > 0 ? this.totalAreaM2CompleteInput : 262144;
    }
  }

  private handleSceneIdChange(changes: SimpleChanges): void {
    if (!changes['sceneId'] || changes['sceneId'].firstChange) {
      return;
    }

    // Si ya tenemos datos del componente padre (pixelCoverageDataInput),
    // no intentar cargar del API incluso si sceneId cambia
    // Esto previene cargar datos innecesarios cuando se está en modo agregado
    if (this.pixelCoverageDataInput && this.pixelCoverageDataInput.length > 0) {
      return;
    }

    if (this.sceneId) {
      this.dataLoaded = false;
      this.loadPixelCoverage();
    }
  }

  private handleSelectedClassIdsChange(): void {
    if (!this.dataLoaded || !this.pixelCoverageData || this.pixelCoverageData.length === 0) {
      return;
    }

    this.filterPixelCoverageByClass();
    
    if (this.coverageViewMode() === 'categories') {
      this.updateCategorizedCoverageData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pixelCoverageDataInput']) {
      this.handlePixelCoverageDataInputChange();
    }

    if (changes['pixelCoverageDataCompleteInput']) {
      this.handlePixelCoverageDataCompleteInputChange();
    }

    if (changes['sceneId']) {
      this.handleSceneIdChange(changes);
    }

    if (changes['selectedClassIds']) {
      this.handleSelectedClassIdsChange();
    }
  }

  loadPixelCoverage(): void {
    if (!this.sceneId) return;

    // Si ya tenemos datos del componente padre (máscaras agregadas), no cargar del API
    if (this.pixelCoverageDataInput && this.pixelCoverageDataInput.length > 0) {
      return;
    }

    // Validar que sceneId sea un UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.sceneId)) {
      console.warn('Invalid sceneId format, not loading coverage:', this.sceneId);
      return;
    }

    this.isLoadingCoverage = true;
    this.coverageError = undefined;
    this.dataLoaded = false;  // Marcar como no cargado

    this.segmentsService.getCoverage(this.sceneId).subscribe({
      next: (coverage) => {
        // Filtrar para excluir "unlabeled"
        const allData = coverage.coverageByClass || [];
        this.pixelCoverageData = allData.filter(item => 
          item.className?.toLowerCase() !== 'unlabeled'
        );
        
        // Recalcular totales sin la clase "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
        this.pixelAreaM2 = coverage.pixelAreaM2 ?? 1;
        
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
        .filter(item => item.className !== 'unlabeled')  // Excluir "Sin etiqueta"
        .sort((a, b) => 
          (b.coveragePercentage || 0) - (a.coveragePercentage || 0)
        );
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
    } else {
      // Filtrar por clases seleccionadas
      // Si tenemos class_id válido (no 0), usar ese; si no, mapear por class_name
      this.filteredPixelCoverageData = this.pixelCoverageData
        .filter(item => {
          // Primero intentar por classId si es diferente de 0
          if (item.classId && item.classId !== 0) {
            const classIdStr = this.getClassIdStringByIndex(item.classId);
            return this.selectedClassIds.includes(classIdStr);
          }
          
          // Si classId es 0, intentar mapear por className
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
          
          const classId = classNameToIdMap[item.className];
          return classId && this.selectedClassIds.includes(classId);
        })
        .sort((a, b) => 
          (b.coveragePercentage || 0) - (a.coveragePercentage || 0)
        );
      
      // Calcular total de píxeles y área filtrados
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
    }

    // Actualizar datos categorizados si está en modo categorías
    if (this.coverageViewMode() === 'categories') {
      this.updateCategorizedCoverageData();
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
    // Verificar si className es undefined o null
    if (!className) {
      return '#cccccc'; // Color gris por defecto para valores sin etiquetar
    }

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
    const classId = classNameToIdMap[className] || className.toLowerCase().replaceAll(' ', '-');
    
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
      for (const item of this.pixelCoverageData) {
        if (item.className) {
          const color = this.getColorForClass(item.className);
          this.originalClassColors.push({
            className: item.className,
            color: color
          });
        }
      }
    }
    
    // Ordenar alfabéticamente por nombre de clase
    this.originalClassColors.sort((a, b) => a.className.localeCompare(b.className));
    
    this.showColorPicker = true;
  }

  onColorSelected(color: string): void {
    if (this.selectedColorClass) {
      this.classColorService.setColor(this.selectedColorClass, color);
      this.classColorChanged.emit({ className: this.selectedColorClass, color });
    } else if (this.selectedColorCategory) {
      this.onCategoryColorSelected(color);
      return;
    }
    this.showColorPicker = false;
  }

  openCategoryColorPicker(categoryName: string): void {
    this.selectedColorCategory = categoryName;
    
    // Obtener el color actual personalizado de la categoría (si existe)
    // Si no existe, obtener el color original de COVERAGE_CATEGORIES
    let categoryColor = this.classColorService.getCategoryColor(categoryName);
    if (!categoryColor) {
      // Buscar el color original de la categoría
      const originalCategory = COVERAGE_CATEGORIES.find(cat => cat.name === categoryName);
      categoryColor = originalCategory?.color || '#000000';
    }
    this.selectedCategoryColorValue = categoryColor;
    
    // Construir lista de colores originales de TODAS las categorías desde COVERAGE_CATEGORIES
    // Los colores originales NO deben cambiar aunque personalices el color
    this.originalCategoryColors = COVERAGE_CATEGORIES.map(cat => ({
      categoryName: cat.name,
      color: cat.color  // Usar el color original de COVERAGE_CATEGORIES, no el personalizado
    }));
    
    // Ordenar alfabéticamente
    this.originalCategoryColors.sort((a: any, b: any) => a.categoryName.localeCompare(b.categoryName));
    
    this.showColorPicker = true;
  }

  onCategoryColorSelected(color: string): void {
    if (this.selectedColorCategory) {
      // Guardar el color de categoría de forma independiente (sin afectar colores de clases)
      this.classColorService.setCategoryColor(this.selectedColorCategory, color);
      
      // Buscar la categoría y actualizar su color en memoria
      const category = this.categorizedCoverageData.find(c => c.categoryName === this.selectedColorCategory);
      if (category) {
        category.categoryColor = color;
        
        // Forzar detección de cambios en el array
        this.categorizedCoverageData = [...this.categorizedCoverageData];
      }
      
      // Emitir el cambio
      this.classColorChanged.emit({ className: this.selectedColorCategory, color });
    }
    this.showColorPicker = false;
  }

  // ===== MÉTODOS PARA AGRUPAMIENTO POR CATEGORÍAS =====
  changeCoverageViewMode(mode: 'classes' | 'categories'): void {
    this.coverageViewMode.set(mode);
    this.coverageModeChanged.emit(mode);  // Emitir cambio al componente padre
    if (mode === 'categories') {
      this.updateCategorizedCoverageData();
    }
  }

  private updateCategorizedCoverageData(): void {
    // Cuando se cambia a modo categorías, usar los datos COMPLETOS sin filtrar por clases individuales
    // para mostrar información completa de todas las categorías
    const dataForCategories = this.pixelCoverageDataCompleteInput.length > 0 
      ? this.pixelCoverageDataCompleteInput 
      : this.pixelCoverageData;
    
    const totalAreaForCategories = this.totalAreaM2CompleteInput > 0 
      ? this.totalAreaM2CompleteInput 
      : this.totalAreaM2;
    
    const allCategorizedData = groupCoverageByCategory(
      dataForCategories,
      totalAreaForCategories
    );
    
    // Filtrar solo las categorías que están seleccionadas en el panel de control
    if (this.selectedCategoryIds && this.selectedCategoryIds.length > 0) {
      this.categorizedCoverageData = allCategorizedData.filter(cat => 
        this.selectedCategoryIds.includes(cat.categoryId)
      );
    } else {
      // Si no hay categorías seleccionadas, mostrar todas (no debería pasar en uso normal)
      this.categorizedCoverageData = allCategorizedData;
    }
    
    // Aplicar colores personalizados del servicio a las categorías
    for (const category of this.categorizedCoverageData) {
      // Obtener el color personalizado de la categoría desde el servicio
      const customColor = this.classColorService.getCategoryColor(category.categoryName);
      if (customColor) {
        category.categoryColor = customColor;
      }
    }
  }

  getMappedCategoryColors(): { className: string; color: string }[] {
    // Mapear categoryName a className para compatibilidad con el componente color-picker
    // Usar SIEMPRE los colores originales de las categorías, NO los personalizados
    const mapped = this.originalCategoryColors.map(cat => ({
      className: (cat as any).categoryName,
      color: cat.color
    }));
    
    return mapped;
  }

  onCategoryColorChanged(categoryName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newColor = input.value;
    
    // Actualizar el color en el dashboard
    const categoryData = this.categorizedCoverageData.find(cat => cat.categoryName === categoryName);
    if (categoryData) {
      categoryData.categoryColor = newColor;
    }
    
    // Guardar el color de categoría en el servicio (sin afectar colores de clases)
    this.classColorService.setCategoryColor(categoryName, newColor);
    
    // Emitir evento para que Leaflet se recargue
    this.classColorChanged.emit({ className: `category:${categoryName}`, color: newColor });
  }

  onColorPickerClose(): void {
    this.showColorPicker = false;
    this.selectedColorClass = '';
    this.selectedColorCategory = '';
  }
}
