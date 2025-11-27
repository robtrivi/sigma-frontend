import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { MapCell, MapLegend, SubRegion } from '../models/map.model';

@Injectable({
  providedIn: 'root'
})
export class VisualizationService {

  generateMapCells(): Observable<MapCell[]> {
    const cells: MapCell[] = [];
    const types: Array<'green' | 'building' | 'street' | 'parking' | 'water'> = 
      ['green', 'building', 'street', 'parking', 'water'];
    const names = {
      green: ['Área Verde A', 'Área Verde B', 'Área Verde C', 'Área Verde D', 'Área Verde E', 'Área Verde F', 'Área Verde G'],
      building: ['Edificio 1', 'Edificio 2', 'Biblioteca', 'Edificio 3', 'Auditorio'],
      street: ['Calle Principal', 'Avenida Sur', 'Calle Este', 'Calle Oeste'],
      parking: ['Parqueadero', 'Parqueadero 2', 'Parqueadero 3'],
      water: ['Lago', 'Fuente']
    };

    let cellId = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const nameArray = names[type];
        const name = nameArray[Math.floor(Math.random() * nameArray.length)];
        
        cells.push({
          id: `cell_${cellId}`,
          name,
          type,
          area: Math.floor(Math.random() * 2000) + 1500,
          row,
          col,
          selected: false,
          hovered: false
        });
        cellId++;
      }
    }

    return of(cells).pipe(delay(300));
  }

  getMapLegend(): Observable<MapLegend[]> {
    const legend: MapLegend[] = [
      { type: 'green', label: 'Áreas Verdes', color: '#4a7c2c', count: 7 },
      { type: 'building', label: 'Edificios', color: '#8b7355', count: 5 },
      { type: 'street', label: 'Calles', color: '#808080', count: 4 },
      { type: 'parking', label: 'Parqueaderos', color: '#a9a9a9', count: 3 },
      { type: 'water', label: 'Cuerpos de Agua', color: '#4a90e2', count: 1 }
    ];

    return of(legend).pipe(delay(200));
  }

  getSubRegionAnalysis(cellIds: string[]): Observable<SubRegion> {
    const totalArea = cellIds.length * 2500; // Promedio
    const greenCoverage = Math.floor(Math.random() * 40) + 50;

    const subRegion: SubRegion = {
      id: 'subregion_1',
      name: 'Área Centro Campus',
      cells: cellIds,
      totalArea,
      greenCoverage
    };

    return of(subRegion).pipe(delay(300));
  }
}
