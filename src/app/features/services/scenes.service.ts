import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SceneResponse, SceneUploadRequest } from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class ScenesService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/imports/scenes`;

  constructor(private readonly http: HttpClient) {}

  uploadScene(payload: SceneUploadRequest): Observable<SceneResponse> {
    const formData = new FormData();
    formData.append('scene_file', payload.file);
    formData.append('capture_date', payload.captureDate);
    formData.append('epsg', payload.epsg.toString());
    formData.append('sensor', payload.sensor);
    formData.append('region_id', payload.regionId);

    return this.http.post<SceneResponse>(this.apiUrl, formData);
  }
}
