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
  @Input() className: string = '';  // Puede ser nombre de clase o categoría
  @Input() currentColor: string = '#000000';
  @Input() originalClassColors: { className: string; color: string }[] = []; // Colores originales de otras clases o categorías
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

  onNativeColorChange(): void {
    // Solo actualiza la vista previa, no emite nada
    // El color solo se aplica al hacer clic en "Confirmar"
  }

  selectGenericColor(color: string): void {
    this.selectedColor = color;
  }

  onClose(): void {
    this.close.emit();
  }
}

