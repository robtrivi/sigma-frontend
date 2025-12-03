import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassType, MonthFilter } from '../../models/visualization.models';
import { SegmentFeature } from '../../models/api.models';

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
export class ControlPanelComponent {
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
  epsg: number = 32618;
  sensor: string = 'drone_dji_phantom';
  regionId: string = 'region_norte';

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onUploadScene(): void {
    if (this.selectedFile && this.captureDate && this.epsg && this.sensor && this.regionId) {
      this.sceneUpload.emit({
        file: this.selectedFile,
        captureDate: this.captureDate,
        epsg: this.epsg,
        sensor: this.sensor,
        regionId: this.regionId
      });
    }
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
