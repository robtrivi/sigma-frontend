import { Component, OnInit, signal, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeafletMapComponent } from '../components/leaflet-map/leaflet-map.component';
import { ControlPanelComponent, SceneUploadData } from '../components/control-panel/control-panel.component';
import { DashboardPanelComponent } from '../components/dashboard/dashboard-panel.component';
import { VisualizationHeaderComponent } from '../components/header/visualization-header.component';
import { DownloadModalComponent } from '../components/download-modal/download-modal.component';
import { ClearDataConfirmationDialogComponent } from '../components/clear-data-confirmation-dialog/clear-data-confirmation-dialog.component';
import { SegmentationProgressDialogComponent } from '../components/segmentation-progress-dialog/segmentation-progress-dialog.component';
import { MaskLoadingDialogComponent } from '../components/mask-loading-dialog/mask-loading-dialog.component';
import { LoadingDialogComponent } from '../components/loading-dialog/loading-dialog.component';
import { ChartBar, ClassDistributionStat, ClassType, MonthFilter } from '../models/visualization.models';
import { ReportGeneratorService, PeriodReportData } from '../services/report-generator.service';
import { ScenesService } from '../services/scenes.service';
import { SegmentsService } from '../services/segments.service';
import { RegionsService } from '../services/regions.service';
import { ClassColorService } from '../services/class-color.service';
import { SegmentFeature, SceneResponse, Region, PeriodInfo, PixelCoverageItem, SegmentationCoverageResponse } from '../models/api.models';
import { CLASS_CATALOG, getClassConfig } from '../models/class-catalog';
import { COVERAGE_CATEGORIES, CoverageCategory } from '../models/coverage-categories';
import { finalize, firstValueFrom, of, combineLatest, Observable } from 'rxjs';

export type ReportFormat = 'pdf' | 'csv';
export type RegionType = 'full' | 'subregion' | 'green-only';

@Component({
  selector: 'app-visualization-sigma',
  standalone: true,
  imports: [
    CommonModule,
    LeafletMapComponent,
    ControlPanelComponent,
    DashboardPanelComponent,
    VisualizationHeaderComponent,
    DownloadModalComponent,
    ClearDataConfirmationDialogComponent,
    SegmentationProgressDialogComponent,
    MaskLoadingDialogComponent,
    LoadingDialogComponent
  ],
  templateUrl: './visualization-sigma.component.html',
  styleUrls: ['./visualization-sigma.component.scss']
})
export class VisualizationSigmaComponent implements OnInit {
  @ViewChild(SegmentationProgressDialogComponent) progressDialog?: SegmentationProgressDialogComponent;
  @ViewChild(LeafletMapComponent) leafletMap?: LeafletMapComponent;
  
  uploadedFile: string = '';
  hoveredFeature: SegmentFeature | null = null;
  showDownloadModal: boolean = false;
  isLoading = signal(false);
  loadingMessage = signal('');
  errorMessage = signal('');
  
  // Progress dialog
  showProgressDialog = signal(false);
  progressSceneId = signal<string | null>(null);
  
  currentScene: SceneResponse | null = null;
  segmentFeatures = signal<SegmentFeature[]>([]);
  selectedRegionId: string = '';
  selectedPeriodo: string = '';
  regions: Region[] = [];
  availablePeriods: PeriodInfo[] = [];
  currentMaskImageUrl: string = '';  // Máscara actual guardada desde Leaflet

  // ===== COBERTURA POR PÍXELES =====
  pixelCoverageData: PixelCoverageItem[] = [];
  filteredPixelCoverageData: PixelCoverageItem[] = [];
  totalPixels: number = 262144; // 512 * 512
  totalAreaM2: number = 262144;  // Área total en m²
  pixelAreaM2: number = 1;  // Área por píxel en m²
  filteredTotalPixels: number = 262144;
  filteredTotalAreaM2: number = 262144;  // Área filtrada en m²
  usePixelCoverage: boolean = false; // Cambiar a true cuando hay escena cargada
  isLoadingAggregatedCoverage: boolean = false;
  
  // ===== MÁSCARAS MÚLTIPLES =====
  multipleMaskImages: string[] = [];  // URLs de máscaras múltiples para reportes
  multipleMaskMetadata: any[] = [];  // Metadatos de máscaras (sceneId, captureDate, etc.)
  
  // ===== DATOS DE MÚLTIPLES PERÍODOS PARA REPORTES =====
  multiPeriodReportData: PeriodReportData[] = [];  // Datos para cada período seleccionado en reportes

  // ===== UNIDADES DE ÁREA =====
  selectedAreaUnit: 'm2' | 'ha' = 'm2';  // Unidad de área seleccionada en el dashboard

  // ===== VISTA DE COBERTURA =====
  coverageViewMode = signal<'classes' | 'categories'>('classes');  // Modo de vista: clases o categorías
  selectedCategoryIds: string[] = [];  // Categorías seleccionadas en el panel de control

  // ===== DIÁLOGOS =====
  showClearDataConfirmation: boolean = false;  // Diálogo de confirmación de borrado
  showMaskLoadingDialog = signal(false);  // Diálogo de carga de máscaras
  maskLoadingPeriodLabel = signal('');  // Etiqueta del período en el diálogo de carga
  showReportGeneratingDialog = signal(false);  // Diálogo de generación de informe
  reportGeneratingTitle = signal('Generando Informe');  // Título del diálogo de generación
  reportGeneratingMessage = signal('Por favor espere...');  // Mensaje del diálogo de generación
  showVisualizationLoadingDialog = signal(false);  // Diálogo de carga de visualización
  visualizationLoadingTitle = signal('');  // Título del diálogo de carga de visualización
  visualizationLoadingMessage = signal('Por favor espere...');  // Mensaje del diálogo de carga de visualización
  visualizationType = signal<'mask' | 'original'>('mask');  // Tipo de visualización: máscara o imagen original

  months: MonthFilter[] = [
    { id: '2024-08', label: 'Agosto 2024', selected: false },
    { id: '2024-09', label: 'Septiembre 2024', selected: false },
    { id: '2024-10', label: 'Octubre 2024', selected: false },
    { id: '2024-11', label: 'Noviembre 2024', selected: true }
  ];
  
  // Período activo actual (usado cuando hay múltiples períodos seleccionados)
  activeMonth: string = '2024-11'; // Inicializar con el período más reciente

  classTypes: ClassType[] = CLASS_CATALOG
    .filter(c => c.id !== 'unlabeled')  // Excluir "Sin etiqueta"
    .map(c => ({
      id: c.id,
      label: c.name,
      color: c.color,
      icon: c.icon,
      selected: false
    }));

