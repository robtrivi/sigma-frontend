import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TiffBandInfo {
  index: number;
  dtype: string;
  minValue?: number;
  maxValue?: number;
  nodata?: any;
  colorInterp?: string;
}

export interface TiffBoundsInfo {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
}

export interface TiffPixelSize {
  width: number;
  height: number;
}

export interface TiffValidationResult {
  valid: boolean;
  width: number;
  height: number;
  bandCount: number;
  dtype: string;
  epsgCode: number | null;
  crsWkt: string | null;
  bounds: TiffBoundsInfo;
  boundsWgs84?: TiffBoundsInfo;
  pixelSize: TiffPixelSize;
  compression: string | null;
  photometric: string | null;
  bands: TiffBandInfo[];
  fileSizeMb: number;
  warnings: string[];
  estimatedProcessingTimeSec?: number;
}

export interface TiffMetadata {
  width: number;
  height: number;
  bandCount: number;
  epsgCode: number | null;
  crsWkt: string | null;
  bounds: TiffBoundsInfo;
  boundsWgs84?: TiffBoundsInfo;
  pixelSize: TiffPixelSize;
  compression: string | null;
  photometric: string | null;
  bands: TiffBandInfo[];
  tags: Record<string, any>;
  fileSizeBytes: number;
  fileSizeMb: number;
  warnings: string[];
  captureDate?: string;
  sensorHints?: Record<string, string>;
}

export interface EpsgSupportResult {
  supported: boolean;
  epsgCode: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class TiffValidationService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/imports`;

  constructor(private http: HttpClient) {}

  validateTiff(file: File, epsgCode?: number): Observable<TiffValidationResult> {
    const formData = new FormData();
    formData.append('file', file);

    let url = `${this.apiUrl}/validate-tiff`;
    if (epsgCode !== undefined) {
      url += `?epsg_code=${epsgCode}`;
    }

    return this.http.post<TiffValidationResult>(url, formData);
  }

  extractMetadata(file: File): Observable<TiffMetadata> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<TiffMetadata>(
      `${this.apiUrl}/tiff-metadata`,
      formData
    );
  }

  checkEpsgSupport(epsgCode: number): Observable<EpsgSupportResult> {
    return this.http.get<EpsgSupportResult>(
      `${this.apiUrl}/check-epsg-support?epsg_code=${epsgCode}`
    );
  }
}
