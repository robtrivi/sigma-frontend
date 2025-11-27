export interface DashboardMetrics {
  totalImages: number;
  processedImages: number;
  totalArea: number;
  greenCoverage: number;
  activeAnalyses: number;
  recentReports: number;
}

export interface ClassDistribution {
  className: string;
  area: number;
  percentage: number;
  color: string;
}

export interface TemporalAnalysis {
  month: string;
  greenArea: number;
  buildingArea: number;
  waterArea: number;
}

export interface RecentActivity {
  id: string;
  type: 'upload' | 'analysis' | 'report';
  description: string;
  date: Date;
  status: 'completed' | 'processing' | 'error';
}