  constructor(
    private readonly reportGenerator: ReportGeneratorService,
    private readonly scenesService: ScenesService,
    private readonly segmentsService: SegmentsService,
    private readonly regionsService: RegionsService,
    private readonly classColorService: ClassColorService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.regionsService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        if (regions.length > 0 && !this.selectedRegionId) {
          this.selectedRegionId = regions[0].id;
          this.loadAvailablePeriods();
        }
      },
      error: () => {}
    });
    
    // ===== CARGAR PÍXELES SI HAY ESCENA EN SESIÓN =====
    if (this.currentScene?.sceneId) {
      this.loadPixelCoverage(this.currentScene.sceneId);
    }
    // ==================================================
  }

  get canRunSegmentation(): boolean {
    return !!this.currentScene;
  }

  onRegionChange(regionId: string): void {
    if (this.selectedRegionId === regionId) return;
    
    this.selectedRegionId = regionId;
    this.selectedPeriodo = '';
    this.activeMonth = '';
    this.currentScene = null;
    this.segmentFeatures.set([]);
    
    this.loadAvailablePeriods();
  }

  private loadAvailablePeriods(): void {
    if (!this.selectedRegionId) return;

    this.segmentsService.getAvailablePeriods(this.selectedRegionId).subscribe({
      next: (periods) => {
        this.availablePeriods = periods;
        
        if (periods.length > 0) {
          // Por defecto, seleccionar el período más reciente (comparando año y mes)
          const mostRecentPeriod = this.findMostRecentPeriod(periods.map(p => p.periodo));
          this.activeMonth = mostRecentPeriod;
          this.selectedPeriodo = mostRecentPeriod;
        }
        
        this.months = periods.map(p => ({
          id: p.periodo,
          label: this.formatPeriodoLabel(p.periodo),
          selected: p.periodo === this.selectedPeriodo // Solo el período activo
        }));
        
        if (periods.length > 0) {
          this.loadSegmentsTiles();
        }
      },
      error: () => {}
    });
  }

  /**
   * Encuentra el período más reciente comparando año y mes
   * Formato esperado: YYYY-MM (ej: 2025-12, 2024-11)
   */
  private findMostRecentPeriod(periods: string[]): string {
    if (periods.length === 0) return '';
    
    return periods.reduce((mostRecent, current) => {
      const [currentYear, currentMonth] = current.split('-').map(Number);
      const [recentYear, recentMonth] = mostRecent.split('-').map(Number);
      
      // Comparar primero por año, luego por mes
      if (currentYear > recentYear || (currentYear === recentYear && currentMonth > recentMonth)) {
        return current;
      }
      
      return mostRecent;
    }, periods[0]);
  }

  private formatPeriodoLabel(periodo: string): string {
    const [year, month] = periodo.split('-');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[Number.parseInt(month) - 1]} ${year}`;
  }

  onSceneUpload(data: SceneUploadData): void {
    this.isLoading.set(true);
    this.loadingMessage.set('Cargando escena TIFF...');
    this.errorMessage.set('');

    // ✅ MOSTRAR DIÁLOGO DE PROGRESO INMEDIATAMENTE (antes de la respuesta HTTP)
    this.showProgressDialog.set(true);
    const tempSceneId = `temp-${Date.now()}`;
    this.progressSceneId.set(tempSceneId);
    
    if (this.progressDialog) {
      this.progressDialog.startStreaming(tempSceneId);
    }

    this.scenesService.uploadScene({
      file: data.file,
      captureDate: data.captureDate,
      epsg: data.epsg,
      sensor: data.sensor,
      regionId: data.regionId
    })
    .pipe(finalize(() => {
      this.isLoading.set(false);
      this.loadingMessage.set('');
    }))
    .subscribe({
      next: (scene) => {
        // ✅ Actualizar el sceneId real cuando llegue la respuesta
        this.progressSceneId.set(scene.sceneId);
        
        if (this.progressDialog) {
          this.progressDialog.startStreaming(scene.sceneId);
        }
        
        this.currentScene = scene;
        this.uploadedFile = data.file.name;
        this.selectedRegionId = scene.regionId;
        
        const periodo = scene.captureDate.substring(0, 7);
        this.selectedPeriodo = periodo;
        
        this.loadAvailablePeriods();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Error al cargar la escena');
        this.showProgressDialog.set(false); // Cerrar diálogo si hay error
      }
    });
  }

  onProgressDialogClose(): void {
    this.showProgressDialog.set(false);
    this.progressSceneId.set(null);
  }

  onVisualizeMapa(sceneId: string): void {
    // Cargar cobertura por píxeles
    this.loadPixelCoverage(sceneId);
    // Cerrar diálogo
    this.showProgressDialog.set(false);
    this.progressSceneId.set(null);
    // Recargar navegador
    setTimeout(() => {
      globalThis.location.reload();
    }, 500);
  }

  private loadPixelCoverage(sceneId: string): void {
    if (!sceneId) {
      this.usePixelCoverage = false;
      return;
    }

    this.segmentsService.getCoverage(sceneId).subscribe({
      next: (coverage: SegmentationCoverageResponse) => {
        // Validar que la respuesta tiene datos
        if (!coverage?.coverageByClass || coverage.coverageByClass.length === 0) {
          console.warn('No coverage data returned from API for sceneId:', sceneId);
          this.pixelCoverageData = [];
          this.filteredPixelCoverageData = [];
          this.totalPixels = 0;
          this.totalAreaM2 = 0;
          this.usePixelCoverage = false;
          return;
        }

        // Filtrar para excluir "unlabeled" y items con className undefined/null
        this.pixelCoverageData = coverage.coverageByClass.filter(item => {
          // Excluir items con className undefined, null o vacío
          if (!item || !item.className || item.className.trim() === '') {
            return false;
          }
          return item.className.toLowerCase() !== 'unlabeled';
        });
        
        // Recalcular totales sin "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
        this.pixelAreaM2 = coverage.pixelAreaM2 ?? 1;
        this.filterPixelCoverageByClass();
        this.usePixelCoverage = true;
      },
      error: (err) => {
        console.error('Error loading pixel coverage for sceneId:', sceneId, err);
        this.pixelCoverageData = [];
        this.filteredPixelCoverageData = [];
        this.totalPixels = 0;
        this.totalAreaM2 = 0;
        this.usePixelCoverage = false;
      }
    });
  }

  private loadAggregatedPixelCoverage(regionId: string, periodo: string): void {
    if (this.isLoadingAggregatedCoverage) {
      return;
    }

    this.isLoadingAggregatedCoverage = true;

    this.segmentsService.getAggregatedPixelCoverage(regionId, periodo).subscribe({
      next: (response: any) => {
        // Validar que la respuesta tiene datos
        if (!response?.coverageByClass || response.coverageByClass.length === 0) {
          console.warn('No coverage data returned from API');
          this.pixelCoverageData = [];
          this.filteredPixelCoverageData = [];
          this.totalPixels = 0;
          this.totalAreaM2 = 0;
          this.usePixelCoverage = false;
          return;
        }

        // Convertir respuesta a formato PixelCoverageItem[] y filtrar "unlabeled"
        this.pixelCoverageData = response.coverageByClass
          .filter((item: any) => {
            // Excluir items con className undefined, null o vacío
            // Nota: El API devuelve class_name (snake_case), no className (camelCase)
            const className = item.class_name || item.className;
            if (!className || className.trim() === '') {
              return false;
            }
            const isUnlabeled = className.toLowerCase() === 'unlabeled';
            return !isUnlabeled;
          })
          .map((item: any) => ({
            classId: 0, // No usamos classId en este contexto
            className: item.class_name || item.className,
            pixelCount: item.pixel_count || item.pixelCount || 0,
            coveragePercentage: item.coverage_percentage || item.coveragePercentage || 0,
            areaM2: item.area_m2 || item.areaM2 || 0
          }));

        // Recalcular totales sin "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
        this.pixelAreaM2 = response.pixelAreaM2 ?? 1;
        
        this.filterPixelCoverageByClass();
        this.usePixelCoverage = true;
      },
      error: (err) => {
        console.error('Error loading aggregated pixel coverage:', err);
        this.pixelCoverageData = [];
        this.filteredPixelCoverageData = [];
        this.totalPixels = 0;
        this.totalAreaM2 = 0;
        this.usePixelCoverage = false;
      },
      complete: () => {
        this.isLoadingAggregatedCoverage = false;
      }
    });
  }

  private filterPixelCoverageByClass(): void {
    let filtered: PixelCoverageItem[];
    
    if (this.classTypes.filter(c => c.selected).length === 0) {
      // Si no hay clases seleccionadas, mostrar todas excepto "unlabeled"
      filtered = this.pixelCoverageData
        .filter(item => {
          // Excluir items con className undefined, null o vacío
          if (!item.className || item.className.trim() === '') {
            return false;
          }
          return item.className.toLowerCase() !== 'unlabeled' && item.className !== 'Sin etiqueta';
        });
    } else {
      // Filtrar por clases seleccionadas
      const selectedLabels = this.classTypes
        .filter(c => c.selected)
        .map(c => c.label.toLowerCase());
      
      filtered = this.pixelCoverageData.filter(item => {
        // Excluir items con className undefined, null o vacío
        if (!item.className || item.className.trim() === '') {
          return false;
        }
        const itemClassName = item.className.toLowerCase();
        return selectedLabels.some(label => itemClassName.includes(label));
      });
    }
    
    // Asegurar que es una nueva referencia para triggear change detection
    this.filteredPixelCoverageData = [...filtered];
    
    // Calcular totales
    this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixelCount, 0);
    this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.areaM2 || 0), 0);
    
    // Forzar detección de cambios para que Angular detecte el cambio en el binding
    this.cdr.detectChanges();
  }

  // Manejar cambio de modo de vista de cobertura (clases vs categorías)
  /**
   * Obtiene todas las clases que pertenecen a las categorías seleccionadas
   */
  private getClassesForSelectedCategories(): string[] {
    const selectedClasses: string[] = [];
    
    // Para cada categoría seleccionada
    for (const categoryId of this.selectedCategoryIds) {
      // Encontrar la categoría en COVERAGE_CATEGORIES
      const category = COVERAGE_CATEGORIES.find((cat: CoverageCategory) => cat.id === categoryId);
      if (category) {
        // Agregar todas sus clases a la lista
        selectedClasses.push(...category.classes);
      }
    }
    
    return selectedClasses;
  }

  onCoverageModeChanged(mode: 'classes' | 'categories'): void {
    this.coverageViewMode.set(mode);
    
    if (mode === 'categories') {
      // Deseleccionar todas las clases
      for (const classType of this.classTypes) {
        classType.selected = false;
      }
      // Deseleccionar todas las categorías para mostrar todas por defecto
      this.selectedCategoryIds = [];
      
      // Filtrar los datos para reflejar la deselección de clases en el dashboard
      this.filterPixelCoverageByClass();
      
      // NO modificar colores de clases. Los colores de categorías se manejan por separado
      // en el dashboard y no afectan los colores de clases individuales
      
      // Recargar segmentos sin filtros para mostrar todas las categorías
      if (this.selectedRegionId && this.selectedPeriodo) {
        this.loadSegmentsTiles();
        
        // Forzar a Leaflet a recargar máscaras después de detectar el cambio de clases
        // Hacemos esto en un setTimeout para asegurar que Angular detect changes primero
        setTimeout(() => {
          if (this.leafletMap) {
            // Limpiar el estado de caché de clases para forzar recarga
            this.leafletMap['lastMultipleMaskClasses'] = null;
            // Llamar directamente a loadMasksForPeriod
            this.leafletMap['loadMasksForPeriod']?.();
          }
        }, 100);
      }
    } else {
      // Cuando se cambia back a 'classes', marcar las clases de las categorías seleccionadas
      // Si hay categorías seleccionadas, marcar todas sus clases
      // Si no hay categorías seleccionadas, deseleccionar todas las clases
      const classesToSelect = this.getClassesForSelectedCategories();
      
      for (const classType of this.classTypes) {
        classType.selected = classesToSelect.includes(classType.label);
      }
      
      // Filtrar los datos para reflejar los cambios en el dashboard
      this.filterPixelCoverageByClass();
      
      // Recargar segmentos con colores de clase originales
      if (this.selectedRegionId && this.selectedPeriodo) {
        this.loadSegmentsTiles();
        
        // Forzar a Leaflet a recargar máscaras
        setTimeout(() => {
          if (this.leafletMap) {
            this.leafletMap['lastMultipleMaskClasses'] = null;
            this.leafletMap['loadMasksForPeriod']?.();
          }
        }, 100);
      }
    }
  }

  onSelectedCategoriesChange(categoryIds: string[]): void {
    this.selectedCategoryIds = categoryIds;
  }

  onRunSegmentation(): void {
    if (this.selectedRegionId) {
      this.loadSegmentsTiles();
    }
  }

  private loadSegmentsTiles(): void {
    if (!this.selectedRegionId) {
      this.errorMessage.set('No hay región seleccionada');
      return;
    }

    if (!this.selectedPeriodo && this.availablePeriods.length === 0) {
      this.errorMessage.set('No hay periodos disponibles. Sube una escena primero.');
      return;
    }

    if (!this.selectedPeriodo && this.availablePeriods.length > 0) {
      this.selectedPeriodo = this.availablePeriods[0].periodo;
      for (const m of this.months) {
        m.selected = m.id === this.selectedPeriodo;
      }
    }

    // Cargar cobertura agregada automáticamente cuando hay período Y no hay escena individual
    if (this.selectedPeriodo && this.selectedRegionId && !this.currentScene?.sceneId) {
      this.loadAggregatedPixelCoverage(this.selectedRegionId, this.selectedPeriodo);
    }

    this.isLoading.set(true);
    this.loadingMessage.set('Cargando segmentos...');
    this.errorMessage.set('');

    const selectedClassIds = this.classTypes
      .filter(c => c.selected)
      .map(c => c.id);

    const params: any = {
      regionId: this.selectedRegionId,
      periodo: this.selectedPeriodo,
      classIds: selectedClassIds.length > 0 ? selectedClassIds : undefined
    };

    this.segmentsService.getSegmentsTiles(params)
    .pipe(finalize(() => {
      this.isLoading.set(false);
      this.loadingMessage.set('');
      this.errorMessage.set('');
      
      // Respetar el tipo de visualización seleccionado: si estaba en "original", mantenerlo
      if (this.visualizationType() === 'original') {
        setTimeout(() => {
          this.onVisualizationTypeChanged('original');
        }, 500);
      }
      
      // Cerrar el diálogo de carga de máscaras después de 5 segundos
      setTimeout(() => {
        this.showMaskLoadingDialog.set(false);
      }, 10000);
    }))
    .subscribe({
      next: (response) => {
        this.segmentFeatures.set(response.features);
        const modeLabel = params.periodo 
          ? this.formatPeriodoLabel(params.periodo) 
          : 'todos los periodos';
        this.loadingMessage.set(`${response.features.length} segmentos cargados (${modeLabel})`);
        
        // NO establecer currentScene aquí - solo se establece cuando el usuario carga una escena explícitamente
        // Los datos agregados se cargan en loadAggregatedPixelCoverage() y NO deben ser sobrescritos
      },
      error: (err) => {
        console.error('Error cargando segmentos:', err);
        this.errorMessage.set(err.error?.message || 'Error al cargar segmentos');
        this.segmentFeatures.set([]);
      }
    });
  }

  onFeatureClick(feature: SegmentFeature): void {
  }

  onMultipleMasksLoaded(event: { regionId: string; periodo: string; maskImages: string[]; maskMetadata?: any[] }): void {
    // Se llamó cuando se cargan múltiples máscaras de un período
    // Guardar las imágenes de máscaras para reportes
    this.multipleMaskImages = event.maskImages || [];
    // Guardar los metadatos de las máscaras (incluye sceneId, captureDate, etc.)
    this.multipleMaskMetadata = event.maskMetadata || [];
    
    // Solo cargar píxeles agregados si NO hay una escena individual seleccionada
    if (!this.currentScene?.sceneId) {
      // No crear un sceneId temporal - mantener currentScene en null/undefined
      // para indicar que se está en modo de datos agregados
      // El dashboard usará los datos pasados mediante pixelCoverageDataInput en su lugar
      
      this.loadAggregatedPixelCoverage(event.regionId, event.periodo);
    }
  }

  onMonthFilterChange(): void {
    const selectedMonths = this.months.filter(m => m.selected);
    if (selectedMonths.length > 0) {
      // Si el período activo actual ya no está seleccionado, cambiar al primero seleccionado
      const currentActiveMonth = this.months.find(m => m.id === this.activeMonth);
      if (!currentActiveMonth?.selected) {
        this.activeMonth = selectedMonths[0].id;
      }
      // Si hay solo 1 período seleccionado, asegurar que sea el activo
      if (selectedMonths.length === 1 && this.activeMonth !== selectedMonths[0].id) {
        this.activeMonth = selectedMonths[0].id;
      }
      this.selectedPeriodo = this.activeMonth;
      
      // Resetear la escena actual cuando cambia el período desde el filtro temporal
      this.currentScene = null;
      
      if (this.selectedRegionId) {
        this.loadSegmentsTiles();
      }
    }
  }

  onClassFilterChange(): void {
    // Solo filtrar píxeles cuando cambian las clases, no recargar
    this.filterPixelCoverageByClass();
    
    // Recargar segmentos tiles solo si hay período seleccionado (no para múltiples máscaras)
    if (this.selectedRegionId && !this.selectedPeriodo) {
      this.loadSegmentsTiles();
    }
  }

  getFilteredFeatures(): SegmentFeature[] {
    return this.segmentFeatures().filter(feature => {
      const classType = this.classTypes.find(c => c.id === feature.properties.classId);
      return classType?.selected;
    });
  }

  getSelectedMonths(): MonthFilter[] {
    return this.months.filter(m => m.selected);
  }

  setActiveMonth(monthId: string): void {
    this.activeMonth = monthId;
    this.selectedPeriodo = monthId;
    
    // Resetear la escena actual cuando cambia el período
    this.currentScene = null;
    
    if (this.selectedRegionId) {
      // Mostrar el diálogo de carga
      const monthLabel = this.months.find(m => m.id === monthId)?.label || monthId;
      this.maskLoadingPeriodLabel.set(monthLabel);
      this.showMaskLoadingDialog.set(true);
      
      this.loadSegmentsTiles();
    }
  }

  getStatusMessage(): string {
    if (this.errorMessage()) {
      return `Error: ${this.errorMessage()}`;
    }
    if (this.loadingMessage()) {
      return this.loadingMessage();
    }
    
    if (!this.currentScene && !this.usePixelCoverage) {
      if (this.availablePeriods.length === 0) {
        return 'No hay periodos disponibles. Sube una escena TIFF para comenzar.';
      }
      return 'Selecciona una escena para visualizar la máscara.';
    }
    
    return 'Máscara cargada';
  }

  getSelectedPeriodoLabel(): string {
    return this.selectedPeriodo 
      ? this.formatPeriodoLabel(this.selectedPeriodo)
      : 'Sin periodo';
  }

  getDashboardTitle(): string {
    return 'Datos Generales';
  }

  getStatLabel(): string {
    const selectedMonths = this.getSelectedMonths();
    
    // Si hay cobertura por píxeles, mostrar eso
    if (this.usePixelCoverage) {
      return 'Total de Píxeles';
    }
    
    if (selectedMonths.length > 1) {
      return 'Períodos';
    }
    return 'Segmentos totales';
  }

  getVisibleSegmentsCount(): number {
    const selectedMonths = this.getSelectedMonths();
    
    // Si hay cobertura por píxeles, mostrar el total de píxeles FILTRADOS
    if (this.usePixelCoverage) {
      return this.filteredTotalPixels;
    }
    
    if (selectedMonths.length > 1) {
      return selectedMonths.length;
    }
    
    const count = this.getFilteredFeatures().length;
    return count;
  }

  getCoverageLabel(): string {
    return 'Áreas Verdes';
  }

  getCoveragePercentage(): number {
    // Determinar qué datos usar según el modo de vista
    // En modo categorías, usar TODOS los datos sin filtrar por clases
    let dataToUse = this.filteredPixelCoverageData;
    let areaToUse = this.filteredTotalAreaM2;
    
    // Nota: coverageViewMode() no está disponible en el componente padre,
    // así que usamos una aproximación: si hay clases seleccionadas Y estamos en modo categorías,
    // debemos recalcular. Sin embargo, como el modo se controla en el dashboard,
    // aquí simplemente usamos los datos filtrados siempre para "Por Clases"
    // y los datos completos se usan implícitamente cuando NO hay clases seleccionadas.
    // Para solucionar esto correctamente, necesitamos un signal que indique el modo.
    
    // Por ahora, implementar una solución: si hay clases seleccionadas,
    // recalcular también con datos completos como backup
    if (this.usePixelCoverage && this.filteredPixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = dataToUse
        .filter(item => {
          // Proteger contra className undefined o null
          // Soportar tanto camelCase como snake_case del API
          const className = item.className || item.class_name;
          if (!className) return false;
          const classNameLower = className.toLowerCase();
          return vegetationClasses.some(vc => 
            classNameLower.includes(vc.toLowerCase())
          );
        })
        .reduce((sum, item) => sum + ((item.areaM2 || item.area_m2) || 0), 0);
      
      // Calcular porcentaje basado en área: (área de vegetación / área total) * 100
      const percentage = areaToUse > 0 
        ? (vegetationAreaM2 / areaToUse) * 100 
        : 0;
      
      return Number.parseFloat(percentage.toFixed(2));
    }
    
    // Fallback: usar segmentos
    const features = this.getFilteredFeatures();
    if (features.length === 0) return 0;
    
    const totalSegments = features.length;
    const vegetationClasses = new Set(['grass', 'vegetation', 'tree', 'bald-tree']);
    const vegetationSegments = features
      .filter(f => vegetationClasses.has(f.properties.classId))
      .length;
    
    const percentage = totalSegments > 0 ? Number.parseFloat(((vegetationSegments / totalSegments) * 100).toFixed(2)) : 0;
    return percentage;
  }

  /**
   * Calcula la cobertura de vegetación usando TODOS los datos sin filtrar por clases
   * Se usa en modo categorías
   */
  getCoveragePercentageForCategories(): number {
    if (this.usePixelCoverage && this.pixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = this.pixelCoverageData
        .filter(item => {
          // Proteger contra className undefined o null
          // Soportar tanto camelCase como snake_case del API
          const className = item.className || item.class_name;
          if (!className) return false;
          const classNameLower = className.toLowerCase();
          return vegetationClasses.some(vc => 
            classNameLower.includes(vc.toLowerCase())
          );
        })
        .reduce((sum, item) => sum + ((item.areaM2 || item.area_m2) || 0), 0);
      
      const percentage = this.totalAreaM2 > 0 
        ? (vegetationAreaM2 / this.totalAreaM2) * 100 
        : 0;
      
      return Number.parseFloat(percentage.toFixed(2));
    }
    
    return 0;
  }

  getCoverageAreaM2(): number {
    // Obtener el área en m² de vegetación usando los mismos criterios que getCoveragePercentage
    if (this.usePixelCoverage && this.filteredPixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = this.filteredPixelCoverageData
        .filter(item => {
          // Proteger contra className undefined o null
          // Soportar tanto camelCase como snake_case del API
          const className = item.className || item.class_name;
          if (!className) return false;
          const classNameLower = className.toLowerCase();
          return vegetationClasses.some(vc => 
            classNameLower.includes(vc.toLowerCase())
          );
        })
        .reduce((sum, item) => sum + ((item.areaM2 || item.area_m2) || 0), 0);
      
      return Number.parseFloat(vegetationAreaM2.toFixed(2));
    }
    
    // Fallback: retornar 0 si no hay cobertura por píxeles
    return 0;
  }

  /**
   * Calcula el área de vegetación usando TODOS los datos sin filtrar por clases
   * Se usa en modo categorías
   */
  getCoverageAreaM2ForCategories(): number {
    if (this.usePixelCoverage && this.pixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = this.pixelCoverageData
        .filter(item => {
          // Proteger contra className undefined o null
          // Soportar tanto camelCase como snake_case del API
          const className = item.className || item.class_name;
          if (!className) return false;
          const classNameLower = className.toLowerCase();
          return vegetationClasses.some(vc => 
            classNameLower.includes(vc.toLowerCase())
          );
        })
        .reduce((sum, item) => sum + ((item.areaM2 || item.area_m2) || 0), 0);
      
      return Number.parseFloat(vegetationAreaM2.toFixed(2));
    }
    
    return 0;
  }

  getClassDistribution(): ClassDistributionStat[] {
    // Si hay cobertura por píxeles, usarla
    if (this.usePixelCoverage && this.pixelCoverageData.length > 0) {
      return this.pixelCoverageData
        .filter(pixelItem => pixelItem.className) // Filtrar items sin className
        .map(pixelItem => {
          // Encontrar el classType correspondiente
          const classType = this.classTypes.find(ct => 
            ct.id.toLowerCase().includes(pixelItem.className!.toLowerCase()) ||
            pixelItem.className!.toLowerCase().includes(ct.label.toLowerCase())
          );
          
          return {
            label: pixelItem.className || 'Unknown',
            icon: classType?.icon || 'pi pi-map-marker',
            percentage: pixelItem.coveragePercentage,
            gradient: classType ? this.getGradient(classType.id) : 'linear-gradient(90deg, #999999, #999999dd)'
          };
        })
        .filter(item => item.percentage > 0); // Solo mostrar clases con cobertura
    }
    
    // Fallback: usar segmentos
    
    const features = this.getFilteredFeatures();
    if (features.length === 0) {
      return [];
    }

    const totalSegments = features.length;
    const distribution = this.classTypes
      .filter(ct => ct.selected)
      .map(classType => {
        const classFeatures = features.filter(f => f.properties.classId === classType.id);
        const segmentCount = classFeatures.length;
        const percentage = totalSegments > 0 ? Number.parseFloat(((segmentCount / totalSegments) * 100).toFixed(2)) : 0;
        
        return {
          label: classType.label,
          icon: classType.icon,
          percentage,
          gradient: this.getGradient(classType.id)
        };
      });
    
    return distribution;
  }

  getGradient(classId: string): string {
    const config = getClassConfig(classId);
    const color = config.color;
    return `linear-gradient(90deg, ${color}, ${color}dd)`;
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
    // Si hay cobertura por píxeles, mostrar eso
    if (this.usePixelCoverage) {
      const periodoLabel = this.selectedPeriodo 
        ? this.formatPeriodoLabel(this.selectedPeriodo)
        : 'Sin periodo';
      
      // Usar la misma lógica que getCoveragePercentage()
      const vegetationCoverage = this.getCoveragePercentage();
      
      // Usar filteredTotalAreaM2 para que cambie según las clases seleccionadas
      const info = `Período: ${periodoLabel} | Área total (m²): ${this.filteredTotalAreaM2.toFixed(2)} | Áreas Verdes: ${vegetationCoverage.toFixed(2)}%`;
      return info;
    }
    
    // Fallback: usar segmentos
    const features = this.getFilteredFeatures();
    if (features.length === 0) {
      return 'No hay segmentos para mostrar';
    }
    
    const periodoLabel = this.selectedPeriodo 
      ? this.formatPeriodoLabel(this.selectedPeriodo)
      : 'Todos los periodos';
    
    const totalSegments = features.length;
    const vegetationClasses = new Set(['grass', 'vegetation', 'tree', 'bald-tree']);
    const vegetationFeatures = features.filter(f => vegetationClasses.has(f.properties.classId));
    const vegetationPercentage = this.getCoveragePercentage();
    
    const info = `Período: ${periodoLabel} | Total: ${totalSegments} segmentos | Áreas Verdes: ${vegetationFeatures.length} (${vegetationPercentage}%)`;
    return info;
  }

  getSelectedClassIds(): string[] {
    return this.classTypes
      .filter(c => c.selected)
      .map(c => c.id);
  }

  getSelectedClassesCountForDashboard(): number {
    const selectedCount = this.getSelectedClassIds().length;
    // Si no hay clases seleccionadas, mostrar el total de clases disponibles (24)
    // porque la máscara muestra todas las clases cuando ninguna está seleccionada
    return selectedCount === 0 ? this.classTypes.length : selectedCount;
  }

  downloadReport(): void {
    this.showDownloadModal = true;
  }

  onDownloadModalClose(): void {
    this.showDownloadModal = false;
  }

  showClearDataDialog(): void {
    this.showClearDataConfirmation = true;
  }

  onClearDataDialogClose(): void {
    this.showClearDataConfirmation = false;
  }

  onClearDataConfirm(): void {
    this.segmentsService.clearAllData().subscribe({
      next: (response: any) => {
        // Recargar el frontend después de 1 segundo para que el usuario vea que se completó
        setTimeout(() => {
          globalThis.location.reload();
        }, 1000);
      },
      error: (err) => {
        console.error('Error clearing data:', err);
        alert('Error al borrar los datos. Por favor, intenta de nuevo.');
      }
    });
  }

  onMaskLoaded(maskImageUrl: string): void {
    // Capturar la máscara cuando se carga en Leaflet
    this.currentMaskImageUrl = maskImageUrl;
  }

  private getCurrentMaskImageUrl(): string {
    // Obtener la URL de la máscara guardada
    return this.currentMaskImageUrl;
  }

  private loadDataForMultiPeriodReport(data: { format: string; content: string[]; region: string }): void {
    const selectedMonths = this.getSelectedMonths();
    
    // Si solo hay un período, generar reporte simple
    if (selectedMonths.length === 1) {
      this.generateSinglePeriodReport(data);
      return;
    }

    // Para múltiples períodos, cargar datos de cada uno replicando loadAggregatedPixelCoverage
    const requests: any[] = [];
    
    for (const month of selectedMonths) {
      // Cargar cobertura agregada para cada período
      requests.push(
        this.segmentsService.getAggregatedPixelCoverage(this.selectedRegionId, month.id)
      );
    }
    
    // También cargar máscaras para cada período
    const maskRequests: Observable<any>[] = [];
    const classesToShow = this.classTypes.filter((c: ClassType) => c.selected).map((c: ClassType) => c.id);
    const allClassIds = this.classTypes.map((c: ClassType) => c.id);
    const classIdsToUse = classesToShow.length > 0 ? classesToShow : allClassIds;
    const makeUnlabeledTransparent = data.format === 'pdf'; // Para PDFs, hacer transparentes los píxeles "unlabeled"
    
    for (const month of selectedMonths) {
      // Cargar máscaras para cada período
      maskRequests.push(
        this.segmentsService.getMasksForPeriod(this.selectedRegionId, month.id, classIdsToUse, undefined, makeUnlabeledTransparent)
      );
    }

    // Validar que hay solicitudes antes de usar forkJoin
    if (requests.length === 0 || maskRequests.length === 0) {
      this.generateSinglePeriodReport(data);
      return;
    }

    // Ejecutar todas las solicitudes en paralelo
    if (requests.length === 0 && maskRequests.length === 0) {
      this.handleMultiPeriodResponses([], selectedMonths, data);
      return;
    }
    
    const allRequests: Observable<any>[] = [...requests, ...maskRequests];
    (allRequests.length > 0 ? combineLatest(allRequests) : of([] as any)).subscribe({
      next: (allResponses: any[]) => this.handleMultiPeriodResponses(allResponses, selectedMonths, data),
      error: (err: any) => this.handleMultiPeriodError(err, data)
    });
  }

  private handleMultiPeriodResponses(allResponses: any[], selectedMonths: any[], data: { format: string; content: string[]; region: string }): void {
    // Las primeras N respuestas son cobertura, las siguientes N son máscaras
    const coverageResponses = allResponses.slice(0, selectedMonths.length);
    const maskResponses = allResponses.slice(selectedMonths.length);
    
    // Procesar respuestas igual que loadAggregatedPixelCoverage hace
    this.multiPeriodReportData = selectedMonths
      .map((month, index) => this.processPeriodData(month, coverageResponses[index], maskResponses[index]))
      .filter((p: any) => p !== null) as PeriodReportData[];

    // Eliminar fondo negro de todas las máscaras
    this.removeBlackBackgroundFromAllMasks(() => {
      // Verificar si tenemos datos válidos
      if (this.multiPeriodReportData.length === 0) {
        console.warn('No valid data for multiple periods, using current period');
        // Fallback será manejado por el error handler
        return;
      }
      
      // Generar el reporte con múltiples períodos
      this.generateMultiPeriodReport({ format: data.format as ReportFormat, content: data.content, region: data.region as RegionType });
    });
  }

  private processPeriodData(month: any, response: any, maskResponse: any): PeriodReportData | null {
    // Validar que la respuesta de cobertura tenga la estructura esperada
    if (!response?.coverageByClass || !Array.isArray(response.coverageByClass)) {
      console.warn(`No valid coverage data for period ${month.label}`);
      return null;
    }
    
    // Procesar igual que en loadAggregatedPixelCoverage (con manejo de snake_case/camelCase)
    const pixelCoverageData = response.coverageByClass
      .filter((item: any) => {
        const className = item.class_name || item.className;
        if (!className || className.trim() === '') {
          return false;
        }
        const isUnlabeled = className.toLowerCase() === 'unlabeled';
        return !isUnlabeled;
      })
      .map((item: any) => ({
        classId: 0,
        className: item.class_name || item.className,
        pixelCount: item.pixel_count || item.pixelCount || 0,
        coveragePercentage: item.coverage_percentage || item.coveragePercentage || 0,
        areaM2: item.area_m2 || item.areaM2 || 0
      }));
    
    const filteredPixelCoverageData = this.filterPixelCoverageBySelectedClasses(pixelCoverageData);
    const filteredTotalAreaM2 = filteredPixelCoverageData.reduce((sum: number, item: any) => sum + (item.areaM2 || 0), 0);
    
    // Calcular cobertura de vegetación
    const vegetationAreaM2 = this.calculateVegetationArea(filteredPixelCoverageData);
    const vegetationPercentage = filteredTotalAreaM2 > 0 ? (vegetationAreaM2 / filteredTotalAreaM2) * 100 : 0;
    
    // Procesar máscaras del período
    const masks = maskResponse?.masks || [];
    const multipleMasks = this.buildMasksArray(masks, pixelCoverageData);
    
    return {
      monthLabel: month.label,
      periodo: month.id,
      pixelCoverageData: pixelCoverageData,
      filteredPixelCoverageData: filteredPixelCoverageData,
      vegetationCoveragePercentage: Number.parseFloat(vegetationPercentage.toFixed(2)),
      vegetationAreaM2: vegetationAreaM2,
      totalAreaM2: filteredTotalAreaM2,
      multipleMasks: multipleMasks,
      isMultipleMasks: masks.length > 0
    };
  }

  private filterPixelCoverageBySelectedClasses(pixelCoverageData: any[]): any[] {
    if (this.classTypes.filter((c: ClassType) => c.selected).length === 0) {
      // Si no hay clases seleccionadas, mostrar todas excepto "unlabeled"
      return pixelCoverageData.filter((item: any) => item.className?.toLowerCase() !== 'unlabeled' && item.className !== 'Sin etiqueta');
    }
    
    // Filtrar por clases seleccionadas
    const selectedLabels = this.classTypes
      .filter((c: ClassType) => c.selected)
      .map((c: ClassType) => c.label);
    return pixelCoverageData.filter((item: any) =>
      selectedLabels.some((label: string) => item.className?.includes(label))
    );
  }

  private calculateVegetationArea(pixelCoverageData: any[]): number {
    const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
    return pixelCoverageData
      .filter((item: any) => item.className && vegetationClasses.some((vc: string) => 
        item.className.includes(vc) || item.className.toLowerCase().includes(vc.toLowerCase())
      ))
      .reduce((sum: number, item: any) => sum + (item.areaM2 || 0), 0);
  }

  private buildMasksArray(masks: any[], pixelCoverageData: any[]): any[] | undefined {
    if (masks.length === 0) {
      return undefined;
    }
    
    return masks.map((maskData: any) => ({
      sceneId: maskData.sceneId,
      captureDate: maskData.captureDate,
      imageUrl: maskData.image,
      pixelCoverageData: pixelCoverageData
    }));
  }

  private handleMultiPeriodError(err: any, data: { format: string; content: string[]; region: string }): void {
    console.error('Error loading multi-period data:', err);
    // Fallback: generar reporte con datos actuales
    this.generateSinglePeriodReport(data);
  }

  /**
   * Filtra los datos de cobertura de píxeles para incluir solo las clases seleccionadas
   * Si no hay clases seleccionadas, devuelve todos los datos
   */
  private getPixelCoverageDataForReport(pixelCoverageData: PixelCoverageItem[]): PixelCoverageItem[] {
    const selectedClassIds = this.getSelectedClassIds();
    
    // Si no hay clases seleccionadas, devolver todos los datos
    if (selectedClassIds.length === 0) {
      return pixelCoverageData;
    }
    
    // Filtrar solo las clases seleccionadas
    return pixelCoverageData.filter(item => 
      selectedClassIds.includes(String(item.classId))
    );
  }

  private generateSinglePeriodReport(data: { format: string; content: string[]; region: string }): void {
    const activeMonthLabel = this.getSelectedMonths()[0]?.label || 'Noviembre 2024';
    
    // Si es PDF, recargar la máscara con transparencia para "unlabeled"
    if (data.format === 'pdf' && this.selectedRegionId && this.selectedPeriodo) {
      this.reloadMaskForReport(() => {
        const maskImageUrl = this.getCurrentMaskImageUrl();
        this.generateReportWithMask(data, maskImageUrl, activeMonthLabel);
      });
    } else {
      const maskImageUrl = this.getCurrentMaskImageUrl();
      this.generateReportWithMask(data, maskImageUrl, activeMonthLabel);
    }
  }

  private reloadMaskForReport(callback: () => void): void {
    const classesToShow = this.getSelectedClassIds();
    const customColors = this.classColorService.getColorsForRendering(this.coverageViewMode());
    
    this.segmentsService.getMasksForPeriod(
      this.selectedRegionId,
      this.selectedPeriodo,
      classesToShow.length > 0 ? classesToShow : undefined,
      customColors,
      true  // makeUnlabeledTransparent: true para reportes PDF
    ).subscribe({
      next: (response: any) => {
        if (response?.masks && response.masks.length > 0) {
          this.currentMaskImageUrl = response.masks[0].image;
        }
        callback();
      },
      error: () => {
        // Si hay error, usar la máscara actual
        callback();
      }
    });
  }

  private generateReportWithMask(data: { format: string; content: string[]; region: string }, maskImageUrl: string, activeMonthLabel: string): void {
    
    // Preparar datos de máscaras múltiples si existen
    const multipleMasks = this.usePixelCoverage && this.multipleMaskImages.length > 0
      ? this.multipleMaskImages.map((imageUrl, index) => ({
          sceneId: this.multipleMaskMetadata[index]?.sceneId || `Escena ${index + 1}`,
          captureDate: this.multipleMaskMetadata[index]?.captureDate || new Date().toISOString().split('T')[0],
          imageUrl: imageUrl,
          pixelCoverageData: this.pixelCoverageData
        }))
      : undefined;
    
    // Si hay múltiples máscaras, regenerarlas con los colores personalizados o eliminar fondo negro
    if (multipleMasks && multipleMasks.length > 0) {
      const customColors = this.classColorService.getAllColors();
      if (customColors && customColors.size > 0) {
        // Si hay colores personalizados, regenerar máscaras
        this.regenerateMasksWithCustomColors(multipleMasks, () => {
          this.reportGenerator.generateReport({
            format: data.format as ReportFormat,
            content: data.content,
            region: data.region as RegionType,
            monthLabel: activeMonthLabel,
            // Pasar los datos filtrados según los filtros aplicados (incluyendo filtrado por clases seleccionadas)
            pixelCoverageData: this.getPixelCoverageDataForReport(this.pixelCoverageData),
            filteredPixelCoverageData: this.getPixelCoverageDataForReport(this.filteredPixelCoverageData),
            vegetationCoveragePercentage: this.getCoveragePercentage(),
            vegetationAreaM2: this.getCoverageAreaM2(),
            totalAreaM2: this.filteredTotalAreaM2,
            // Pasar la URL de la máscara actual del Leaflet
            maskImageUrl: maskImageUrl,
            // Pasar máscaras múltiples con colores regenerados
            multipleMasks: multipleMasks,
            isMultipleMasks: this.usePixelCoverage && this.multipleMaskImages.length > 0,
            // Pasar la unidad de área seleccionada
            areaUnit: this.selectedAreaUnit,
            // Pasar el modo de visualización
            coverageViewMode: this.coverageViewMode(),
            // Pasar las categorías seleccionadas
            selectedCategoryIds: this.selectedCategoryIds,
            // Pasar los colores personalizados de categorías
            categoryColors: this.classColorService.getAllCategoryColors()
          });
        });
      } else {
        // Sin colores personalizados, solo eliminar fondo negro
        this.removeBlackBackgroundFromMasks(multipleMasks, () => {
          this.reportGenerator.generateReport({
            format: data.format as ReportFormat,
            content: data.content,
            region: data.region as RegionType,
            monthLabel: activeMonthLabel,
            // Pasar los datos filtrados según los filtros aplicados (incluyendo filtrado por clases seleccionadas)
            pixelCoverageData: this.getPixelCoverageDataForReport(this.pixelCoverageData),
            filteredPixelCoverageData: this.getPixelCoverageDataForReport(this.filteredPixelCoverageData),
            vegetationCoveragePercentage: this.getCoveragePercentage(),
            vegetationAreaM2: this.getCoverageAreaM2(),
            totalAreaM2: this.filteredTotalAreaM2,
            // Pasar la URL de la máscara actual del Leaflet
            maskImageUrl: maskImageUrl,
            // Pasar máscaras múltiples con fondo negro eliminado
            multipleMasks: multipleMasks,
            isMultipleMasks: this.usePixelCoverage && this.multipleMaskImages.length > 0,
            // Pasar la unidad de área seleccionada
            areaUnit: this.selectedAreaUnit,
            // Pasar el modo de visualización
            coverageViewMode: this.coverageViewMode(),
            // Pasar las categorías seleccionadas
            selectedCategoryIds: this.selectedCategoryIds,
            // Pasar los colores personalizados de categorías
            categoryColors: this.classColorService.getAllCategoryColors()
          });
        });
      }
    } else {
      this.reportGenerator.generateReport({
        format: data.format as ReportFormat,
        content: data.content,
        region: data.region as RegionType,
        monthLabel: activeMonthLabel,
        // Pasar los datos filtrados según los filtros aplicados (incluyendo filtrado por clases seleccionadas)
        pixelCoverageData: this.getPixelCoverageDataForReport(this.pixelCoverageData),
        filteredPixelCoverageData: this.getPixelCoverageDataForReport(this.filteredPixelCoverageData),
        vegetationCoveragePercentage: this.getCoveragePercentage(),
        vegetationAreaM2: this.getCoverageAreaM2(),
        totalAreaM2: this.filteredTotalAreaM2,
        // Pasar la URL de la máscara actual del Leaflet
        maskImageUrl: maskImageUrl,
        // Pasar máscaras múltiples si existen
        multipleMasks: multipleMasks,
        isMultipleMasks: this.usePixelCoverage && this.multipleMaskImages.length > 0,
        // Pasar la unidad de área seleccionada
        areaUnit: this.selectedAreaUnit,
        // Pasar el modo de visualización
        coverageViewMode: this.coverageViewMode(),
        // Pasar las categorías seleccionadas
        selectedCategoryIds: this.selectedCategoryIds,
        // Pasar los colores personalizados de categorías
        categoryColors: this.classColorService.getAllCategoryColors()
      });
    }
  }

  private generateMultiPeriodReport(data: { format: string; content: string[]; region: string }): void {
    if (this.multiPeriodReportData && this.multiPeriodReportData.length > 0) {
      // Regenerar máscaras de múltiples períodos con los colores correctos según el modo de vista
      // Para PDFs, también hacer transparentes los píxeles "Sin etiquetar"
      this.regenerateMultiPeriodMasks(data.format, () => {
        this.reportGenerator.generateReport({
          format: data.format as ReportFormat,
          content: data.content,
          region: data.region as RegionType,
          // Pasar datos de múltiples períodos con máscaras regeneradas
          multiPeriodData: this.multiPeriodReportData,
          // Pasar la unidad de área seleccionada
          areaUnit: this.selectedAreaUnit,
          // Pasar el modo de visualización
          coverageViewMode: this.coverageViewMode(),
          // Pasar las categorías seleccionadas
          selectedCategoryIds: this.selectedCategoryIds,
          // Pasar los colores personalizados de categorías
          categoryColors: this.classColorService.getAllCategoryColors()
        });
      });
    } else {
      this.reportGenerator.generateReport({
        format: data.format as ReportFormat,
        content: data.content,
        region: data.region as RegionType,
        // Pasar datos de múltiples períodos
        multiPeriodData: this.multiPeriodReportData,
        // Pasar la unidad de área seleccionada
        areaUnit: this.selectedAreaUnit,
        // Pasar el modo de visualización
        coverageViewMode: this.coverageViewMode(),
        // Pasar las categorías seleccionadas
        selectedCategoryIds: this.selectedCategoryIds,
        // Pasar los colores personalizados de categorías
        categoryColors: this.classColorService.getAllCategoryColors()
      });
    }
  }

  onDownloadModalSubmit(data: { format: string; content: string[]; region: string }): void {
    // Mostrar diálogo de generación
    this.showReportGeneratingDialog.set(true);

    // Detectar si hay múltiples períodos seleccionados
    const selectedMonths = this.getSelectedMonths();
    
    if (selectedMonths.length > 1) {
      // Cargar datos de todos los períodos y generar reporte multi-período
      this.loadDataForMultiPeriodReport(data);
    } else {
      // Generar reporte de un único período
      this.generateSinglePeriodReport(data);
    }
    
    // Cerrar el diálogo después de 10 segundos (tiempo suficiente para que el navegador maneje la descarga)
    setTimeout(() => {
      this.showReportGeneratingDialog.set(false);
    }, 10000);
  }

  onAreaUnitChanged(unit: 'm2' | 'ha'): void {
    this.selectedAreaUnit = unit;
  }

  onVisualizationTypeChanged(type: 'mask' | 'original'): void {
    this.visualizationType.set(type);
    
    // Obtener el período activo actual
    const activeMonthLabel = this.months.find(m => m.id === this.activeMonth)?.label || 'Período seleccionado';
    
    // Mostrar diálogo de carga
    const title = type === 'mask' ? 'Cargando Máscaras' : 'Cargando Imágenes Originales';
    this.visualizationLoadingTitle.set(title);
    this.visualizationLoadingMessage.set(activeMonthLabel);
    this.showVisualizationLoadingDialog.set(true);
    
    // Cerrar el diálogo después de 10 segundos
    setTimeout(() => {
      this.showVisualizationLoadingDialog.set(false);
    }, 10000);
  }

  private removeBlackBackgroundFromMasks(multipleMasks: any[], callback: () => void): void {
    // Ya no es necesario eliminar fondo negro en el frontend, 
    // el backend ya lo hace directamente en la máscara
    callback();
  }

  private removeBlackBackgroundFromAllMasks(callback: () => void): void {
    // Ya no es necesario eliminar fondo negro en el frontend, 
    // el backend ya lo hace directamente en la máscara
    callback();
  }

  private regenerateMasksWithCustomColors(multipleMasks: any[], callback: () => void): void {
    // Obtener los colores correctos según el modo de vista
    const customColors = this.classColorService.getColorsForRendering(this.coverageViewMode());
    const selectedClassIds = this.getSelectedClassIds();
    
    if (!customColors || customColors.size === 0) {
      callback();
      return;
    }
    
    const masksToRegenerate: Promise<any>[] = [];
    
    for (let index = 0; index < multipleMasks.length; index++) {
      const maskData = multipleMasks[index];
      const metadata = this.multipleMaskMetadata[index];
      if (!metadata) {
        continue;
      }
      
      const maskPromise = firstValueFrom(
        this.segmentsService.getMasksForPeriod(
          this.selectedRegionId,
          metadata.periodo || this.selectedPeriodo,
          selectedClassIds.length > 0 ? selectedClassIds : undefined,
          customColors,
          true
        )
      ).then((response: any) => {
        if (response?.masks && response.masks.length > 0) {
          let imageUrl = response?.masks?.[0]?.image || response?.masks?.[0];
          maskData.imageUrl = imageUrl;
          return maskData;
        }
        return maskData;
      }).catch((err: any) => {
        console.error('Error regenerating mask:', err);
        return maskData;
      });
      
      masksToRegenerate.push(maskPromise);
    }
    
    if (masksToRegenerate.length > 0) {
      Promise.all(masksToRegenerate).then(() => {
        callback();
      });
    } else {
      callback();
    }
  }

  private regenerateMultiPeriodMasks(format: string, callback: () => void): void {
    // Obtener los colores correctos según el modo de vista
    const customColors = this.classColorService.getColorsForRendering(this.coverageViewMode());
    const selectedClassIds = this.getSelectedClassIds();
    const makeUnlabeledTransparent = format === 'pdf'; // Solo hacer transparentes para PDFs
    
    const periodPromises = this.multiPeriodReportData.map((periodData: any) => {
      if (!periodData.multipleMasks || periodData.multipleMasks.length === 0) {
        return Promise.resolve(periodData);
      }
      
      const periodo = periodData.periodo || this.selectedPeriodo;
      const maskPromises = periodData.multipleMasks.map((maskData: any, index: number) => {
        return firstValueFrom(
          this.segmentsService.getMasksForPeriod(
            this.selectedRegionId,
            periodo,
            selectedClassIds.length > 0 ? selectedClassIds : undefined,  // Pasar IDs de clases seleccionadas
            customColors,
            makeUnlabeledTransparent  // true solo para PDFs
          )
        ).then((response: any) => {
          if (response?.masks && response.masks.length > index) {
            let imageUrl = response?.masks?.[index]?.image || response?.masks?.[index];
            maskData.imageUrl = imageUrl;
            return maskData;
          }
          return maskData;
        }).catch((err: any) => {
          console.error('Error regenerating mask for period:', err);
          return maskData;
        });
      });
      
      return Promise.all(maskPromises).then((regeneratedMasks: any) => {
        periodData.multipleMasks = regeneratedMasks;
        return periodData;
      });
    });
    
    Promise.all(periodPromises).then((regeneratedPeriods: any) => {
      this.multiPeriodReportData = regeneratedPeriods;
      callback();
    });
  }

  onClassColorChanged(event: { className: string; color: string }): void {
    // Cuando el usuario cambia un color de clase, recargar las máscaras para que usen el nuevo color
    if (this.selectedPeriodo && this.selectedRegionId) {
      // Mostrar diálogo de carga por 3 segundos
      this.showMaskLoadingDialog.set(true);
      setTimeout(() => {
        this.showMaskLoadingDialog.set(false);
      }, 3000);
      
      // Recargar las máscaras con los nuevos colores en el leaflet-map
      if (this.leafletMap) {
        this.leafletMap.reloadMasks();
      }
    }
  }
}
