import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { SegmentFeature } from '../../models/api.models';
import { getClassColor, CLASS_CATALOG } from '../../models/class-catalog';

@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="leaflet-map-container">
      <div id="map" class="map"></div>
      <div class="map-legend" *ngIf="showLegend">
        <h4>Leyenda</h4>
        <div class="legend-item" *ngFor="let classType of classTypes">
          <span class="legend-color" [style.background-color]="classType.color"></span>
          <span>{{ classType.name }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .leaflet-map-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    .map {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .map-legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      max-width: 200px;
    }
    
    .map-legend h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
    }
    
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      margin-right: 8px;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }
  `]
})
export class LeafletMapComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @Input() features: SegmentFeature[] = [];
  @Input() center: [number, number] = [-2.1448, -79.9651];
  @Input() zoom: number = 15;
  @Input() showLegend: boolean = true;
  @Output() featureClick = new EventEmitter<SegmentFeature>();

  private map!: L.Map;
  private segmentsLayer?: L.GeoJSON;
  classTypes = CLASS_CATALOG;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.fixLeafletIconPaths();
    }
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['features'] && this.map) {
      this.updateSegments();
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

    this.updateSegments();
  }

  private updateSegments(): void {
    if (this.segmentsLayer) {
      this.map.removeLayer(this.segmentsLayer);
    }

    if (this.features.length === 0) {
      return;
    }

    const geojsonData = {
      type: 'FeatureCollection' as const,
      features: this.features
    };

    this.segmentsLayer = L.geoJSON(geojsonData, {
      style: (feature) => {
        const classId = feature?.properties?.classId || '';
        return {
          fillColor: getClassColor(classId),
          weight: 2,
          opacity: 1,
          color: 'white',
          fillOpacity: 0.6
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const popupContent = `
          <div style="font-family: sans-serif;">
            <h4 style="margin: 0 0 8px 0; color: #2d5016;">${props.className}</h4>
            <p style="margin: 4px 0;"><strong>Área:</strong> ${props.areaM2.toFixed(2)} m²</p>
            <p style="margin: 4px 0;"><strong>Confianza:</strong> ${(props.confidence * 100).toFixed(1)}%</p>
            <p style="margin: 4px 0;"><strong>Período:</strong> ${props.periodo}</p>
            <p style="margin: 4px 0;"><strong>Región:</strong> ${props.regionId}</p>
          </div>
        `;
        layer.bindPopup(popupContent);

        layer.on('click', () => {
          this.featureClick.emit(feature as SegmentFeature);
        });
      }
    });

    this.segmentsLayer.addTo(this.map);

    const bounds = this.segmentsLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
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
}
