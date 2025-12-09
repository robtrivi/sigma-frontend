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
import { SegmentFeature, SceneResponse, Region } from '../models/api.models';
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
  selectedPeriodo: string = '2024-11';
  regions: Region[] = [];

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
    this.selectedPeriodo = this.months.find(m => m.selected)?.id || '2024-11';
    this.regionsService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        if (regions.length > 0 && !this.selectedRegionId) {
          this.selectedRegionId = regions[0].id;
        }
      },
      error: (err) => console.error('Error cargando regiones:', err)
    });
  }

  get canRunSegmentation(): boolean {
    return !!this.currentScene;
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
        this.loadingMessage.set('Escena cargada exitosamente');
        this.runSegmentationAfterUpload(data.file);
      },
      error: (err) => {
        console.error('Error cargando escena:', err);
        this.errorMessage.set(err.error?.message || 'Error al cargar la escena');
      }
    });
  }

  private runSegmentationAfterUpload(file: File): void {
    if (!this.currentScene) return;

    this.isLoading.set(true);
    this.loadingMessage.set('Ejecutando segmentación con Deep Learning...');

    this.segmentsService.runSegmentation(this.currentScene.sceneId, file)
      .pipe(finalize(() => {
        this.isLoading.set(false);
        this.loadingMessage.set('');
      }))
      .subscribe({
        next: (result) => {
          this.loadingMessage.set(`Segmentación completada: ${result.inserted} segmentos`);
          this.loadSegmentsTiles();
        },
        error: (err) => {
          console.error('Error en segmentación:', err);
          this.errorMessage.set(err.error?.message || 'Error en la segmentación');
        }
      });
  }

  onRunSegmentation(): void {
    if (!this.currentScene) return;
    this.loadSegmentsTiles();
  }

  private loadSegmentsTiles(): void {
    this.isLoading.set(true);
    this.loadingMessage.set('Cargando segmentos...');

    const selectedClassIds = this.classTypes
      .filter(c => c.selected)
      .map(c => c.id);

    this.segmentsService.getSegmentsTiles({
      regionId: this.selectedRegionId,
      periodo: this.selectedPeriodo,
      classIds: selectedClassIds.length > 0 ? selectedClassIds : undefined
    })
    .pipe(finalize(() => {
      this.isLoading.set(false);
      this.loadingMessage.set('');
    }))
    .subscribe({
      next: (response) => {
        this.segmentFeatures.set(response.features);
        this.loadingMessage.set(`${response.features.length} segmentos cargados`);
      },
      error: (err) => {
        console.error('Error cargando segmentos:', err);
        this.errorMessage.set(err.error?.message || 'Error al cargar segmentos');
      }
    });
  }

  onFeatureClick(feature: SegmentFeature): void {
    console.log('Feature clicked:', feature);
  }

  onMonthFilterChange(): void {
    const selectedMonths = this.months.filter(m => m.selected);
    if (selectedMonths.length > 0) {
      this.activeMonth = selectedMonths[0].id;
      this.selectedPeriodo = selectedMonths[0].id;
      if (this.currentScene) {
        this.loadSegmentsTiles();
      }
    }
  }

  onClassFilterChange(): void {
    if (this.currentScene) {
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
    if (this.currentScene) {
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
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      const labels = selectedMonths.map(m => m.label.split(' ')[0]).join(', ');
      return `Filtro temporal activo: ${labels}`;
    } else if (selectedMonths.length === 1 && this.segmentFeatures().length > 0) {
      return `Mapa segmentado: ${this.segmentFeatures().length} segmentos`;
    }
    return 'Estado: Esperando carga de escena TIFF';
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
    if (selectedMonths.length > 1) {
      return 'Períodos';
    }
    return 'Segmentos totales';
  }

  getVisibleSegmentsCount(): number {
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      return selectedMonths.length;
    }
    return this.getFilteredFeatures().length;
  }

  getCoverageLabel(): string {
    return 'Superficies blandas';
  }

  getCoveragePercentage(): number {
    const features = this.getFilteredFeatures();
    if (features.length === 0) return 0;
    
    const totalArea = features.reduce((sum, f) => sum + f.properties.areaM2, 0);
    const greenArea = features
      .filter(f => f.properties.classId === 'superficies_blandas')
      .reduce((sum, f) => sum + f.properties.areaM2, 0);
    
    return totalArea > 0 ? Math.round((greenArea / totalArea) * 100) : 0;
  }

  getClassDistribution(): ClassDistributionStat[] {
    const features = this.getFilteredFeatures();
    if (features.length === 0) return [];

    const totalArea = features.reduce((sum, f) => sum + f.properties.areaM2, 0);
    
    return this.classTypes
      .filter(ct => ct.selected)
      .map(classType => {
        const classFeatures = features.filter(f => f.properties.classId === classType.id);
        const classArea = classFeatures.reduce((sum, f) => sum + f.properties.areaM2, 0);
        const percentage = totalArea > 0 ? Math.round((classArea / totalArea) * 100) : 0;
        
        return {
          label: classType.label,
          icon: classType.icon,
          percentage,
          gradient: this.getGradient(classType.id)
        };
      });
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
    const selectedMonths = this.getSelectedMonths();
    if (selectedMonths.length > 1) {
      const labels = selectedMonths.map(m => m.label.split(' ')[0]).join(', ');
      return `Período: ${labels} | Comparación de ${selectedMonths.length} mapas`;
    }
    
    const activeMonthLabel = selectedMonths[0]?.label || 'Noviembre 2024';
    const features = this.getFilteredFeatures();
    const totalSegments = features.length;
    const greenFeatures = features.filter(f => f.properties.classId === 'superficies_blandas');
    const greenPercentage = this.getCoveragePercentage();
    
    return `Mapa segmentado: ${activeMonthLabel} | Total: ${totalSegments} segmentos | Superficies blandas: ${greenFeatures.length} (${greenPercentage}%)`;
  }

  clearFilters(): void {
    this.classTypes.forEach(ct => ct.selected = true);
    if (this.currentScene) {
      this.loadSegmentsTiles();
    }
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
