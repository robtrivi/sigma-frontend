export interface MapCell {
  id: string;
  name: string;
  type: 'green' | 'building' | 'street' | 'parking' | 'water';
  area: number;
  row: number;
  col: number;
  selected: boolean;
  hovered: boolean;
}

export interface MapLegend {
  type: string;
  label: string;
  color: string;
  count: number;
}

export interface SubRegion {
  id: string;
  name: string;
  cells: string[];
  totalArea: number;
  greenCoverage: number;
}
