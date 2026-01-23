import { Injectable } from '@angular/core';
import { COVERAGE_CATEGORIES } from '../models/coverage-categories';

export interface ClassColor {
  className: string;
  customColor: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClassColorService {
  private readonly customColors: Map<string, string> = new Map();
  private readonly categoryColors: Map<string, string> = new Map();
  private readonly STORAGE_KEY = 'sigma_class_colors';
  private readonly CATEGORY_STORAGE_KEY = 'sigma_category_colors';

  constructor() {
    this.loadColorsFromStorage();
    this.loadCategoryColorsFromStorage();
  }

  // ============== MÉTODOS PARA COLORES DE CLASES ==============

  // Obtener color personalizado para una clase
  getColor(className: string): string | null {
    const color = this.customColors.get(className) || null;
    return color;
  }

  // Establecer color personalizado para una clase
  setColor(className: string, color: string): void {
    this.customColors.set(className, color);
    this.saveColorsToStorage();
  }

  // Obtener todos los colores personalizados de clases
  getAllColors(): Map<string, string> {
    return new Map(this.customColors);
  }

  // Limpiar todos los colores personalizados de clases
  clearAllColors(): void {
    this.customColors.clear();
    this.saveColorsToStorage();
  }

  // ============== MÉTODOS PARA COLORES DE CATEGORÍAS ==============

  // Obtener color personalizado para una categoría
  getCategoryColor(categoryName: string): string | null {
    const color = this.categoryColors.get(categoryName) || null;
    return color;
  }

  // Establecer color personalizado para una categoría
  setCategoryColor(categoryName: string, color: string): void {
    this.categoryColors.set(categoryName, color);
    this.saveCategoryColorsToStorage();
  }

  // Obtener todos los colores de categorías
  getAllCategoryColors(): Map<string, string> {
    return new Map(this.categoryColors);
  }

  // ============== MÉTODOS PARA RENDERIZADO EN MODO CATEGORÍAS ==============

  // Obtener colores mapeados para clases en modo categorías
  // Si estamos en modo categorías, devuelve los colores de categoría mapeados a sus clases
  // Si estamos en modo clases, devuelve los colores de clases individuales
  getColorsForRendering(viewMode: 'classes' | 'categories'): Map<string, string> {
    if (viewMode === 'categories') {
      // Crear un mapa temporal clase→color usando colores de categoría
      const classColorMap = new Map<string, string>();
      
      for (const category of COVERAGE_CATEGORIES) {
        // Obtener el color de la categoría (personalizado o default)
        const categoryColor = this.categoryColors.get(category.name) || category.color;
        
        // Mapear cada clase de esta categoría al color de la categoría
        for (const className of category.classes) {
          classColorMap.set(className, categoryColor);
        }
      }
      
      return classColorMap;
    } else {
      // Modo clases: devolver colores individuales de clases
      return new Map(this.customColors);
    }
  }

  // ============== MÉTODOS DE PERSISTENCIA ==============

  // Guardar colores de clases en localStorage
  private saveColorsToStorage(): void {
    const colorsObj: Record<string, string> = {};
    for (const [className, color] of this.customColors) {
      colorsObj[className] = color;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(colorsObj));
  }

  // Cargar colores de clases desde localStorage
  loadColorsFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const colorsObj = JSON.parse(stored);
        for (const [className, color] of Object.entries(colorsObj)) {
          this.customColors.set(className, color as string);
        }
      } catch (error) {
        console.error('Error loading custom colors from storage:', error);
      }
    }
  }

  // Guardar colores de categorías en localStorage
  private saveCategoryColorsToStorage(): void {
    const colorsObj: Record<string, string> = {};
    for (const [categoryName, color] of this.categoryColors) {
      colorsObj[categoryName] = color;
    }
    localStorage.setItem(this.CATEGORY_STORAGE_KEY, JSON.stringify(colorsObj));
  }

  // Cargar colores de categorías desde localStorage
  private loadCategoryColorsFromStorage(): void {
    const stored = localStorage.getItem(this.CATEGORY_STORAGE_KEY);
    if (stored) {
      try {
        const colorsObj = JSON.parse(stored);
        for (const [categoryName, color] of Object.entries(colorsObj)) {
          this.categoryColors.set(categoryName, color as string);
        }
      } catch (error) {
        console.error('Error loading category colors from storage:', error);
      }
    }
  }
}
