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
import { ReportGeneratorService } from '../services/report-generator.service';
import { ScenesService } from '../services/scenes.service';
import { SegmentsService } from '../services/segments.service';
import { RegionsService } from '../services/regions.service';
import { SegmentFeature, SceneResponse, Region, PeriodInfo, PixelCoverageItem, SegmentationCoverageResponse } from '../models/api.models';
import { CLASS_CATALOG, getClassConfig } from '../models/class-catalog';
import { finalize } from 'rxjs';

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

  // ===== COBERTURA POR PÍXELES =====
  pixelCoverageData: PixelCoverageItem[] = [];
  filteredPixelCoverageData: PixelCoverageItem[] = [];
  totalPixels: number = 262144; // 512 * 512
  totalAreaM2: number = 262144.0;  // Área total en m²
  pixelAreaM2: number = 1.0;  // Área por píxel en m²
  filteredTotalPixels: number = 262144;
  usePixelCoverage: boolean = false; // Cambiar a true cuando hay escena cargada
  isLoadingAggregatedCoverage: boolean = false;

  months: MonthFilter[] = [
    { id: '2024-08', label: 'Agosto 2024', selected: false },
    { id: '2024-09', label: 'Septiembre 2024', selected: false },
    { id: '2024-10', label: 'Octubre 2024', selected: false },
    { id: '2024-11', label: 'Noviembre 2024', selected: true }
  ];
  
  // Período activo actual (usado cuando hay múltiples períodos seleccionados)
  activeMonth: string = '2024-11'; // Inicializar con el período más reciente

  classTypes: ClassType[] = CLASS_CATALOG.map(c => ({
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
        this.pixelCoverageData = coverage.coverage_by_class;
        this.totalPixels = coverage.total_pixels;
        this.totalAreaM2 = coverage.total_area_m2 ?? 262144.0;
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
        // Convertir respuesta a formato PixelCoverageItem[]
        this.pixelCoverageData = response.coverageByClass.map((item: any) => ({
          class_id: 0, // No usamos class_id en este contexto
          class_name: item.class_name,
          pixel_count: item.pixel_count,
          coverage_percentage: item.coverage_percentage,
          area_m2: item.area_m2 || 0
        }));

        this.totalPixels = response.totalPixels;
        this.totalAreaM2 = response.totalAreaM2 ?? 262144.0;
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
      // Si no hay clases seleccionadas, mostrar todas
      this.filteredPixelCoverageData = [...this.pixelCoverageData];
      this.filteredTotalPixels = this.totalPixels;
    } else {
      // Filtrar por clases seleccionadas
      const selectedLabels = this.classTypes
        .filter(c => c.selected)
        .map(c => c.label.toLowerCase());
      
      this.filteredPixelCoverageData = this.pixelCoverageData.filter(item => {
        const itemClassName = item.class_name?.toLowerCase() || '';
        return selectedLabels.some(label => itemClassName.includes(label));
      });
      
      // Calcular total de píxeles filtrados
      this.filteredTotalPixels = this.filteredPixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
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

    // Cargar cobertura agregada automáticamente cuando hay período
    if (this.selectedPeriodo && this.selectedRegionId) {
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
        
        // ===== EXTRAER sceneId Y CARGAR PÍXELES =====
        if (response.features.length > 0) {
          const sceneId = response.features[0].properties.sceneId;
          if (sceneId) {
            // Simular que se cargó una escena para que el currentScene tenga valor
            // esto es necesario para que el binding en el template funcione
            this.currentScene = { 
              sceneId: sceneId,
              regionId: this.selectedRegionId,
              captureDate: params.periodo || '',
              epsg: 4326,
              sensor: '',
              rasterPath: ''
            };
            this.loadPixelCoverage(sceneId);
          }
        }
        // ============================================
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

  onMultipleMasksLoaded(event: { regionId: string; periodo: string }): void {
    // Se llamó cuando se cargan múltiples máscaras de un período
    // Cargar píxeles agregados del backend
    this.loadAggregatedPixelCoverage(event.regionId, event.periodo);
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
    
    if (!this.currentScene) {
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
    // Si hay cobertura por píxeles, usarla (FILTRADA)
    if (this.usePixelCoverage && this.filteredPixelCoverageData.length > 0) {
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped', 'vegetation', 'grass', 'tree', 'bald-tree'];
      const vegetationCoverage = this.filteredPixelCoverageData
        .filter(item => vegetationClasses.some(vc => 
          item.class_name.includes(vc) || item.class_name.toLowerCase().includes(vc.toLowerCase())
        ))
        .reduce((sum, item) => sum + (item.pixel_count / this.filteredTotalPixels * 100), 0);
      
      return parseFloat(vegetationCoverage.toFixed(2));
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
      
      const vegetationClasses = ['Vegetación', 'Árbol', 'Árbol sin hojas', 'Césped'];
      const vegetationCoverage = this.pixelCoverageData
        .filter(item => vegetationClasses.some(vc => 
          item.class_name.includes(vc) || item.class_name.toLowerCase().includes(vc.toLowerCase())
        ))
        .reduce((sum, item) => sum + item.coverage_percentage, 0);
      
      const info = `Período: ${periodoLabel} | Área total (m²): ${this.totalAreaM2.toFixed(2)} | Áreas Verdes: ${vegetationCoverage.toFixed(2)}%`;
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

  onDownloadModalSubmit(data: { format: string; content: string[]; region: string }): void {
    const activeMonthLabel = this.getSelectedMonths()[0]?.label || 'Noviembre 2024';
    
    this.reportGenerator.generateReport({
      format: data.format as 'pdf' | 'csv',
      content: data.content,
      region: data.region as 'full' | 'subregion' | 'green-only',
      cells: [],
      monthLabel: activeMonthLabel
    });
  }
}
