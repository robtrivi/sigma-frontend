import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { FileUploadModule } from 'primeng/fileupload';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SegmentationService } from './services/segmentation.service';
import { SegmentationImage } from './models/segmentation.model';
import { FormatDatePipe } from '../../shared/pipes/format-date.pipe';
import { StatusLabelPipe } from '../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-segmentation',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    FileUploadModule,
    CardModule,
    ProgressBarModule,
    ButtonModule,
    MessageModule,
    ToastModule,
    FormatDatePipe,
    StatusLabelPipe
  ],
  providers: [MessageService],
  templateUrl: './segmentation.component.html',
  styleUrls: ['./segmentation.component.scss']
})
export class SegmentationComponent implements OnInit {
  private segmentationService = inject(SegmentationService);
  private messageService = inject(MessageService);

  protected images = signal<SegmentationImage[]>([]);
  protected uploadedFiles = signal<File[]>([]);
  protected currentUpload = signal<SegmentationImage | null>(null);
  protected isProcessing = signal(false);

  ngOnInit() {
    this.loadImages();
  }

  private loadImages() {
    this.segmentationService.getImages().subscribe(images => {
      this.images.set(images);
    });
  }

  onUpload(event: any) {
    const file = event.files[0];
    
    if (file) {
      this.messageService.add({
        severity: 'info',
        summary: 'Subiendo imagen',
        detail: `Procesando ${file.name}...`
      });

      this.segmentationService.uploadImage(file).subscribe({
        next: (image) => {
          this.currentUpload.set(image);
          this.loadImages();
          
          this.messageService.add({
            severity: 'success',
            summary: 'Imagen cargada',
            detail: `${file.name} se cargó correctamente`
          });

          // Auto-process
          this.processImage(image.id);
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la imagen'
          });
        }
      });
    }
  }

  processImage(imageId: string) {
    this.isProcessing.set(true);

    this.segmentationService.processImage(imageId).subscribe({
      next: (image) => {
        this.currentUpload.set(image);
        this.loadImages();
      },
      complete: () => {
        this.isProcessing.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Segmentación completada',
          detail: 'La imagen ha sido procesada exitosamente'
        });
      },
      error: (error) => {
        this.isProcessing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error durante la segmentación'
        });
      }
    });
  }

  viewResults(imageId: string) {
    this.messageService.add({
      severity: 'info',
      summary: 'Navegando',
      detail: 'Redirigiendo a resultados...'
    });
  }

  deleteImage(imageId: string) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Eliminar',
      detail: 'Funcionalidad en desarrollo'
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      processing: 'info',
      completed: 'success',
      error: 'danger'
    };
    return colors[status] || 'secondary';
  }
}
