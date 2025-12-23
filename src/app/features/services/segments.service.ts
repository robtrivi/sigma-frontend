import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  SegmentationResponse, 
  SegmentsTilesParams, 
  SegmentsTilesResponse,
  PeriodInfo,
  SegmentUpdateRequest,
  SegmentationCoverageResponse,
  SegmentationCoverageSummary
} from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class SegmentsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/segments`;
  private readonly regionsUrl = `${environment.apiBaseUrl}/api/v1/regions`;
  private readonly importsUrl = `${environment.apiBaseUrl}/api/v1/imports`;

  constructor(private http: HttpClient) {}

  runSegmentation(sceneId: string, tiffFile: File): Observable<SegmentationResponse> {
    const formData = new FormData();
    formData.append('tiff_file', tiffFile);

    return this.http.post<SegmentationResponse>(`${this.baseUrl}/scenes/${sceneId}/segment`, formData);
  }

  getSegmentsTiles(params: SegmentsTilesParams): Observable<SegmentsTilesResponse> {
    let httpParams = new HttpParams()
      .set('regionId', params.regionId);

    if (params.periodo) {
      httpParams = httpParams.set('periodo', params.periodo);
    }

    if (params.classIds && params.classIds.length > 0) {
      params.classIds.forEach(classId => {
        httpParams = httpParams.append('classId', classId);
      });
    }

    if (params.bbox) {
      httpParams = httpParams.set('bbox', params.bbox);
    }

    return this.http.get<SegmentsTilesResponse>(`${this.baseUrl}/tiles`, { params: httpParams });
  }

  getAvailablePeriods(regionId: string, from?: string, to?: string): Observable<PeriodInfo[]> {
    let httpParams = new HttpParams();
    
    if (from) {
      httpParams = httpParams.set('from', from);
    }
    
    if (to) {
      httpParams = httpParams.set('to', to);
    }

    return this.http.get<PeriodInfo[]>(
      `${this.regionsUrl}/${regionId}/periods`, 
      { params: httpParams }
    );
  }

  updateSegment(segmentId: string, update: SegmentUpdateRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${segmentId}`, update);
  }

  // ===== MÉTODOS PARA ANÁLISIS DE COBERTURA POR PÍXELES =====

  /**
   * Obtiene cobertura detallada por píxeles para una escena.
   * Incluye conteo de píxeles y porcentajes para cada clase.
   * 
   * @param sceneId UUID de la escena
   * @returns Observable con cobertura completa
   */
  getCoverage(sceneId: string): Observable<SegmentationCoverageResponse> {
    return this.http.get<SegmentationCoverageResponse>(
      `${this.baseUrl}/coverage/${sceneId}`
    );
  }

  /**
   * Obtiene resumen rápido de cobertura (clases dominantes).
   * Optimizado para dashboards con muchas escenas.
   * 
   * @param sceneId UUID de la escena
   * @returns Observable con resumen de cobertura
   */
  getCoverageSummary(sceneId: string): Observable<SegmentationCoverageSummary> {
    return this.http.get<SegmentationCoverageSummary>(
      `${this.baseUrl}/coverage-summary/${sceneId}`
    );
  }

  getMasksForPeriod(regionId: string, periodo: string, selectedClassIds?: string[]): Observable<any> {
    let params = new HttpParams().set('periodo', periodo);
    
    // Pasar clases seleccionadas si existen
    if (selectedClassIds && selectedClassIds.length > 0) {
      // Mapear nombres de clases a índices numéricos
      const CLASS_NAME_TO_ID: Record<string, number> = {
        'unlabeled': 0, 'paved-area': 1, 'dirt': 2, 'grass': 3, 'gravel': 4,
        'water': 5, 'rocks': 6, 'pool': 7, 'vegetation': 8, 'roof': 9,
        'wall': 10, 'window': 11, 'door': 12, 'fence': 13, 'fence-pole': 14,
        'person': 15, 'dog': 16, 'car': 17, 'bicycle': 18, 'tree': 19,
        'bald-tree': 20, 'ar-marker': 21, 'obstacle': 22, 'conflicting': 23
      };
      
      const classNumbers = selectedClassIds
        .filter(name => name in CLASS_NAME_TO_ID)
        .map(name => CLASS_NAME_TO_ID[name])
        .join(',');
      
      if (classNumbers) {
        params = params.set('classes', classNumbers);
      }
    }
    
    return this.http.get<any>(
      `${this.baseUrl}/masks-by-period/${regionId}`,
      { params }
    );
  }

  getAggregatedPixelCoverage(regionId: string, periodo: string): Observable<any> {
    const params = new HttpParams().set('periodo', periodo);
    return this.http.get<any>(
      `${this.baseUrl}/pixel-coverage-aggregated/${regionId}`,
      { params }
    );
  }

  clearAllData(): Observable<any> {
    return this.http.delete<any>(`${this.importsUrl}/clear-all-data`);
  }
}
