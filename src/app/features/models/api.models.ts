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
  classId: number;
  className: string;
  pixelCount: number;
  coveragePercentage: number;
  areaM2?: number;  // Área en metros cuadrados
  // Snake_case variants for API compatibility
  class_name?: string;
  pixel_count?: number;
  coverage_percentage?: number;
  area_m2?: number;
}

export interface SegmentationCoverageResponse {
  sceneId: string;
  totalPixels: number;
  totalAreaM2?: number;
  pixelAreaM2?: number;
  imageResolution: string;
  coverageByClass: PixelCoverageItem[];
  createdAt: string;
}

export interface SegmentationCoverageSummary {
  sceneId: string;
  dominantClass: string;
  dominantPercentage: number;
  secondaryClass?: string;
  secondaryPercentage?: number;
}
