import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassType, MapCell, MonthFilter } from '../../models/visualization.models';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent {
  @Input({ required: true }) uploadedFile: string = '';
  @Input({ required: true }) hoveredCell: MapCell | null = null;
  @Input({ required: true }) months: MonthFilter[] = [];
  @Input({ required: true }) classTypes: ClassType[] = [];

  @Output() fileSelected = new EventEmitter<File>();
  @Output() monthFilterChange = new EventEmitter<void>();
  @Output() classFilterChange = new EventEmitter<void>();

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }

  notifyMonthChange(): void {
    this.monthFilterChange.emit();
  }

  notifyClassChange(): void {
    this.classFilterChange.emit();
  }
}
