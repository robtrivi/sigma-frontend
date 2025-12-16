import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LeafletMapComponent } from '../components/leaflet-map/leaflet-map.component';
import { ControlPanelComponent, SceneUploadData } from '../components/control-panel/control-panel.component';
import { DashboardPanelComponent } from '../components/dashboard/dashboard-panel.component';
import { VisualizationHeaderComponent } from '../components/header/visualization-header.component';
import { DownloadModalComponent } from '../components/download-modal/download-modal.component';
import { SegmentationProgressDialogComponent } from '../components/segmentation-progress-dialog/segmentation-progress-dialog.component';
import { ChartBar, ClassDistributionStat, ClassType, MonthFilter } from '../models/visualization.models';
import { ReportGeneratorService, PeriodReportData, MaskData } from '../services/report-generator.service';
import { ScenesService } from '../services/scenes.service';
import { SegmentsService } from '../services/segments.service';
import { RegionsService } from '../services/regions.service';
import { SegmentFeature, SceneResponse, Region, PeriodInfo, PixelCoverageItem, SegmentationCoverageResponse } from '../models/api.models';
import { CLASS_CATALOG, getClassConfig } from '../models/class-catalog';
import { finalize, forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-visualization-sigma',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LeafletMapComponent,
    ControlPanelComponent,
    DashboardPanelComponent,
    VisualizationHeaderComponent,
    DownloadModalComponent,
    SegmentationProgressDialogComponent
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
  totalAreaM2: number = 262144.0;  // Área total en m²
  pixelAreaM2: number = 1.0;  // Área por píxel en m²
  filteredTotalPixels: number = 262144;
  filteredTotalAreaM2: number = 262144.0;  // Área filtrada en m²
  usePixelCoverage: boolean = false; // Cambiar a true cuando hay escena cargada
  isLoadingAggregatedCoverage: boolean = false;
  
  // ===== MÁSCARAS MÚLTIPLES =====
  multipleMaskImages: string[] = [];  // URLs de máscaras múltiples para reportes
  
  // ===== DATOS DE MÚLTIPLES PERÍODOS PARA REPORTES =====
  multiPeriodReportData: PeriodReportData[] = [];  // Datos para cada período seleccionado en reportes

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
    private reportGenerator: ReportGeneratorService,
    private scenesService: ScenesService,
    private segmentsService: SegmentsService,
    private regionsService: RegionsService
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
      error: (err) => console.error('Error cargando regiones:', err)
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
      error: (err) => console.error('Error cargando periodos:', err)
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
      if (currentYear > recentYear) {
        return current;
      } else if (currentYear === recentYear && currentMonth > recentMonth) {
        return current;
      }
      
      return mostRecent;
    });
  }

  private formatPeriodoLabel(periodo: string): string {
    const [year, month] = periodo.split('-');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  onSceneUpload(data: SceneUploadData): void {
    this.isLoading.set(true);
    this.loadingMessage.set('Cargando escena TIFF...');
    this.errorMessage.set('');

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
        this.currentScene = scene;
        this.uploadedFile = data.file.name;
        this.selectedRegionId = scene.regionId;
        
        const periodo = scene.captureDate.substring(0, 7);
        this.selectedPeriodo = periodo;
        
        // Mostrar diálogo de progreso
        this.showProgressDialog.set(true);
        this.progressSceneId.set(scene.sceneId);
        
        if (this.progressDialog) {
          this.progressDialog.startStreaming(scene.sceneId);
        }
        
        this.loadAvailablePeriods();
      },
      error: (err) => {
        console.error('Error cargando escena:', err);
        this.errorMessage.set(err.error?.message || 'Error al cargar la escena');
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
      window.location.reload();
    }, 500);
  }

  private loadPixelCoverage(sceneId: string): void {
    this.segmentsService.getCoverage(sceneId).subscribe({
      next: (coverage: SegmentationCoverageResponse) => {
        // Filtrar para excluir "unlabeled"
        this.pixelCoverageData = coverage.coverage_by_class.filter(item =>
          item.class_name?.toLowerCase() !== 'unlabeled'
        );
        
        // Recalcular totales sin "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
        this.pixelAreaM2 = coverage.pixel_area_m2 ?? 1.0;
        this.filterPixelCoverageByClass();
        this.usePixelCoverage = true;
      },
      error: (err) => {
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
        // Convertir respuesta a formato PixelCoverageItem[] y filtrar "unlabeled"
        this.pixelCoverageData = response.coverageByClass
          .filter((item: any) => item.class_name?.toLowerCase() !== 'unlabeled')
          .map((item: any) => ({
            class_id: 0, // No usamos class_id en este contexto
            class_name: item.class_name,
            pixel_count: item.pixel_count,
            coverage_percentage: item.coverage_percentage,
            area_m2: item.area_m2 || 0
          }));

        // Recalcular totales sin "unlabeled"
        this.totalPixels = this.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        this.totalAreaM2 = this.pixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
        this.pixelAreaM2 = response.pixelAreaM2 ?? 1.0;
        this.filterPixelCoverageByClass();
        this.usePixelCoverage = true;
      },
      error: (err) => {
        console.error('Error loading aggregated pixel coverage:', err);
        this.usePixelCoverage = false;
      },
      complete: () => {
        this.isLoadingAggregatedCoverage = false;
      }
    });
  }

  private filterPixelCoverageByClass(): void {
    if (this.classTypes.filter(c => c.selected).length === 0) {
      // Si no hay clases seleccionadas, mostrar todas excepto "unlabeled"
      this.filteredPixelCoverageData = [...this.pixelCoverageData]
        .filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta');
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    } else {
      // Filtrar por clases seleccionadas
      const selectedLabels = this.classTypes
        .filter(c => c.selected)
        .map(c => c.label.toLowerCase());
      
      this.filteredPixelCoverageData = this.pixelCoverageData.filter(item => {
        const itemClassName = item.class_name?.toLowerCase() || '';
        return selectedLabels.some(label => itemClassName.includes(label));
      });
      
      // Calcular total de píxeles filtrados y área filtrada
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
      this.filteredTotalAreaM2 = this.filteredPixelCoverageData.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    }
  }

  private getClassIdStringByIndex(classIndex: number): string {
    const classIds = [
      'unlabeled', 'paved-area', 'dirt', 'grass', 'gravel', 'water', 'rocks', 'pool',
      'vegetation', 'roof', 'wall', 'window', 'door', 'fence', 'fence-pole', 'person',
      'dog', 'car', 'bicycle', 'tree', 'bald-tree', 'ar-marker', 'obstacle', 'conflicting'
    ];
    return classIds[classIndex] || `class_${classIndex}`;
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
      this.months.forEach(m => m.selected = m.id === this.selectedPeriodo);
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

  onMultipleMasksLoaded(event: { regionId: string; periodo: string; maskImages: string[] }): void {
    // Se llamó cuando se cargan múltiples máscaras de un período
    // Guardar las imágenes de máscaras para reportes
    this.multipleMaskImages = event.maskImages || [];
    
    // Solo cargar píxeles agregados si NO hay una escena individual seleccionada
    if (!this.currentScene?.sceneId) {
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
      this.selectedPeriodo = this.activeMonth;
      
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
    
    if (this.selectedRegionId) {
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
    // Si hay cobertura por píxeles, usarla (FILTRADA por clases seleccionadas)
    if (this.usePixelCoverage && this.filteredPixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = this.filteredPixelCoverageData
        .filter(item => vegetationClasses.some(vc => 
          item.class_name.includes(vc) || item.class_name.toLowerCase().includes(vc.toLowerCase())
        ))
        .reduce((sum, item) => sum + (item.area_m2 || 0), 0);
      
      // Calcular porcentaje basado en área: (área de vegetación / área total) * 100
      const percentage = this.filteredTotalAreaM2 > 0 
        ? (vegetationAreaM2 / this.filteredTotalAreaM2) * 100 
        : 0;
      
      return parseFloat(percentage.toFixed(2));
    }
    
    // Fallback: usar segmentos
    const features = this.getFilteredFeatures();
    if (features.length === 0) return 0;
    
    const totalSegments = features.length;
    const vegetationClasses = ['grass', 'vegetation', 'tree', 'bald-tree'];
    const vegetationSegments = features
      .filter(f => vegetationClasses.includes(f.properties.classId))
      .length;
    
    const percentage = totalSegments > 0 ? parseFloat(((vegetationSegments / totalSegments) * 100).toFixed(2)) : 0;
    return percentage;
  }

  getCoverageAreaM2(): number {
    // Obtener el área en m² de vegetación usando los mismos criterios que getCoveragePercentage
    if (this.usePixelCoverage && this.filteredPixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationAreaM2 = this.filteredPixelCoverageData
        .filter(item => vegetationClasses.some(vc => 
          item.class_name.includes(vc) || item.class_name.toLowerCase().includes(vc.toLowerCase())
        ))
        .reduce((sum, item) => sum + (item.area_m2 || 0), 0);
      
      return parseFloat(vegetationAreaM2.toFixed(2));
    }
    
    // Fallback: retornar 0 si no hay cobertura por píxeles
    return 0;
  }

  getClassDistribution(): ClassDistributionStat[] {
    // Si hay cobertura por píxeles, usarla
    if (this.usePixelCoverage && this.pixelCoverageData.length > 0) {
      return this.pixelCoverageData
        .map(pixelItem => {
          // Encontrar el classType correspondiente
          const classType = this.classTypes.find(ct => 
            ct.id.toLowerCase().includes(pixelItem.class_name.toLowerCase()) ||
            pixelItem.class_name.toLowerCase().includes(ct.label.toLowerCase())
          );
          
          return {
            label: pixelItem.class_name,
            icon: classType?.icon || 'pi pi-map-marker',
            percentage: pixelItem.coverage_percentage,
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
        const percentage = totalSegments > 0 ? parseFloat(((segmentCount / totalSegments) * 100).toFixed(2)) : 0;
        
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
    const vegetationClasses = ['grass', 'vegetation', 'tree', 'bald-tree'];
    const vegetationFeatures = features.filter(f => vegetationClasses.includes(f.properties.classId));
    const vegetationPercentage = this.getCoveragePercentage();
    
    const info = `Período: ${periodoLabel} | Total: ${totalSegments} segmentos | Áreas Verdes: ${vegetationFeatures.length} (${vegetationPercentage}%)`;
    return info;
  }

  clearFilters(): void {
    // Desmarcar todas las clases
    this.classTypes.forEach(ct => ct.selected = false);
    
    // Filtrar píxeles localmente sin recargar
    this.filterPixelCoverageByClass();
    
    if (this.availablePeriods.length > 0) {
      this.selectedPeriodo = this.availablePeriods[0].periodo;
      this.activeMonth = this.selectedPeriodo;
      this.months.forEach(m => m.selected = m.id === this.selectedPeriodo);
    }
    
    // Solo recargar segmentos tiles si no estamos en modo múltiples máscaras
    if (this.selectedRegionId && !this.selectedPeriodo) {
      this.loadSegmentsTiles();
    }
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
    
    selectedMonths.forEach(month => {
      // Cargar cobertura agregada para cada período
      requests.push(
        this.segmentsService.getAggregatedPixelCoverage(this.selectedRegionId, month.id)
      );
    });
    
    // También cargar máscaras para cada período
    const maskRequests: any[] = [];
    const classesToShow = this.classTypes.filter((c: ClassType) => c.selected).map((c: ClassType) => c.id);
    const allClassIds = this.classTypes.map((c: ClassType) => c.id);
    const classIdsToUse = classesToShow.length > 0 ? classesToShow : allClassIds;
    
    selectedMonths.forEach(month => {
      // Cargar máscaras para cada período
      maskRequests.push(
        this.segmentsService.getMasksForPeriod(this.selectedRegionId, month.id, classIdsToUse)
      );
    });

    // Ejecutar todas las solicitudes en paralelo
    forkJoin([...requests, ...maskRequests]).subscribe({
      next: (allResponses) => {
        // Las primeras N respuestas son cobertura, las siguientes N son máscaras
        const coverageResponses = allResponses.slice(0, selectedMonths.length);
        const maskResponses = allResponses.slice(selectedMonths.length);
        
        // Procesar respuestas igual que loadAggregatedPixelCoverage hace
        this.multiPeriodReportData = selectedMonths.map((month, index) => {
          const response = coverageResponses[index];
          const maskResponse = maskResponses[index];
          
          // Validar que la respuesta de cobertura tenga la estructura esperada
          if (!response || !response.coverageByClass || !Array.isArray(response.coverageByClass)) {
            console.warn(`No valid coverage data for period ${month.label}`);
            return null;
          }
          
          // Procesar igual que en loadAggregatedPixelCoverage
          const pixelCoverageData = response.coverageByClass
            .filter((item: any) => item.class_name?.toLowerCase() !== 'unlabeled')
            .map((item: any) => ({
              class_id: 0,
              class_name: item.class_name,
              pixel_count: item.pixel_count,
              coverage_percentage: item.coverage_percentage,
              area_m2: item.area_m2 || 0
            }));

          // Recalcular totales sin "unlabeled"
          const totalPixels = pixelCoverageData.reduce((sum: number, item: any) => sum + item.pixel_count, 0);
          const totalAreaM2 = pixelCoverageData.reduce((sum: number, item: any) => sum + (item.area_m2 || 0), 0);
          
          // Filtrar según clases seleccionadas (igual que filterPixelCoverageByClass)
          let filteredPixelCoverageData = pixelCoverageData;
          if (this.classTypes.filter((c: ClassType) => c.selected).length === 0) {
            // Si no hay clases seleccionadas, mostrar todas excepto "unlabeled"
            filteredPixelCoverageData = pixelCoverageData
              .filter((item: any) => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta');
          } else {
            // Filtrar por clases seleccionadas
            const selectedLabels = this.classTypes
              .filter((c: ClassType) => c.selected)
              .map((c: ClassType) => c.label);
            filteredPixelCoverageData = pixelCoverageData.filter((item: any) =>
              selectedLabels.some((label: string) => item.class_name?.includes(label))
            );
          }
          
          const filteredTotalAreaM2 = filteredPixelCoverageData.reduce((sum: number, item: any) => sum + (item.area_m2 || 0), 0);
          
          // Calcular cobertura de vegetación (mismo criterio que getCoveragePercentage)
          const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
          const vegetationAreaM2 = filteredPixelCoverageData
            .filter((item: any) => vegetationClasses.some((vc: string) => 
              item.class_name.includes(vc) || item.class_name.toLowerCase().includes(vc.toLowerCase())
            ))
            .reduce((sum: number, item: any) => sum + (item.area_m2 || 0), 0);
          
          const vegetationPercentage = filteredTotalAreaM2 > 0 ? (vegetationAreaM2 / filteredTotalAreaM2) * 100 : 0;
          
          // Procesar máscaras del período
          const masks = maskResponse?.masks || [];
          const multipleMasks = masks.length > 0 
            ? masks.map((maskData: any) => ({
                sceneId: `Escena ${masks.indexOf(maskData) + 1}`,
                captureDate: new Date().toISOString().split('T')[0],
                imageUrl: maskData.image,
                pixelCoverageData: pixelCoverageData
              }))
            : undefined;
          
          return {
            monthLabel: month.label,
            pixelCoverageData: pixelCoverageData,
            filteredPixelCoverageData: filteredPixelCoverageData,
            vegetationCoveragePercentage: parseFloat(vegetationPercentage.toFixed(2)),
            vegetationAreaM2: vegetationAreaM2,
            totalAreaM2: filteredTotalAreaM2,
            multipleMasks: multipleMasks,
            isMultipleMasks: masks.length > 0
          };
        }).filter((p: any) => p !== null) as PeriodReportData[];

        // Verificar si tenemos datos válidos
        if (this.multiPeriodReportData.length === 0) {
          console.warn('No valid data for multiple periods, using current period');
          this.generateSinglePeriodReport(data);
          return;
        }

        // Generar el reporte con múltiples períodos
        this.generateMultiPeriodReport(data);
      },
      error: (err) => {
        console.error('Error loading multi-period data:', err);
        // Fallback: generar reporte con datos actuales
        this.generateSinglePeriodReport(data);
      }
    });
  }

  private generateSinglePeriodReport(data: { format: string; content: string[]; region: string }): void {
    const activeMonthLabel = this.getSelectedMonths()[0]?.label || 'Noviembre 2024';
    const maskImageUrl = this.getCurrentMaskImageUrl();
    
    // Preparar datos de máscaras múltiples si existen
    const multipleMasks = this.usePixelCoverage && this.multipleMaskImages.length > 0
      ? this.multipleMaskImages.map((imageUrl, index) => ({
          sceneId: `Escena ${index + 1}`,
          captureDate: new Date().toISOString().split('T')[0],
          imageUrl: imageUrl,
          pixelCoverageData: this.pixelCoverageData
        }))
      : undefined;
    
    this.reportGenerator.generateReport({
      format: data.format as 'pdf' | 'csv',
      content: data.content,
      region: data.region as 'full' | 'subregion' | 'green-only',
      monthLabel: activeMonthLabel,
      // Pasar los datos filtrados según los filtros aplicados
      pixelCoverageData: this.pixelCoverageData,
      filteredPixelCoverageData: this.filteredPixelCoverageData,
      vegetationCoveragePercentage: this.getCoveragePercentage(),
      vegetationAreaM2: this.getCoverageAreaM2(),
      totalAreaM2: this.filteredTotalAreaM2,
      // Pasar la URL de la máscara actual del Leaflet
      maskImageUrl: maskImageUrl,
      // Pasar máscaras múltiples si existen
      multipleMasks: multipleMasks,
      isMultipleMasks: this.usePixelCoverage && this.multipleMaskImages.length > 0
    });
  }

  private generateMultiPeriodReport(data: { format: string; content: string[]; region: string }): void {
    this.reportGenerator.generateReport({
      format: data.format as 'pdf' | 'csv',
      content: data.content,
      region: data.region as 'full' | 'subregion' | 'green-only',
      // Pasar datos de múltiples períodos
      multiPeriodData: this.multiPeriodReportData
    });
  }

  onDownloadModalSubmit(data: { format: string; content: string[]; region: string }): void {
    // Detectar si hay múltiples períodos seleccionados
    const selectedMonths = this.getSelectedMonths();
    
    if (selectedMonths.length > 1) {
      // Cargar datos de todos los períodos y generar reporte multi-período
      this.loadDataForMultiPeriodReport(data);
    } else {
      // Generar reporte de un único período
      this.generateSinglePeriodReport(data);
    }
  }
}
