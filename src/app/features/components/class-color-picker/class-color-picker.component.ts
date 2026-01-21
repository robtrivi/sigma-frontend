import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-class-color-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-color-picker.component.html',
  styleUrls: ['./class-color-picker.component.scss']
})
export class ClassColorPickerComponent implements OnInit {
  @Input() className: string = '';
  @Input() currentColor: string = '#000000';
  @Input() originalClassColors: { className: string; color: string }[] = []; // Colores originales de otras clases
  @Output() colorSelected = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  selectedColor: string = '#000000';

  ngOnInit(): void {
    this.selectedColor = this.currentColor;
  }

  onColorChange(): void {
    this.colorSelected.emit(this.selectedColor);
    this.close.emit();
  }

  selectGenericColor(color: string): void {
    this.selectedColor = color;
    this.colorSelected.emit(color);
    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}

