export interface Region {
  id: string;
  name: string;
  geometry: any;
}

export interface SceneUploadRequest {
  file: File;
  captureDate: string;
  epsg: number;
  sensor: string;
  regionId: string;
}

export interface SceneResponse {
  sceneId: string;
  regionId: string;
  captureDate: string;
  epsg: number;
  sensor: string;
  rasterPath: string;
}

export interface SegmentationResponse {
  inserted: number;
  segmentIds: string[];
}

export interface SegmentsTilesParams {
  regionId: string;
  periodo?: string;
  classIds?: string[];
  bbox?: string;
}

export interface SegmentProperties {
  segmentId: string;
  sceneId: string;
  regionId: string;
  classId: string;
  className: string;
  areaM2: number;
  periodo: string;
  confidence: number;
  source: 'dl_segmentation' | 'manual';
  notes?: string;
}

export interface SegmentFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: SegmentProperties;
}

export interface SegmentsTilesResponse {
  type: 'FeatureCollection';
  features: SegmentFeature[];
}

// Interfaz para periodos disponibles
export interface PeriodInfo {
  periodo: string; // Formato YYYY-MM
  regionId: string;
  segmentCount: number;
  lastUpdated: string; // ISO 8601 date string
}

// Interfaz para actualización manual de segmentos
export interface SegmentUpdateRequest {
  classId: string;
  confidence?: number;
  notes?: string;
}

// ===== INTERFACES PARA ANÁLISIS DE COBERTURA POR PÍXELES Y ÁREA EN M² =====

export interface PixelCoverageItem {
  class_id: number;
  class_name: string;
  pixel_count: number;
  coverage_percentage: number;
  area_m2?: number;  // Área en metros cuadrados
}

export interface SegmentationCoverageResponse {
  scene_id: string;
  total_pixels: number;
  total_area_m2?: number;
  pixel_area_m2?: number;
  image_resolution: string;
  coverage_by_class: PixelCoverageItem[];
  created_at: string;
}

export interface SegmentationCoverageSummary {
  scene_id: string;
  dominant_class: string;
  dominant_percentage: number;
  secondary_class?: string;
  secondary_percentage?: number;
}
