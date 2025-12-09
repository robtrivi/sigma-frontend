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
  periodo: string;
  classIds?: string[];
  bbox?: string;
}

export interface SegmentProperties {
  segmentId: string;
  regionId: string;
  classId: string;
  className: string;
  areaM2: number;
  periodo: string;
  confidence: number;
  source: string;
}

export interface SegmentFeature {
  type: 'Feature';
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
  properties: SegmentProperties;
}

export interface SegmentsTilesResponse {
  type: 'FeatureCollection';
  features: SegmentFeature[];
}
