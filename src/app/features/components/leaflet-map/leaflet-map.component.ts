import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { SegmentFeature } from '../../models/api.models';
import { CLASS_CATALOG } from '../../models/class-catalog';
import { environment } from '../../../../environments/environment';
import proj4 from 'proj4';
import { SegmentsService } from '../../services/segments.service';
import { ClassColorService } from '../../services/class-color.service';

@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="leaflet-map-container">
      <div id="map" class="map"></div>
      
      <!-- Controles de máscara -->
      <div class="mask-controls" *ngIf="(sceneId && maskLayer) || (periodo && maskLayers.length > 0)">
        <div class="control-group">
          <label>
            <input type="checkbox" [(ngModel)]="showMask" (change)="toggleMask()">
            Mostrar Máscara{{ maskLayers.length > 1 ? 's' : '' }}
          </label>
        </div>
        <div class="control-group" *ngIf="showMask">
          <label>Opacidad: {{ (maskOpacity * 100).toFixed(0) }}%</label>
          <input type="range" min="0" max="1" step="0.1" 
                 [value]="maskOpacity" (input)="onOpacityChange($event)"
                 class="opacity-slider">
        </div>
      </div>
      
    </div>
  `,
  styles: [`
    .leaflet-map-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
    }
    
    .map {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
    }

    .mask-controls {
      position: absolute;
      top: 20px;
      left: 70px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      min-width: 220px;
    }

    .control-group {
      margin-bottom: 12px;
    }

    .control-group:last-child {
      margin-bottom: 0;
    }

    .control-group label {
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #333;
      cursor: pointer;
      font-weight: 500;
    }

    .control-group input[type="checkbox"] {
      margin-right: 8px;
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .opacity-slider {
      width: 100%;
      margin-top: 8px;
      cursor: pointer;
    }
  `]
})
export class LeafletMapComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() center: [number, number] = [-2.1448, -79.9651];
  @Input() zoom: number = 15;
  @Input() showLegend: boolean = true;
  @Input() sceneId?: string; // Para cargar la máscara RGB (escena individual)
  @Input() selectedClassIds: string[] = []; // Clases seleccionadas para filtrar máscara
  @Input() regionId?: string; // Para cargar múltiples máscaras del período
  @Input() periodo?: string; // Período para cargar múltiples máscaras
  @Input() visualizationType: 'mask' | 'original' = 'mask'; // Tipo de visualización: máscara o imagen original
  @Input() coverageViewMode: 'classes' | 'categories' = 'classes'; // Modo de vista de cobertura
  @Output() featureClick = new EventEmitter<SegmentFeature>();
  @Output() multipeMasksLoaded = new EventEmitter<{ regionId: string; periodo: string; maskImages: string[]; maskMetadata?: any[] }>();
  @Output() maskLoaded = new EventEmitter<string>();  // Emite cuando se carga la máscara

  private map!: L.Map;
  maskLayer?: L.Layer;  // Capa única para escena individual
  maskLayers: L.Layer[] = [];  // Capas múltiples para período
  currentMaskImageUrl: string = '';  // URL de la máscara actual (para reportes)
  classTypes = CLASS_CATALOG.filter(c => c.id !== 'unlabeled');  // Excluir "Sin etiqueta"
  
  // Metadatos de máscaras múltiples para cargar imágenes originales
  private multiMaskMetadata: Array<{ sceneId: string; bounds: L.LatLngBoundsExpression }> = [];
  private originalImageLayers: L.Layer[] = []; // Capas de imágenes originales para múltiples máscaras
  
  // Control de máscara
  showMask: boolean = true;  
  maskOpacity: number = 1;
  private maskCenteredOnce: boolean = false;
  private lastLoadedClasses: string = '';
  private lastMultipleMaskClasses: string | null = null; // Track últimas clases usadas para máscaras múltiples - iniciar como null para forzar carga inicial
  private isLoadingMask: boolean = false;
  private originalImageLayer?: L.Layer;  // Capa para la imagen original (escena individual)
  private originalImageUrl: string = '';  // URL de la imagen original

  constructor(
    private readonly segmentsService: SegmentsService,
    private readonly classColorService: ClassColorService
  ) {}

  ngOnInit(): void {
    if (globalThis?.document) {
      this.fixLeafletIconPaths();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      
      // Cargar máscara si ya hay inputs iniciales
      if (this.sceneId && !this.periodo) {
        this.loadMaskLayer();
      } else if (this.periodo && this.regionId) {
        this.loadMasksForPeriod();
      }
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Obtiene la URL de la máscara actual para usar en reportes
   */
  getMaskImageUrl(): string {
    return this.currentMaskImageUrl;
  }

  private handleVisualizationTypeChange(): void {
    if (this.sceneId && !this.periodo) {
      this.updateVisualization();
    } else if (this.periodo && this.regionId) {
      this.updateMultipleMasksVisualization();
    }
  }

  private handlePeriodOrRegionChange(): void {
    if (!(this.periodo && this.regionId)) {
      return;
    }

    this.maskCenteredOnce = false;
    this.lastLoadedClasses = '';
    this.lastMultipleMaskClasses = null;
    this.clearSingleMask();
    this.clearMultipleMasks();
    this.loadMasksForPeriod();
  }

  private handleSceneIdChange(): void {
    if (!(this.sceneId && !this.periodo)) {
      return;
    }

    this.maskCenteredOnce = false;
    this.lastLoadedClasses = '';
    this.clearMultipleMasks();
    this.loadMaskLayer();
  }

  private handleSelectedClassIdsChange(): void {
    const classesStr = (this.selectedClassIds || []).join(',');

    if (this.sceneId && !this.periodo) {
      if (classesStr !== this.lastLoadedClasses && !this.isLoadingMask) {
        this.loadMaskLayer();
      }
    } else if (this.periodo && this.regionId && classesStr !== this.lastMultipleMaskClasses && !this.isLoadingMask) {
      this.lastMultipleMaskClasses = classesStr;
      this.loadMasksForPeriod();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }

    if (changes['visualizationType']) {
      this.handleVisualizationTypeChange();
      return;
    }

    if (changes['periodo'] || changes['regionId']) {
      this.handlePeriodOrRegionChange();
      return;
    }

    if (changes['sceneId']) {
      this.handleSceneIdChange();
      return;
    }

    if (changes['selectedClassIds']) {
      this.handleSelectedClassIdsChange();
    }
  }

  private initMap(): void {
    this.map = L.map('map', {
      center: this.center,
      zoom: this.zoom,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    
    // Cargar máscara si sceneId ya está disponible
    if (this.sceneId) {
      this.loadMaskLayer();
    }
  }

  private async loadMaskLayer(): Promise<void> {
    // Prevenir múltiples requests simultáneos
    if (this.isLoadingMask) {
      return;
    }

    // Remover capa anterior si existe
    if (this.maskLayer) {
      this.map.removeLayer(this.maskLayer);
    }

    if (!this.sceneId) return;

    this.isLoadingMask = true;

    try {
      // Mapeo de nombres de clases a índices numéricos (debe coincidir con el backend)
      const CLASS_NAME_TO_ID: Record<string, number> = {
        'unlabeled': 0, 'paved-area': 1, 'dirt': 2, 'grass': 3, 'gravel': 4,
        'water': 5, 'rocks': 6, 'pool': 7, 'vegetation': 8, 'roof': 9,
        'wall': 10, 'window': 11, 'door': 12, 'fence': 13, 'fence-pole': 14,
        'person': 15, 'dog': 16, 'car': 17, 'bicycle': 18, 'tree': 19,
        'bald-tree': 20, 'ar-marker': 21, 'obstacle': 22, 'conflicting': 23
      };
      
      // Construir URL según si hay clases seleccionadas
      let maskInfoUrl = `${environment.apiBaseUrl}/api/v1/segments/mask-info/${this.sceneId}`;
      
      // Determinar clases a mostrar: seleccionadas O todas excepto unlabeled
      let classesToShow = this.selectedClassIds && this.selectedClassIds.length > 0 
        ? this.selectedClassIds 
        : Object.keys(CLASS_NAME_TO_ID).filter(name => name !== 'unlabeled');  // Todas excepto unlabeled
      
      // Si hay clases a mostrar (distintas de todas), usar endpoint filtrado
      if (classesToShow && classesToShow.length > 0 && classesToShow.length < Object.keys(CLASS_NAME_TO_ID).length) {
        const classNumbers = classesToShow
          .filter(name => name in CLASS_NAME_TO_ID)
          .map(name => CLASS_NAME_TO_ID[name])
          .join(',');
        
        if (classNumbers) {
          maskInfoUrl = `${environment.apiBaseUrl}/api/v1/segments/mask-filtered/${this.sceneId}?classes=${encodeURIComponent(classNumbers)}`;
        }
      }
      
      // Guardar las clases para evitar recargas innecesarias
      this.lastLoadedClasses = (classesToShow || []).join(',');

      // Obtener información de proyección e imagen en base64
      const infoResponse = await fetch(maskInfoUrl);
      if (!infoResponse.ok) {
        console.warn('[LeafletMap] No se encontró la máscara para sceneId:', this.sceneId);
        console.warn('[LeafletMap] Status:', infoResponse.status, infoResponse.statusText);
        return;
      }

      const maskInfo = await infoResponse.json();

      // Extraer información de georeferenciación
      const bounds: L.LatLngBoundsExpression = this._convertBounds(
        maskInfo.bounds,
        maskInfo.crs
      );

      // Crear ImageOverlay con la imagen base64
      if (maskInfo.image) {
        this.currentMaskImageUrl = maskInfo.image;  // Guardar URL de la máscara para reportes
        this.maskLoaded.emit(maskInfo.image);  // Emitir evento con la máscara cargada
        this.maskLayer = L.imageOverlay(maskInfo.image, bounds, {
          opacity: this.maskOpacity,
          interactive: false
        });

        this.maskLayer.addTo(this.map);
        this.showMask = true;  // Mostrar automáticamente el checkbox

        // Centrar en la máscara solo la primera vez
        if (!this.maskCenteredOnce) {
          this.map.fitBounds(bounds, { padding: [50, 50] });
          // Desplazar la vista hacia arriba después de que fitBounds se complete
          this.map.once('moveend', () => {
            // Desplazar hacia arriba (valor positivo = hacia arriba en pantalla)
            this.map.panBy([0, 400], { animate: false });
          });
          this.maskCenteredOnce = true;
        }
      }

    } catch (error) {
      console.error('[LeafletMap] Error loading mask layer:', error);
    } finally {
      this.isLoadingMask = false;
    }
  }

  private clearSingleMask(): void {
    if (this.maskLayer) {
      this.map.removeLayer(this.maskLayer);
      this.maskLayer = undefined;
    }
  }

  private clearOriginalImage(): void {
    if (this.originalImageLayer) {
      this.map.removeLayer(this.originalImageLayer);
      this.originalImageLayer = undefined;
    }
  }

  private async loadOriginalImage(): Promise<void> {
    if (!this.sceneId) return;

    try {
      // Construir URL para obtener la imagen original (scene.tif)
      const imageUrl = `${environment.apiBaseUrl}/api/v1/scenes/${this.sceneId}/original-image`;

      // Obtener información de la imagen
      const infoResponse = await fetch(`${environment.apiBaseUrl}/api/v1/scenes/${this.sceneId}/image-info`);
      if (!infoResponse.ok) {
        return;
      }

      const imageInfo = await infoResponse.json();

      // Extraer información de georeferenciación
      const bounds: L.LatLngBoundsExpression = this._convertBounds(
        imageInfo.bounds,
        imageInfo.crs
      );

      // Crear ImageOverlay con la imagen original
      this.originalImageUrl = imageUrl;
      this.originalImageLayer = L.imageOverlay(imageUrl, bounds, {
        opacity: this.maskOpacity,
        interactive: false
      });

      this.originalImageLayer.addTo(this.map);

      // Centrar en la imagen solo la primera vez
      if (!this.maskCenteredOnce) {
        this.map.fitBounds(bounds, { padding: [50, 50] });
        this.map.once('moveend', () => {
          // Desplazar hacia arriba (valor positivo = hacia arriba en pantalla)
          this.map.panBy([0, 400], { animate: false });
        });
        this.maskCenteredOnce = true;
      }
    } catch (error) {
      console.error('[LeafletMap] Error loading original image:', error);
    }
  }

  private async loadOriginalImagesForMultipleMasks(): Promise<void> {
    if (!this.multiMaskMetadata || this.multiMaskMetadata.length === 0) {
      return;
    }

    try {
      // Crear primero todas las capas sin añadirlas al mapa
      const layersToAdd: L.ImageOverlay[] = [];
      
      const loadPromises = this.multiMaskMetadata.map(async (metadata) => {
        try {
          const imageUrl = `${environment.apiBaseUrl}/api/v1/scenes/${metadata.sceneId}/original-image`;
          
          const layer = L.imageOverlay(imageUrl, metadata.bounds, {
            opacity: this.maskOpacity,
            interactive: false
          });

          layersToAdd.push(layer);
        } catch (error) {
          console.error('[LeafletMap] Error creating image overlay layer:', error);
        }
      });

      await Promise.all(loadPromises);

      // Limpiar las máscaras antes de añadir las imágenes originales
      this.clearMultipleMasks();
      
      // Ahora añadir todas las imágenes originales al mapa
      for (const layer of layersToAdd) {
        this.originalImageLayers.push(layer);
        layer.addTo(this.map);
      }

      // Centrar en todas las imágenes la primera vez
      if (!this.maskCenteredOnce && this.originalImageLayers.length > 0) {
        const group = new L.FeatureGroup(this.originalImageLayers);
        this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        this.map.once('moveend', () => {
          // Desplazar hacia arriba (valor positivo = hacia arriba en pantalla)
          this.map.panBy([0, 400], { animate: false });
        });
        this.maskCenteredOnce = true;
      }
    } catch (error) {
      console.error('[LeafletMap] Error loading original images for multiple masks:', error);
    }
  }

  private updateVisualization(): void {
    // Resetear el flag para forzar centrado cuando se cambia visualización
    this.maskCenteredOnce = false;
    
    if (this.visualizationType === 'mask') {
      // Mostrar máscara
      this.clearOriginalImage();
      if (this.maskLayer) {
        this.maskLayer.addTo(this.map);
        // Centrar la máscara nuevamente al cambiar de visualización
        if (this.maskLayer instanceof L.ImageOverlay) {
          const bounds = (this.maskLayer as L.ImageOverlay).getBounds();
          this.map.fitBounds(bounds, { padding: [50, 50] });
          this.map.once('moveend', () => {
            this.map.panBy([0, 400], { animate: false });
          });
          this.maskCenteredOnce = true;
        }
      } else {
        this.loadMaskLayer();
      }
    } else {
      // Mostrar imagen original
      this.clearSingleMask();
      if (this.originalImageLayer) {
        this.originalImageLayer.addTo(this.map);
        // Centrar la imagen original nuevamente al cambiar de visualización
        if (this.originalImageLayer instanceof L.ImageOverlay) {
          const bounds = (this.originalImageLayer as L.ImageOverlay).getBounds();
          this.map.fitBounds(bounds, { padding: [50, 50] });
          this.map.once('moveend', () => {
            this.map.panBy([0, 400], { animate: false });
          });
          this.maskCenteredOnce = true;
        }
      } else {
        this.loadOriginalImage();
      }
    }
  }

  private updateMultipleMasksVisualization(): void {
    // Resetear el flag para forzar centrado cuando se cambia visualización
    this.maskCenteredOnce = false;
    
    if (this.visualizationType === 'mask') {
      this.updateMasksVisualization();
    } else {
      this.updateOriginalImagesVisualization();
    }
  }

  private updateMasksVisualization(): void {
    this.clearOriginalImagesMultiple();
    if (this.maskLayers.length === 0) {
      this.loadMasksForPeriod();
    } else {
      this.addLayersToMap(this.maskLayers);
      // Centrar en las máscaras al cambiar de visualización
      const group = new L.FeatureGroup(this.maskLayers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
      this.map.once('moveend', () => {
        this.map.panBy([0, 400], { animate: false });
      });
      this.maskCenteredOnce = true;
    }
  }

  private updateOriginalImagesVisualization(): void {
    this.clearMultipleMasks();
    if (this.originalImageLayers.length === 0 && this.multiMaskMetadata.length > 0) {
      this.loadOriginalImagesForMultipleMasks();
    } else {
      this.addLayersToMap(this.originalImageLayers);
      // Centrar en las imágenes originales al cambiar de visualización
      if (this.originalImageLayers.length > 0) {
        const group = new L.FeatureGroup(this.originalImageLayers);
        this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        this.map.once('moveend', () => {
          this.map.panBy([0, 400], { animate: false });
        });
        this.maskCenteredOnce = true;
      }
    }
  }

  private addLayersToMap(layers: L.Layer[]): void {
    for (const layer of layers) {
      if (!this.map.hasLayer(layer)) {
        layer.addTo(this.map);
      }
    }
  }

  private clearMultipleMasks(): void {
    for (const layer of this.maskLayers) {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    }
    this.maskLayers = [];
  }

  private clearOriginalImagesMultiple(): void {
    for (const layer of this.originalImageLayers) {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    }
    this.originalImageLayers = [];
  }

  // Método público para forzar recarga de máscaras (usado cuando cambian colores)
  public reloadMasks(): void {
    this.loadMasksForPeriod();
  }

  private loadMasksForPeriod(): void {
    if (this.isLoadingMask || !this.regionId || !this.periodo) {
      return;
    }
    
    // Resetear el flag para permitir que la máscara se centre de nuevo
    this.maskCenteredOnce = false;

    this.isLoadingMask = true;

    try {
      // Determinar clases a mostrar: seleccionadas O todas excepto unlabeled
      const classesToShow = this.selectedClassIds && this.selectedClassIds.length > 0 
        ? this.selectedClassIds 
        : this.classTypes.map(c => c.id);  // Todas las clases del UI (ya sin unlabeled)
      
      // Pasar clases al servicio y colores personalizados si existen
      // Usar getColorsForRendering para obtener los colores correctos según el modo de vista
      const customColors = this.classColorService.getColorsForRendering(this.coverageViewMode);
      this.segmentsService.getMasksForPeriod(this.regionId, this.periodo, classesToShow, customColors, false).subscribe({
        next: (response: any) => this.handleMasksResponse(response),
        error: (error: any) => {
        },
        complete: () => {
          this.isLoadingMask = false;
        }
      });
    } catch (error) {
      console.error('[LeafletMap] Error loading masks for period:', error);
      this.isLoadingMask = false;
    }
  }

  private _convertBounds(boundsObj: any, epsgCode: number | null): L.LatLngBoundsExpression {
    if (!epsgCode || epsgCode === 4326) {
      // Ya está en WGS84
      return [
        [boundsObj.minY, boundsObj.minX],
        [boundsObj.maxY, boundsObj.maxX]
      ];
    }

    // Convertir de UTM a WGS84
    const sourceProj = `EPSG:${epsgCode}`;
    const targetProj = 'EPSG:4326';

    try {
      const projDef = this._getProjectionDefinition(epsgCode);
      if (projDef) {
        proj4.defs(sourceProj, projDef);
      }

      const minXY = proj4(sourceProj, targetProj, [boundsObj.minX, boundsObj.minY]);
      const maxXY = proj4(sourceProj, targetProj, [boundsObj.maxX, boundsObj.maxY]);

      return [
        [minXY[1], minXY[0]],
        [maxXY[1], maxXY[0]]
      ];
    } catch (error) {
      console.error('[LeafletMap] Error converting bounds with projection:', error);
      return [
        [boundsObj.minY, boundsObj.minX],
        [boundsObj.maxY, boundsObj.maxX]
      ];
    }
  }

  private _getProjectionDefinition(epsgCode: number): string | null {
    // Definiciones de proyecciones comunes para Ecuador y alrededores
    const projDefinitions: Record<number, string | null> = {
      // UTM Zona 17 (Hemisferio Sur)
      32717: '+proj=utm +zone=17 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      // UTM Zona 18 (Hemisferio Sur)
      32718: '+proj=utm +zone=18 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      // UTM Zona 17 (Hemisferio Norte)
      32617: '+proj=utm +zone=17 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      // UTM Zona 18 (Hemisferio Norte)
      32618: '+proj=utm +zone=18 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      // WGS84 (No necesita conversión)
      4326: null
    };
    
    return projDefinitions[epsgCode] || null;
  }

  private fixLeafletIconPaths(): void {
    const iconDefault = L.icon({
      iconUrl: 'assets/marker-icon.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;
  }

  toggleMask(): void {
    // Máscara única
    if (this.maskLayer) {
      if (this.showMask) {
        this.maskLayer.addTo(this.map);
      } else {
        this.map.removeLayer(this.maskLayer);
      }
    }
    // Múltiples máscaras
    else if (this.maskLayers.length > 0) {
      for (const layer of this.maskLayers) {
        if (this.showMask) {
          if (!this.map.hasLayer(layer)) {
            layer.addTo(this.map);
          }
        } else if (this.map.hasLayer(layer)) {
          this.map.removeLayer(layer);
        }
      }
    }
  }

  onOpacityChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.maskOpacity = Number.parseFloat(target.value);
    this.updateMaskOpacity();
  }

  updateMaskOpacity(): void {
    // Máscara única
    if (this.maskLayer && (this.maskLayer as any).setOpacity) {
      (this.maskLayer as any).setOpacity(this.maskOpacity);
    }
    // Múltiples máscaras
    else if (this.maskLayers.length > 0) {
      for (const layer of this.maskLayers) {
        if ((layer as any).setOpacity) {
          (layer as any).setOpacity(this.maskOpacity);
        }
      }
    }
  }

  private handleMasksResponse(response: any): void {
    const masks = response.masks || [];
    
    if (masks.length === 0) {
      this.isLoadingMask = false;
      return;
    }

    this.clearMultipleMasks();
    this.clearOriginalImagesMultiple();
    this.multiMaskMetadata = [];

    const allBounds: L.LatLngBoundsExpression[] = [];
    const maskImages: string[] = [];

    this.processMasks(masks, allBounds, maskImages);
    this.showMask = true;
    this.centerMasksOnMap(allBounds);
    this.emitMasksLoadedEvent(maskImages, masks);
    this.loadOriginalImagesIfNeeded();
  }

  private processMasks(masks: any[], allBounds: L.LatLngBoundsExpression[], maskImages: string[]): void {
    for (let index = 0; index < masks.length; index++) {
      const maskData = masks[index];
      try {
        const bounds = this._convertBounds(maskData.bounds, maskData.crs);
        this.processSingleMask(maskData, bounds, allBounds, maskImages, index);
      } catch (error) {
        console.error('[LeafletMap] Error processing mask at index', index, ':', error);
      }
    }
  }

  private processSingleMask(maskData: any, bounds: L.LatLngBoundsExpression, allBounds: L.LatLngBoundsExpression[], maskImages: string[], index: number): void {
    if (!maskData.image) {
      return;
    }

    if (maskData.sceneId) {
      this.multiMaskMetadata.push({ sceneId: maskData.sceneId, bounds });
    }

    if (index === 0) {
      this.currentMaskImageUrl = maskData.image;
      this.maskLoaded.emit(maskData.image);
    }

    maskImages.push(maskData.image);

    const layer = L.imageOverlay(maskData.image, bounds, {
      opacity: this.maskOpacity,
      interactive: false
    });

    this.maskLayers.push(layer);
    layer.addTo(this.map);
    allBounds.push(bounds);
  }

  private centerMasksOnMap(allBounds: L.LatLngBoundsExpression[]): void {
    if (this.maskCenteredOnce || allBounds.length === 0) {
      return;
    }

    const group = new L.FeatureGroup(this.maskLayers);
    this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    this.map.once('moveend', () => {
      // Desplazar hacia arriba (valor positivo = hacia arriba en pantalla)
      this.map.panBy([0, 400], { animate: false });
    });
    this.maskCenteredOnce = true;
  }

  private emitMasksLoadedEvent(maskImages: string[], masks: any[]): void {
    if (this.regionId && this.periodo) {
      this.multipeMasksLoaded.emit({
        regionId: this.regionId,
        periodo: this.periodo,
        maskImages,
        maskMetadata: masks
      });
    }
  }

  private loadOriginalImagesIfNeeded(): void {
    if (this.visualizationType === 'original' && this.multiMaskMetadata.length > 0) {
      setTimeout(() => {
        this.updateMultipleMasksVisualization();
      }, 300);
    }
  }
}
