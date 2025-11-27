export interface SegmentationImage {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  captureDate?: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  width?: number;
  height?: number;
  format: string;
}

export interface SegmentationResult {
  imageId: string;
  segmentedUrl: string;
  classes: SegmentationClass[];
  totalArea: number;
  processingTime: number;
}

export interface SegmentationClass {
  id: string;
  name: string;
  color: string;
  area: number;
  percentage: number;
  cellCount: number;
}
