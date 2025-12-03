export interface ClassConfig {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const CLASS_CATALOG: ClassConfig[] = [
  { id: 'obstaculos', name: 'Obstáculos', color: '#FF5722', icon: 'pi-ban' },
  { id: 'agua', name: 'Agua', color: '#2196F3', icon: 'pi-inbox' },
  { id: 'superficies_blandas', name: 'Superficies Blandas', color: '#4CAF50', icon: 'pi-sun' },
  { id: 'objetos_en_movimiento', name: 'Objetos en Movimiento', color: '#FFC107', icon: 'pi-car' },
  { id: 'zonas_aterrizables', name: 'Zonas Aterrizables', color: '#8BC34A', icon: 'pi-map-marker' }
];

export function getClassConfig(classId: string): ClassConfig {
  return CLASS_CATALOG.find(c => c.id === classId) || {
    id: classId,
    name: classId,
    color: '#999999',
    icon: 'pi-circle'
  };
}

export function getClassColor(classId: string): string {
  return getClassConfig(classId).color;
}

export function getClassName(classId: string): string {
  return getClassConfig(classId).name;
}
