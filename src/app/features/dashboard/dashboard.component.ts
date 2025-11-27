import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DashboardService } from './services/dashboard.service';
import { 
  DashboardMetrics, 
  ClassDistribution, 
  TemporalAnalysis,
  RecentActivity 
} from './models/dashboard-metrics.model';
import { FormatDatePipe } from '../../shared/pipes/format-date.pipe';
import { StatusLabelPipe } from '../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    StatCardComponent,
    CardModule,
    ChartModule,
    TableModule,
    TagModule,
    FormatDatePipe,
    StatusLabelPipe
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  protected metrics = signal<DashboardMetrics | null>(null);
  protected classDistribution = signal<ClassDistribution[]>([]);
  protected temporalAnalysis = signal<TemporalAnalysis[]>([]);
  protected recentActivities = signal<RecentActivity[]>([]);
  protected loading = signal(true);

  // Chart data
  protected distributionChartData: any;
  protected temporalChartData: any;
  protected chartOptions: any;

  ngOnInit() {
    this.loadDashboardData();
    this.initializeChartOptions();
  }

  private loadDashboardData() {
    this.loading.set(true);

    // Load metrics
    this.dashboardService.getDashboardMetrics().subscribe(data => {
      this.metrics.set(data);
    });

    // Load class distribution
    this.dashboardService.getClassDistribution().subscribe(data => {
      this.classDistribution.set(data);
      this.updateDistributionChart(data);
    });

    // Load temporal analysis
    this.dashboardService.getTemporalAnalysis().subscribe(data => {
      this.temporalAnalysis.set(data);
      this.updateTemporalChart(data);
      this.loading.set(false);
    });

    // Load recent activities
    this.dashboardService.getRecentActivities().subscribe(data => {
      this.recentActivities.set(data);
    });
  }

  private initializeChartOptions() {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        }
      }
    };
  }

  private updateDistributionChart(data: ClassDistribution[]) {
    this.distributionChartData = {
      labels: data.map(d => d.className),
      datasets: [
        {
          data: data.map(d => d.percentage),
          backgroundColor: data.map(d => d.color),
          borderWidth: 2,
          borderColor: '#fff'
        }
      ]
    };
  }

  private updateTemporalChart(data: TemporalAnalysis[]) {
    this.temporalChartData = {
      labels: data.map(d => d.month),
      datasets: [
        {
          label: 'Áreas Verdes',
          data: data.map(d => d.greenArea),
          backgroundColor: 'rgba(74, 124, 44, 0.2)',
          borderColor: '#4a7c2c',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Edificios',
          data: data.map(d => d.buildingArea),
          backgroundColor: 'rgba(139, 115, 85, 0.2)',
          borderColor: '#8b7355',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Cuerpos de Agua',
          data: data.map(d => d.waterArea),
          backgroundColor: 'rgba(74, 144, 226, 0.2)',
          borderColor: '#4a90e2',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  protected getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      upload: 'pi pi-upload',
      analysis: 'pi pi-chart-bar',
      report: 'pi pi-file-pdf'
    };
    return icons[type] || 'pi pi-info-circle';
  }

  protected getActivityColor(type: string): string {
    const colors: Record<string, string> = {
      upload: 'info',
      analysis: 'warning',
      report: 'success'
    };
    return colors[type] || 'secondary';
  }
}
