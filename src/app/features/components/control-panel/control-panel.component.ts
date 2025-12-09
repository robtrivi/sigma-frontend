import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassType, MonthFilter } from '../../models/visualization.models';
import { SegmentFeature, Region } from '../../models/api.models';
import { RegionsService } from '../../services/regions.service';

export interface SceneUploadData {
  file: File;
  captureDate: string;
  epsg: number;
  sensor: string;
  regionId: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent implements OnInit {
  @Input({ required: true }) uploadedFile: string = '';
  @Input({ required: true }) hoveredFeature: SegmentFeature | null = null;
  @Input({ required: true }) months: MonthFilter[] = [];
  @Input({ required: true }) classTypes: ClassType[] = [];
  @Input() isLoading: boolean = false;
  @Input() canRunSegmentation: boolean = false;

  @Output() sceneUpload = new EventEmitter<SceneUploadData>();
  @Output() runSegmentation = new EventEmitter<void>();
  @Output() monthFilterChange = new EventEmitter<void>();
  @Output() classFilterChange = new EventEmitter<void>();

  selectedFile: File | null = null;
  captureDate: string = '';
  epsg: number = 32717;
  sensor: string = 'drone_dji_phantom';
  regionId: string = '';
  regions: Region[] = [];

  constructor(private regionsService: RegionsService) {}

  ngOnInit(): void {
    this.regionsService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        if (regions.length > 0) {
          this.regionId = regions[0].id;
        }
      },
      error: (err) => console.error('Error cargando regiones:', err)
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile = file;
      
      if (!this.captureDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        this.captureDate = `${year}-${month}-${day}`;
      }
    }
  }

  onUploadScene(): void {
    if (!this.selectedFile) {
      console.error('No se ha seleccionado archivo');
      return;
    }

    if (!this.captureDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.captureDate = `${year}-${month}-${day}`;
    }

    this.sceneUpload.emit({
      file: this.selectedFile,
      captureDate: this.captureDate,
      epsg: this.epsg,
      sensor: this.sensor,
      regionId: this.regionId
    });
  }

  get canUpload(): boolean {
    return !!this.selectedFile && !this.isLoading;
  }

  onRunSegmentation(): void {
    this.runSegmentation.emit();
  }

  notifyMonthChange(): void {
    this.monthFilterChange.emit();
  }

  notifyClassChange(): void {
    this.classFilterChange.emit();
  }
}
