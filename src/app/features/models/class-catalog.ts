export interface ClassConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
}

/**
 * Catálogo de las 24 clases del modelo de segmentación de imágenes aéreas.
 * Basado en el modelo de Deep Learning que clasifica píxeles en categorías.
 */
export const CLASS_CATALOG: ClassConfig[] = [
  { id: 'unlabeled', name: 'Sin etiqueta', color: '#000000', icon: 'pi-question', description: 'Sin etiqueta' },
  { id: 'paved-area', name: 'Área pavimentada', color: '#804080', icon: 'pi-map', description: 'Área pavimentada' },
  { id: 'dirt', name: 'Tierra', color: '#824C00', icon: 'pi-circle', description: 'Tierra/suelo desnudo' },
  { id: 'grass', name: 'Césped', color: '#006600', icon: 'pi-sun', description: 'Césped' },
  { id: 'gravel', name: 'Grava', color: '#706757', icon: 'pi-circle', description: 'Grava' },
  { id: 'water', name: 'Agua', color: '#1C2AA8', icon: 'pi-inbox', description: 'Agua' },
  { id: 'rocks', name: 'Rocas', color: '#30291E', icon: 'pi-circle', description: 'Rocas' },
  { id: 'pool', name: 'Piscina', color: '#003259', icon: 'pi-inbox', description: 'Piscina' },
  { id: 'vegetation', name: 'Vegetación', color: '#6B8E23', icon: 'pi-sun', description: 'Vegetación' },
  { id: 'roof', name: 'Techo', color: '#464646', icon: 'pi-home', description: 'Techo' },
  { id: 'wall', name: 'Pared', color: '#66669C', icon: 'pi-stop', description: 'Pared/muro' },
  { id: 'window', name: 'Ventana', color: '#FEE40C', icon: 'pi-stop', description: 'Ventana' },
  { id: 'door', name: 'Puerta', color: '#FE940C', icon: 'pi-sign-in', description: 'Puerta' },
  { id: 'fence', name: 'Cerca', color: '#BE9999', icon: 'pi-stop', description: 'Cerca' },
  { id: 'fence-pole', name: 'Poste de cerca', color: '#999999', icon: 'pi-stop', description: 'Poste de cerca' },
  { id: 'person', name: 'Persona', color: '#FF1660', icon: 'pi-user', description: 'Persona' },
  { id: 'dog', name: 'Perro', color: '#663300', icon: 'pi-circle', description: 'Perro' },
  { id: 'car', name: 'Automóvil', color: '#098F96', icon: 'pi-car', description: 'Automóvil' },
  { id: 'bicycle', name: 'Bicicleta', color: '#770B20', icon: 'pi-circle', description: 'Bicicleta' },
  { id: 'tree', name: 'Árbol', color: '#333300', icon: 'pi-circle', description: 'Árbol' },
  { id: 'bald-tree', name: 'Árbol sin hojas', color: '#BEFABE', icon: 'pi-circle', description: 'Árbol sin hojas' },
  { id: 'ar-marker', name: 'Marcador AR', color: '#709692', icon: 'pi-circle', description: 'Marcador AR' },
  { id: 'obstacle', name: 'Obstáculo', color: '#028773', icon: 'pi-ban', description: 'Obstáculo' },
  { id: 'conflicting', name: 'Conflicto', color: '#FF0000', icon: 'pi-exclamation-triangle', description: 'Conflicto' }
];

/**
 * Obtiene la configuración de una clase por su ID.
 * Si no se encuentra, retorna una configuración por defecto.
 */
export function getClassConfig(classId: string): ClassConfig {
  return CLASS_CATALOG.find(c => c.id === classId) || {
    id: classId,
    name: classId,
    color: '#999999',
    icon: 'pi-circle',
    description: 'Clase desconocida'
  };
}

/**
 * Obtiene el color hexadecimal de una clase.
 */
export function getClassColor(classId: string): string {
  return getClassConfig(classId).color;
}

/**
 * Obtiene el nombre legible de una clase.
 */
export function getClassName(classId: string): string {
  return getClassConfig(classId).name;
}

/**
 * Agrupa clases por categorías para mejor organización en la UI.
 */
export const CLASS_CATEGORIES = {
  superficies: ['dirt', 'gravel', 'rocks'],
  agua: ['water', 'pool'],
  areasVerdes: ['vegetation', 'grass', 'tree', 'bald-tree'],
  construccion: ['paved-area', 'roof', 'wall', 'window', 'door', 'fence', 'fence-pole'],
  objetos: ['person', 'dog', 'car', 'bicycle','obstacle'],
  otros: ['ar-marker', 'conflicting', 'unlabeled']
};
