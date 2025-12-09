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

  infoBoxStyle: { [key: string]: string } = {};

  trackByCellId(_: number, cell: MapCell): number {
    return cell.id;
  }

  getCellClasses(cell: MapCell): Record<string, boolean> {
    return {
      [cell.classId]: true,
      selected: cell.selected
    };
  }

  onMapMouseMove(event: MouseEvent): void {
    if (this.hoveredCell) {
      const mapArea = (event.target as HTMLElement).closest('.map-area') as HTMLElement;
      if (mapArea) {
        const rect = mapArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        let posX = x + 15;
        let posY = y - 50;

        if (posX + 250 > rect.width) {
          posX = x - 265;
        }
        if (posY < 0) {
          posY = y + 15;
        }

        this.infoBoxStyle = {
          left: `${Math.max(0, posX)}px`,
          top: `${Math.max(0, posY)}px`,
          position: 'absolute'
        };
      }
    }
  }
}
