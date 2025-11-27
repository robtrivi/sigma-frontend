import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { AnalysisFilters, AnalysisResult, TemporalComparison, ClassData } from '../models/analysis.model';

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {

  getAnalysisResults(filters: AnalysisFilters): Observable<AnalysisResult[]> {
    const results: AnalysisResult[] = [
      {
        id: '1',
        name: 'Campus ESPOL - Análisis Octubre 2025',
        date: new Date('2025-10-15'),
        totalArea: 125450,
        greenCoverage: 62.5,
        classDistribution: this.generateClassDistribution()
      },
      {
        id: '2',
        name: 'Campus ESPOL - Análisis Septiembre 2025',
        date: new Date('2025-09-15'),
        totalArea: 125450,
        greenCoverage: 61.8,
        classDistribution: this.generateClassDistribution()
      },
      {
        id: '3',
        name: 'Campus ESPOL - Análisis Agosto 2025',
        date: new Date('2025-08-15'),
        totalArea: 125450,
        greenCoverage: 60.2,
        classDistribution: this.generateClassDistribution()
      }
    ];

    return of(results).pipe(delay(500));
  }

  getTemporalComparison(months: string[]): Observable<TemporalComparison[]> {
    const comparison: TemporalComparison[] = months.map(month => ({
      month,
      data: this.generateClassDistribution()
    }));

    return of(comparison).pipe(delay(400));
  }

  private generateClassDistribution(): ClassData[] {
    const baseDistribution = [
      { className: 'Áreas Verdes', color: '#4a7c2c', basePercentage: 62 },
      { className: 'Edificios', color: '#8b7355', basePercentage: 25 },
      { className: 'Calles', color: '#808080', basePercentage: 6 },
      { className: 'Parqueaderos', color: '#a9a9a9', basePercentage: 4 },
      { className: 'Cuerpos de Agua', color: '#4a90e2', basePercentage: 3 }
    ];

    return baseDistribution.map(item => {
      const variance = (Math.random() - 0.5) * 4;
      const percentage = Math.max(0, item.basePercentage + variance);
      const area = Math.round((125450 * percentage) / 100);

      return {
        className: item.className,
        area,
        percentage: Math.round(percentage * 10) / 10,
        color: item.color
      };
    });
  }

  exportAnalysis(analysisId: string, format: 'pdf' | 'csv'): Observable<Blob> {
    // Simulate export
    const mockData = format === 'pdf' 
      ? new Blob(['Mock PDF content'], { type: 'application/pdf' })
      : new Blob(['Mock CSV content'], { type: 'text/csv' });

    return of(mockData).pipe(delay(1000));
  }
}
