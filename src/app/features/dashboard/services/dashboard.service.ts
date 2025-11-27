import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { 
  DashboardMetrics, 
  ClassDistribution, 
  TemporalAnalysis,
  RecentActivity 
} from '../models/dashboard-metrics.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  
  getDashboardMetrics(): Observable<DashboardMetrics> {
    const metrics: DashboardMetrics = {
      totalImages: 45,
      processedImages: 42,
      totalArea: 125450,
      greenCoverage: 62.5,
      activeAnalyses: 8,
      recentReports: 12
    };

    return of(metrics).pipe(delay(300));
  }

  getClassDistribution(): Observable<ClassDistribution[]> {
    const distribution: ClassDistribution[] = [
      { className: 'Áreas Verdes', area: 78406, percentage: 62.5, color: '#4a7c2c' },
      { className: 'Edificios', area: 31363, percentage: 25.0, color: '#8b7355' },
      { className: 'Calles', area: 7527, percentage: 6.0, color: '#808080' },
      { className: 'Parqueaderos', area: 5018, percentage: 4.0, color: '#a9a9a9' },
      { className: 'Cuerpos de Agua', area: 3136, percentage: 2.5, color: '#4a90e2' }
    ];

    return of(distribution).pipe(delay(300));
  }

  getTemporalAnalysis(): Observable<TemporalAnalysis[]> {
    const analysis: TemporalAnalysis[] = [
      { month: 'Enero 2025', greenArea: 72500, buildingArea: 32000, waterArea: 3000 },
      { month: 'Febrero 2025', greenArea: 74200, buildingArea: 31800, waterArea: 3100 },
      { month: 'Marzo 2025', greenArea: 75800, buildingArea: 31600, waterArea: 3150 },
      { month: 'Abril 2025', greenArea: 76900, buildingArea: 31500, waterArea: 3200 },
      { month: 'Mayo 2025', greenArea: 77500, buildingArea: 31400, waterArea: 3250 },
      { month: 'Junio 2025', greenArea: 78100, buildingArea: 31350, waterArea: 3280 },
      { month: 'Julio 2025', greenArea: 78400, buildingArea: 31365, waterArea: 3136 }
    ];

    return of(analysis).pipe(delay(300));
  }

  getRecentActivities(): Observable<RecentActivity[]> {
    const activities: RecentActivity[] = [
      {
        id: '1',
        type: 'upload',
        description: 'Imagen TIFF cargada - Campus ESPOL Norte',
        date: new Date('2025-11-26T10:30:00'),
        status: 'completed'
      },
      {
        id: '2',
        type: 'analysis',
        description: 'Análisis temporal completado - Octubre 2025',
        date: new Date('2025-11-26T09:15:00'),
        status: 'completed'
      },
      {
        id: '3',
        type: 'report',
        description: 'Informe generado - Áreas Verdes Q3',
        date: new Date('2025-11-25T16:45:00'),
        status: 'completed'
      },
      {
        id: '4',
        type: 'upload',
        description: 'Imagen TIFF cargada - Campus ESPOL Sur',
        date: new Date('2025-11-25T14:20:00'),
        status: 'completed'
      },
      {
        id: '5',
        type: 'analysis',
        description: 'Segmentación en proceso - Área Central',
        date: new Date('2025-11-25T11:30:00'),
        status: 'processing'
      }
    ];

    return of(activities).pipe(delay(300));
  }

  // Generar datos aleatorios para pruebas
  generateRandomMetrics(): Observable<DashboardMetrics> {
    const metrics: DashboardMetrics = {
      totalImages: Math.floor(Math.random() * 100) + 20,
      processedImages: Math.floor(Math.random() * 90) + 15,
      totalArea: Math.floor(Math.random() * 50000) + 100000,
      greenCoverage: Math.floor(Math.random() * 30) + 50,
      activeAnalyses: Math.floor(Math.random() * 15) + 1,
      recentReports: Math.floor(Math.random() * 20) + 5
    };

    return of(metrics).pipe(delay(300));
  }
}
