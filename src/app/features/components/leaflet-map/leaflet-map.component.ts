import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { SegmentFeature } from '../../models/api.models';
import { getClassColor, CLASS_CATALOG } from '../../models/class-catalog';
import { environment } from '../../../../environments/environment';
import proj4 from 'proj4';

@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="leaflet-map-container">
      <div id="map" class="map"></div>
      
      <!-- Controles de máscara -->
      <div class="mask-controls" *ngIf="sceneId && maskLayer">
        <div class="control-group">
          <label>
            <input type="checkbox" [(ngModel)]="showMask" (change)="toggleMask()">
            Mostrar Máscara
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
  @Input() sceneId?: string; // Para cargar la máscara RGB
  @Input() selectedClassIds: string[] = []; // Clases seleccionadas para filtrar máscara
  @Output() featureClick = new EventEmitter<SegmentFeature>();

  private map!: L.Map;
  maskLayer?: L.Layer;  // Cambiar a público para acceso desde template
  classTypes = CLASS_CATALOG;
  
  // Control de máscara
  showMask: boolean = true;  // Cambiar a true para mostrar máscara por defecto
  maskOpacity: number = 1.0;
  private maskCenteredOnce: boolean = false; // Flag para controlar centrado inicial
  private lastLoadedClasses: string = ''; // Para evitar cargas duplicadas
  private isLoadingMask: boolean = false; // Para evitar múltiples requests simultáneos

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.fixLeafletIconPaths();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cargar máscara RGB cuando sceneId cambia
    if (changes['sceneId']) {
      if (this.map && this.sceneId) {
        this.maskCenteredOnce = false;
        this.lastLoadedClasses = ''; // Reset para nueva escena
        this.loadMaskLayer();
      }
    }
    // Recargar máscara cuando cambian las clases seleccionadas
    else if (changes['selectedClassIds'] && this.map && this.sceneId) {
      const classesStr = (this.selectedClassIds || []).join(',');
      
      // Solo cargar si las clases realmente cambiaron
      if (classesStr !== this.lastLoadedClasses && !this.isLoadingMask) {
        this.loadMaskLayer();
      }
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
      // Construir URL según si hay clases seleccionadas
      let maskInfoUrl = `${environment.apiBaseUrl}/api/v1/segments/mask-info/${this.sceneId}`;
      
      // Si hay clases seleccionadas, usar endpoint filtrado
      if (this.selectedClassIds && this.selectedClassIds.length > 0) {
        const classesParam = this.selectedClassIds.join(',');
        maskInfoUrl = `${environment.apiBaseUrl}/api/v1/segments/mask-filtered/${this.sceneId}?classes=${encodeURIComponent(classesParam)}`;
      }
      
      // Guardar las clases para evitar recargas innecesarias
      this.lastLoadedClasses = (this.selectedClassIds || []).join(',');

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
        this.maskLayer = L.imageOverlay(maskInfo.image, bounds, {
          opacity: this.maskOpacity,
          interactive: false
        });

        this.maskLayer.addTo(this.map);
        this.showMask = true;  // Mostrar automáticamente el checkbox

        // Centrar en la máscara solo la primera vez
        if (!this.maskCenteredOnce) {
          this.map.fitBounds(bounds, { padding: [50, 50] });
          this.maskCenteredOnce = true;
        }
      } else {
        console.warn('[LeafletMap] No se recibió imagen base64');
      }

    } catch (error) {
      console.error('[LeafletMap] Error cargando máscara:', error);
    } finally {
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
      console.warn('[LeafletMap] Error en conversión, usando bounds originales:', error);
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

  private _extractUTMZone(epsgCode: number): number {
    // Extraer zona UTM del código EPSG
    // Códigos EPSG para UTM van de 32601-32660 para hemisferio norte
    // y 32701-32760 para hemisferio sur
    if (epsgCode >= 32601 && epsgCode <= 32660) {
      return epsgCode - 32600;
    } else if (epsgCode >= 32701 && epsgCode <= 32760) {
      return epsgCode - 32700;
    }
    return 17; // Zona por defecto (Ecuador)
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
    if (this.maskLayer) {
      if (this.showMask) {
        this.maskLayer.addTo(this.map);
      } else {
        this.map.removeLayer(this.maskLayer);
      }
    }
  }

  onOpacityChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.maskOpacity = parseFloat(target.value);
    this.updateMaskOpacity();
  }

  updateMaskOpacity(): void {
    if (this.maskLayer && (this.maskLayer as any).setOpacity) {
      (this.maskLayer as any).setOpacity(this.maskOpacity);
    }
  }
}
