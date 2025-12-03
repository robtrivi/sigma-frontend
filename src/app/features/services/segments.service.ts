import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SegmentationResponse, SegmentsTilesParams, SegmentsTilesResponse } from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class SegmentsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/segments`;

  constructor(private http: HttpClient) {}

  runSegmentation(sceneId: string, tiffFile: File): Observable<SegmentationResponse> {
    const formData = new FormData();
    formData.append('tiff_file', tiffFile);

    return this.http.post<SegmentationResponse>(`${this.baseUrl}/scenes/${sceneId}/segment`, formData);
  }

  getSegmentsTiles(params: SegmentsTilesParams): Observable<SegmentsTilesResponse> {
    let httpParams = new HttpParams()
      .set('regionId', params.regionId)
      .set('periodo', params.periodo);

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
}
