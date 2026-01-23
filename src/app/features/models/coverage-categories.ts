/**
 * Definición de categorías para agrupar las 23 clases de segmentación
 */

export interface CoverageCategory {
  id: string;
  name: string;
  classes: string[];
  color: string; // Color representativo de la categoría
}

export const COVERAGE_CATEGORIES: CoverageCategory[] = [
  {
    id: 'vegetation',
    name: 'Cobertura natural',
    classes: ['Césped', 'Vegetación', 'Árbol', 'Árbol sin hojas', 'Rocas', 'Tierra'],
    color: '#2D5016'
  },
  {
    id: 'infrastructure',
    name: 'Infraestructura construida',
    classes: ['Área pavimentada', 'Pared', 'Techo', 'Cerca', 'Puerta', 'Ventana', 'Poste de cerca', 'Obstáculo', 'Grava'],
    color: '#CCCCCC'
  },
  {
    id: 'water',
    name: 'Cuerpos de agua',
    classes: ['Agua', 'Piscina'],
    color: '#1C2AA8'
  },
  {
    id: 'transport',
    name: 'Transporte y movilidad',
    classes: ['Automóvil', 'Bicicleta'],
    color: '#098F96'
  },
  {
    id: 'social',
    name: 'Elementos sociales',
    classes: ['Persona', 'Perro'],
    color: '#FF1660'
  },
  {
    id: 'miscellaneous',
    name: 'Misceláneos',
    classes: ['Conflicto', 'Marcador AR'],
    color: '#D4A574'
  }
];

export interface CoverageItemByCategory {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAreaM2: number;
  percentageOfTotal: number;
  classesInCategory: Array<{
    className: string;
    areaM2: number;
    percentageOfCategory: number;
  }>;
}

export function groupCoverageByCategory(
  coverageData: any[],
  totalAreaM2: number
): CoverageItemByCategory[] {
  const categoryMap = new Map<string, CoverageItemByCategory>();

  // Inicializar categorías
  for (const category of COVERAGE_CATEGORIES) {
    categoryMap.set(category.id, {
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      totalAreaM2: 0,
      percentageOfTotal: 0,
      classesInCategory: []
    });
  }

  // Agrupar datos de cobertura
  for (const item of coverageData) {
    // Intentar obtener className con fallback a camelCase
    const className = item.class_name || item.className;
    const areaM2 = item.area_m2 || item.areaM2 || 0;

    // Saltar si no hay nombre de clase
    if (!className) {
      continue;
    }

    // Encontrar la categoría que contiene esta clase
    for (const category of COVERAGE_CATEGORIES) {
      if (category.classes.includes(className)) {
        const categoryData = categoryMap.get(category.id)!;
        categoryData.totalAreaM2 += areaM2;
        categoryData.classesInCategory.push({
          className: className,
          areaM2: areaM2,
          percentageOfCategory: 0 // Se calcula después
        });
        break;
      }
    }
  }

  // Calcular porcentajes
  const result: CoverageItemByCategory[] = [];
  for (const category of categoryMap.values()) {
    category.percentageOfTotal = (category.totalAreaM2 / (totalAreaM2 || 1)) * 100;

    // Calcular porcentaje de cada clase dentro de su categoría
    for (const item of category.classesInCategory) {
      item.percentageOfCategory = (item.areaM2 / (category.totalAreaM2 || 1)) * 100;
    }

    // Agregar TODAS las categorías, incluso las que no tienen datos (área = 0)
    result.push(category);
  }

  return result;
}

/**
 * Calcula el área de "Áreas Verdes" que incluye solo las clases específicas:
 * Vegetación, Césped, Árbol y Árbol sin Hojas
 */
export const GREEN_AREAS_CLASSES = ['Vegetación', 'Césped', 'Árbol', 'Árbol sin hojas'];

export function calculateGreenAreasMetrics(
  coverageData: any[],
  totalAreaM2: number
): { areaM2: number; percentage: number } {
  let greenAreaM2 = 0;

  for (const item of coverageData) {
    const className = item.class_name || item.className;
    const areaM2 = item.area_m2 || item.areaM2 || 0;

    if (className && GREEN_AREAS_CLASSES.includes(className)) {
      greenAreaM2 += areaM2;
    }
  }

  const percentage = totalAreaM2 > 0 ? (greenAreaM2 / totalAreaM2) * 100 : 0;

  return {
    areaM2: greenAreaM2,
    percentage: percentage
  };
}
