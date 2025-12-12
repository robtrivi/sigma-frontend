import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LeafletMapComponent } from '../components/leaflet-map/leaflet-map.component';
import { ControlPanelComponent, SceneUploadData } from '../components/control-panel/control-panel.component';
import { DashboardPanelComponent } from '../components/dashboard/dashboard-panel.component';
import { VisualizationHeaderComponent } from '../components/header/visualization-header.component';
import { DownloadModalComponent } from '../components/download-modal/download-modal.component';
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
    DownloadModalComponent
  ],
  templateUrl: './visualization-sigma.component.html',
  styleUrls: ['./visualization-sigma.component.scss']
})
export class VisualizationSigmaComponent implements OnInit {
  uploadedFile: string = '';
  hoveredFeature: SegmentFeature | null = null;
  activeMonth: string = 'octubre';
  showDownloadModal: boolean = false;
  isLoading = signal(false);
  loadingMessage = signal('');
  errorMessage = signal('');
  
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
  filteredTotalPixels: number = 262144;
  usePixelCoverage: boolean = false; // Cambiar a true cuando hay escena cargada

  months: MonthFilter[] = [
    { id: '2024-08', label: 'Agosto 2024', selected: false },
    { id: '2024-09', label: 'Septiembre 2024', selected: false },
    { id: '2024-10', label: 'Octubre 2024', selected: false },
    { id: '2024-11', label: 'Noviembre 2024', selected: true }
  ];

  classTypes: ClassType[] = CLASS_CATALOG.map(c => ({
    id: c.id,
    label: c.name,
    color: c.color,
    icon: c.icon,
    selected: true
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
        
        if (periods.length > 0 && !this.selectedPeriodo) {
          this.selectedPeriodo = periods[0].periodo;
        }
        
        this.months = periods.map(p => ({
          id: p.periodo,
          label: this.formatPeriodoLabel(p.periodo),
          selected: p.periodo === this.selectedPeriodo
        }));
        
        if (periods.length > 0) {
          this.loadSegmentsTiles();
        }
      },
      error: (err) => console.error('Error cargando periodos:', err)
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
        this.loadingMessage.set('Escena cargada exitosamente. Segmentación ejecutada automáticamente.');
        
        // ===== CARGAR COBERTURA POR PÍXELES =====
        this.loadPixelCoverage(scene.sceneId);
        // =========================================
        
        this.loadAvailablePeriods();
      },
      error: (err) => {
        console.error('Error cargando escena:', err);
        this.errorMessage.set(err.error?.message || 'Error al cargar la escena');
      }
    });
  }

  private loadPixelCoverage(sceneId: string): void {
    this.segmentsService.getCoverage(sceneId).subscribe({
      next: (coverage: SegmentationCoverageResponse) => {
        this.pixelCoverageData = coverage.coverage_by_class;
        this.totalPixels = coverage.total_pixels;
        this.filterPixelCoverageByClass();
        this.usePixelCoverage = true;
      },
      error: (err) => {
        this.usePixelCoverage = false;
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
      const selectedIds = this.classTypes
        .filter(c => c.selected)
        .map(c => c.id);
      
      this.filteredPixelCoverageData = this.pixelCoverageData.filter(item => {
        const classIdStr = this.getClassIdStringByIndex(item.class_id);
        return selectedIds.includes(classIdStr);
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

  onMonthFilterChange(): void {
    const selectedMonths = this.months.filter(m => m.selected);
    if (selectedMonths.length > 0) {
      const selectedMonth = selectedMonths[0];
      this.activeMonth = selectedMonth.id;
      this.selectedPeriodo = selectedMonth.id;
      
      if (this.selectedRegionId) {
        this.loadSegmentsTiles();
      }
    }
  }

  onClassFilterChange(): void {
    if (this.selectedRegionId) {
      this.loadSegmentsTiles();
    }
    // Actualizar filtrado de píxeles cuando cambian las clases
    this.filterPixelCoverageByClass();
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
    
    this.months.forEach(m => m.selected = m.id === monthId);
    
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
    
    const features = this.segmentFeatures();
    if (features.length === 0) {
      if (this.availablePeriods.length === 0) {
        return 'No hay periodos disponibles. Sube una escena TIFF para comenzar.';
      }
      return 'No hay segmentos para los filtros seleccionados.';
    }
    
    const periodoLabel = this.selectedPeriodo 
      ? this.formatPeriodoLabel(this.selectedPeriodo)
      : 'Sin periodo';
    
    const selectedClasses = this.classTypes.filter(c => c.selected).length;
    const totalClasses = this.classTypes.length;
    const classesLabel = selectedClasses === totalClasses 
      ? 'todas las clases'
      : `${selectedClasses} clases`;
    
    return `Mostrando ${features.length} segmentos | Período: ${periodoLabel} | Clases: ${classesLabel}`;
  }

  getDashboardTitle(): string {
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      return 'Resumen Temporal';
    }
    return 'Resumen del Mapa';
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
      console.log('  - No hay segmentos para distribuir');
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
    
    console.log('  - Clases:', distribution.map(c => c.label + ' (' + c.percentage + '%)'));
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
      
      const info = `Período: ${periodoLabel} | Resolución: 512×512 | Total píxeles: ${this.totalPixels.toLocaleString()} | Áreas Verdes: ${vegetationCoverage.toFixed(2)}%`;
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
    this.classTypes.forEach(ct => ct.selected = true);
    
    if (this.availablePeriods.length > 0) {
      this.selectedPeriodo = this.availablePeriods[0].periodo;
      this.activeMonth = this.selectedPeriodo;
      this.months.forEach(m => m.selected = m.id === this.selectedPeriodo);
    }
    
    if (this.selectedRegionId) {
      this.loadSegmentsTiles();
    }
  }

  getSelectedClassIds(): string[] {
    return this.classTypes
      .filter(c => c.selected)
      .map(c => c.id);
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
