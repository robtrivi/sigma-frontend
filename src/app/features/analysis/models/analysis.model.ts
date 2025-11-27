export interface AnalysisFilters {
  classes: string[];
  months: string[];
  dateRange?: { start: Date; end: Date };
  areaRange?: { min: number; max: number };
}

export interface AnalysisResult {
  id: string;
  name: string;
  date: Date;
  totalArea: number;
  greenCoverage: number;
  classDistribution: ClassData[];
}

export interface ClassData {
  className: string;
  area: number;
  percentage: number;
  color: string;
}

export interface TemporalComparison {
  month: string;
  data: ClassData[];
}
