export interface MapCell {
  id: number;
  name: string;
  type: string;
  classId: string;
  area: string;
  color: string;
  selected: boolean;
}

export interface MonthFilter {
  id: string;
  label: string;
  selected: boolean;
}

export interface ClassType {
  id: string;
  label: string;
  color: string;
  icon: string;
  selected: boolean;
}

export interface ClassDistributionStat {
  label: string;
  icon: string;
  percentage: number;
  gradient: string;
}

export interface ChartBar {
  label: string;
  height: number;
  gradient: string;
}
