import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClassType, MapCell } from '../../models/visualization.models';

@Component({
  selector: 'app-map-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-grid.component.html',
  styleUrls: ['./map-grid.component.scss']
})
export class MapGridComponent {
  @Input({ required: true }) cells: MapCell[] = [];
  @Input({ required: true }) classTypes: ClassType[] = [];
  @Input() hoveredCell: MapCell | null = null;

  @Output() cellHover = new EventEmitter<MapCell>();
  @Output() cellLeave = new EventEmitter<void>();
  @Output() cellSelect = new EventEmitter<MapCell>();

  trackByCellId(_: number, cell: MapCell): number {
    return cell.id;
  }

  getCellClasses(cell: MapCell): Record<string, boolean> {
    return {
      [cell.classId]: true,
      selected: cell.selected
    };
  }
}
