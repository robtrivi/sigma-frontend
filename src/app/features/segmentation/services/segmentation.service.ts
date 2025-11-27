import { Injectable } from '@angular/core';
import { Observable, of, delay, map } from 'rxjs';
import { SegmentationImage, SegmentationResult, SegmentationClass } from '../models/segmentation.model';

@Injectable({
  providedIn: 'root'
})
export class SegmentationService {
  
  private images: SegmentationImage[] = [];

  uploadImage(file: File): Observable<SegmentationImage> {
    const image: SegmentationImage = {
      id: this.generateId(),
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date(),
      captureDate: this.extractCaptureDate(file.name),
      status: 'pending',
      progress: 0,
      format: file.type
    };

    this.images.push(image);

    return of(image).pipe(delay(500));
  }

  processImage(imageId: string): Observable<SegmentationImage> {
    const image = this.images.find(img => img.id === imageId);
    
    if (!image) {
      throw new Error('Image not found');
    }

    // Simulate processing
    image.status = 'processing';
    image.progress = 0;

    return new Observable(observer => {
      const interval = setInterval(() => {
        image.progress += 10;
        
        if (image.progress >= 100) {
          image.status = 'completed';
          image.progress = 100;
          clearInterval(interval);
          observer.next(image);
          observer.complete();
        } else {
          observer.next(image);
        }
      }, 500);
    });
  }

  getSegmentationResult(imageId: string): Observable<SegmentationResult> {
    const classes: SegmentationClass[] = [
      {
        id: '1',
        name: 'Áreas Verdes',
        color: '#4a7c2c',
        area: 78406,
        percentage: 62.5,
        cellCount: 7
      },
      {
        id: '2',
        name: 'Edificios',
        color: '#8b7355',
        area: 31363,
        percentage: 25.0,
        cellCount: 5
      },
      {
        id: '3',
        name: 'Calles',
        color: '#808080',
        area: 7527,
        percentage: 6.0,
        cellCount: 4
      },
      {
        id: '4',
        name: 'Parqueaderos',
        color: '#a9a9a9',
        area: 5018,
        percentage: 4.0,
        cellCount: 3
      },
      {
        id: '5',
        name: 'Cuerpos de Agua',
        color: '#4a90e2',
        area: 3136,
        percentage: 2.5,
        cellCount: 1
      }
    ];

    const result: SegmentationResult = {
      imageId,
      segmentedUrl: '/assets/segmented-map.png',
      classes,
      totalArea: 125450,
      processingTime: 4.5
    };

    return of(result).pipe(delay(500));
  }

  getImages(): Observable<SegmentationImage[]> {
    return of(this.images).pipe(delay(300));
  }

  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractCaptureDate(fileName: string): Date {
    // Try to extract date from filename (format: YYYYMMDD)
    const dateMatch = fileName.match(/(\d{8})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }
    
    // Default to current date
    return new Date();
  }
}
