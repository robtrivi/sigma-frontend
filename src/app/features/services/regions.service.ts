import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Region } from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class RegionsService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/regions`;

  constructor(private readonly http: HttpClient) {}

  getRegions(): Observable<Region[]> {
    return this.http.get<Region[]>(this.apiUrl);
  }
}
