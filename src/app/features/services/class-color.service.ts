import { Injectable } from '@angular/core';

export interface ClassColor {
  className: string;
  customColor: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClassColorService {
  private customColors: Map<string, string> = new Map();
  private readonly STORAGE_KEY = 'sigma_class_colors';

  constructor() {
    this.loadColorsFromStorage();
  }

  // Obtener color personalizado para una clase
  getColor(className: string): string | null {
    return this.customColors.get(className) || null;
  }

  // Establecer color personalizado para una clase
  setColor(className: string, color: string): void {
    this.customColors.set(className, color);
    this.saveColorsToStorage();
  }

  // Obtener todos los colores personalizados
  getAllColors(): Map<string, string> {
    return new Map(this.customColors);
  }

  // Limpiar todos los colores personalizados
  clearAllColors(): void {
    this.customColors.clear();
    this.saveColorsToStorage();
  }

  // Guardar colores en localStorage
  private saveColorsToStorage(): void {
    const colorsObj: Record<string, string> = {};
    this.customColors.forEach((color, className) => {
      colorsObj[className] = color;
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(colorsObj));
  }

  // Cargar colores desde localStorage
  private loadColorsFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const colorsObj = JSON.parse(stored);
        Object.entries(colorsObj).forEach(([className, color]) => {
          this.customColors.set(className, color as string);
        });
      } catch (error) {
        console.error('Error loading custom colors from storage:', error);
      }
    }
  }
}
