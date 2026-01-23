import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassType, MonthFilter } from '../../models/visualization.models';
import { SegmentFeature, Region } from '../../models/api.models';
import { RegionsService } from '../../services/regions.service';
import { TiffValidationService, TiffValidationResult } from '../../services/tiff-validation.service';
import { COVERAGE_CATEGORIES } from '../../models/coverage-categories';

export interface SceneUploadData {
  file: File;
  captureDate: string;
  epsg: number;
  sensor: string;
  regionId: string;
}

export interface SelectableCategory {
  id: string;
  name: string;
  selected: boolean;
  color: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent implements OnInit, OnChanges {
  @Input({ required: true }) uploadedFile: string = '';
  @Input({ required: true }) hoveredFeature: SegmentFeature | null = null;
  @Input({ required: true }) months: MonthFilter[] = [];
  @Input({ required: true }) classTypes: ClassType[] = [];
  @Input() isLoading: boolean = false;
  @Input() canRunSegmentation: boolean = false;
  @Input() coverageViewMode: 'classes' | 'categories' = 'classes'; // Nueva entrada

  @Output() sceneUpload = new EventEmitter<SceneUploadData>();
  @Output() runSegmentation = new EventEmitter<void>();
  @Output() monthFilterChange = new EventEmitter<void>();
  @Output() classFilterChange = new EventEmitter<void>();
  @Output() selectedCategoriesChange = new EventEmitter<string[]>();

  selectedFile: File | null = null;
  captureDate: string = '';
  epsg: number = 32717;
  sensor: string = 'drone_dji_phantom';
  regionId: string = '';
  regions: Region[] = [];
  regionsLoading: boolean = true;
  regionsError: string | null = null;

  // Validación TIFF
  tiffValidating: boolean = false;
  tiffValidationResult: TiffValidationResult | null = null;
  tiffValidationError: string | null = null;
  showTiffInfo: boolean = false;

  // Categorías para modo de cobertura por categorías
  selectableCategories: SelectableCategory[] = [];

  constructor(
    private readonly regionsService: RegionsService,
    private readonly tiffValidationService: TiffValidationService
  ) {}

  ngOnInit(): void {
    this.loadRegions();
    this.initializeCategories();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cuando cambia el modo de cobertura a categorías, deseleccionar todas las categorías
    if (changes['coverageViewMode'] && !changes['coverageViewMode'].firstChange) {
      if (this.coverageViewMode === 'categories') {
        // Deseleccionar todas las categorías para mostrar todas por defecto
        for (const cat of this.selectableCategories) {
          cat.selected = false;
        }
        this.emitSelectedCategories();
      }
    }
  }

  private initializeCategories(): void {
    this.selectableCategories = COVERAGE_CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      selected: false,
      color: cat.color
    }));
  }

  // Getter para devolver las clases ordenadas alfabéticamente para el panel de control
  get sortedClassTypes(): ClassType[] {
    return [...this.classTypes].sort((a, b) => a.label.localeCompare(b.label));
  }

  private loadRegions(): void {
    this.regionsLoading = true;
    this.regionsError = null;
    this.regionsService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        this.regionsLoading = false;
        if (regions.length > 0) {
          this.regionId = regions[0].id;
        } else {
          this.regionsError = 'No hay regiones disponibles';
        }
      },
      error: (err) => {
        this.regionsLoading = false;
        this.regionsError = `Error cargando regiones: ${err.message}`;
        console.error('Error cargando regiones:', err);
      }
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.tiffValidationError = null;
      this.tiffValidationResult = null;
      this.showTiffInfo = false;

      // Validar TIFF automáticamente
      this.validateSelectedTiff();

      // Auto-llenar fecha si no está establecida
      if (!this.captureDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        this.captureDate = `${year}-${month}-${day}`;
      }
    }
  }

  validateSelectedTiff(): void {
    if (!this.selectedFile) return;

    this.tiffValidating = true;
    this.tiffValidationError = null;

    this.tiffValidationService.validateTiff(this.selectedFile, this.epsg).subscribe({
      next: (result) => {
        this.tiffValidationResult = result;
        this.tiffValidating = false;

        // Solo mostrar error si la validación falló, no por advertencias
        if (result.valid) {
          // TIFF válido - limpiar error aunque haya advertencias
          this.tiffValidationError = null;
        } else {
          this.tiffValidationError = 'El TIFF no es válido. Revisa las advertencias arriba.';
        }

        // Auto-llenar EPSG si está disponible en el TIFF
        if (result.epsgCode && result.epsgCode !== this.epsg) {
          this.epsg = result.epsgCode;
        }
      },
      error: (err) => {
        this.tiffValidating = false;
        this.tiffValidationError = 'Error validando TIFF: ' + (err.error?.detail || err.message);
      }
    });
  }

  toggleTiffInfo(): void {
    this.showTiffInfo = !this.showTiffInfo;
  }

  onUploadScene(): void {
    if (!this.selectedFile) {
      console.error('❌ No se ha seleccionado archivo');
      return;
    }

    // Validar que TIFF sea válido
    if (this.tiffValidationResult && !this.tiffValidationResult.valid) {
      console.error('❌ TIFF inválido según validación');
      alert('No se puede cargar un TIFF inválido. Revisa las advertencias arriba.');
      return;
    }

    if (!this.captureDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.captureDate = `${year}-${month}-${day}`;
    }

    this.sceneUpload.emit({
      file: this.selectedFile,
      captureDate: this.captureDate,
      epsg: this.epsg,
      sensor: this.sensor,
      regionId: this.regionId
    });
  }

  get canUpload(): boolean {
    return (
      !!this.selectedFile &&
      !this.isLoading &&
      !this.tiffValidating &&
      (!this.tiffValidationResult || this.tiffValidationResult.valid)
    );
  }

  onRunSegmentation(): void {
    this.runSegmentation.emit();
  }

  notifyMonthChange(): void {
    this.monthFilterChange.emit();
  }

  toggleMonth(selectedMonth: MonthFilter): void {
    const selectedCount = this.months.filter(m => m.selected).length;
    
    // Si es el único seleccionado y intenta deseleccionarlo, no lo permite
    if (selectedMonth.selected && selectedCount === 1) {
      return;
    }
    
    selectedMonth.selected = !selectedMonth.selected;
    this.monthFilterChange.emit();
  }

  isMonthDisabled(month: MonthFilter): boolean {
    // Desabilitar si es el único seleccionado
    return month.selected && this.months.filter(m => m.selected).length === 1;
  }

  notifyClassChange(): void {
    this.classFilterChange.emit();
  }

  selectAllClasses(): void {
    for (const classType of this.classTypes) {
      classType.selected = true;
    }
    this.classFilterChange.emit();
  }

  deselectAllClasses(): void {
    for (const classType of this.classTypes) {
      classType.selected = false;
    }
    this.classFilterChange.emit();
  }

  selectAllCategories(): void {
    for (const cat of this.selectableCategories) {
      cat.selected = true;
    }
    this.syncCategoriesWithClasses();
    this.emitSelectedCategories();
    this.classFilterChange.emit();
  }

  deselectAllCategories(): void {
    for (const cat of this.selectableCategories) {
      cat.selected = false;
    }
    this.syncCategoriesWithClasses();
    this.emitSelectedCategories();
    this.classFilterChange.emit();
  }

  areAllCategoriesSelected(): boolean {
    return this.selectableCategories.length > 0 && this.selectableCategories.every(cat => cat.selected);
  }

  areAnyCategoriesSelected(): boolean {
    return this.selectableCategories.some(cat => cat.selected);
  }

  onCategoryChange(): void {
    this.syncCategoriesWithClasses();
    this.emitSelectedCategories();
    this.classFilterChange.emit();
  }

  private emitSelectedCategories(): void {
    const selectedIds = this.selectableCategories
      .filter(cat => cat.selected)
      .map(cat => cat.id);
    this.selectedCategoriesChange.emit(selectedIds);
  }

  private syncCategoriesWithClasses(): void {
    // Obtener clases de las categorías seleccionadas
    const selectedCategoryIds = new Set(this.selectableCategories
      .filter(cat => cat.selected)
      .map(cat => cat.id));

    const classesInSelectedCategories = new Set<string>();
    const selectedCategories = COVERAGE_CATEGORIES
      .filter(cat => selectedCategoryIds.has(cat.id));
    
    for (const cat of selectedCategories) {
      for (const className of cat.classes) {
        classesInSelectedCategories.add(className);
      }
    }

    // Actualizar selección de clases
    for (const ct of this.classTypes) {
      ct.selected = classesInSelectedCategories.has(ct.label);
    }
  }

  areAllClassesSelected(): boolean {
    return this.classTypes.length > 0 && this.classTypes.every(ct => ct.selected);
  }

  areAnyClassesSelected(): boolean {
    return this.classTypes.some(ct => ct.selected);
  }

  selectAllMonths(): void {
    for (const month of this.months) {
      month.selected = true;
    }
    this.monthFilterChange.emit();
  }

  deselectAllMonths(): void {
    for (const month of this.months) {
      month.selected = false;
    }
    // Marcar el período más reciente
    const mostRecentMonth = this.findMostRecentMonth();
    if (mostRecentMonth) {
      mostRecentMonth.selected = true;
    }
    this.monthFilterChange.emit();
  }

  areAllMonthsSelected(): boolean {
    return this.months.length > 0 && this.months.every(m => m.selected);
  }

  areAnyMonthsSelected(): boolean {
    return this.months.some(m => m.selected);
  }

  private findMostRecentMonth(): MonthFilter | undefined {
    if (this.months.length === 0) return undefined;
    
    return this.months.reduce((mostRecent, current) => {
      const [currentYear, currentMonth] = current.id.split('-').map(Number);
      const [recentYear, recentMonth] = mostRecent.id.split('-').map(Number);
      
      // Comparar primero por año, luego por mes
      if (currentYear > recentYear || (currentYear === recentYear && currentMonth > recentMonth)) {
        return current;
      }
      
      return mostRecent;
    }, this.months[0]);
  }
}
