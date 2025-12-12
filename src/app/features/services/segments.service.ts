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
}
