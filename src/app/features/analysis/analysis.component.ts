import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { FilterPanelComponent, FilterConfig } from '../../shared/components/filter-panel/filter-panel.component';
import { DataTableComponent, ColumnConfig, ActionConfig } from '../../shared/components/data-table/data-table.component';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AnalysisService } from './services/analysis.service';
import { AnalysisFilters, AnalysisResult, TemporalComparison } from './models/analysis.model';
import { FormatDatePipe } from '../../shared/pipes/format-date.pipe';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    FilterPanelComponent,
    DataTableComponent,
    CardModule,
    ChartModule,
    ButtonModule,
    ToastModule,
    FormatDatePipe
  ],
  providers: [MessageService],
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.scss']
})
export class AnalysisComponent implements OnInit {
  private analysisService = inject(AnalysisService);
  private messageService = inject(MessageService);

  protected results = signal<AnalysisResult[]>([]);
  protected temporalComparison = signal<TemporalComparison[]>([]);
  protected loading = signal(false);
  protected chartData: any;
  protected chartOptions: any;

  protected filterConfigs: FilterConfig[] = [
    {
      type: 'checkbox',
      label: 'Clases a Analizar',
      key: 'classes',
      multiple: true,
      options: [
        { label: 'Áreas Verdes', value: 'green' },
        { label: 'Edificios', value: 'building' },
        { label: 'Calles', value: 'street' },
        { label: 'Parqueaderos', value: 'parking' },
        { label: 'Cuerpos de Agua', value: 'water' }
      ],
      value: ['green', 'building', 'street', 'parking', 'water']
    },
    {
      type: 'checkbox',
      label: 'Meses a Comparar',
      key: 'months',
      multiple: true,
      options: [
        { label: 'Agosto 2025', value: 'agosto' },
        { label: 'Septiembre 2025', value: 'septiembre' },
        { label: 'Octubre 2025', value: 'octubre' }
      ],
      value: ['agosto', 'septiembre', 'octubre']
    }
  ];

  protected tableColumns: ColumnConfig[] = [
    { field: 'name', header: 'Nombre del Análisis', sortable: true },
    { field: 'date', header: 'Fecha', type: 'date', sortable: true, width: '150px' },
    { field: 'totalArea', header: 'Área Total (m²)', type: 'number', sortable: true, width: '150px' },
    { field: 'greenCoverage', header: 'Cobertura Verde (%)', type: 'number', sortable: true, width: '180px' }
  ];

  protected tableActions: ActionConfig[] = [
    {
      icon: 'pi pi-eye',
      tooltip: 'Ver Detalles',
      styleClass: 'p-button-text p-button-rounded p-button-info',
      command: (row) => this.viewDetails(row)
    },
    {
      icon: 'pi pi-download',
      tooltip: 'Descargar PDF',
      styleClass: 'p-button-text p-button-rounded p-button-success',
      command: (row) => this.downloadPDF(row)
    }
  ];

  ngOnInit() {
    this.initializeChartOptions();
    this.loadInitialData();
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
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => value.toLocaleString() + ' m²'
          }
        }
      }
    };
  }

  private loadInitialData() {
    const filters: AnalysisFilters = {
      classes: ['green', 'building', 'street', 'parking', 'water'],
      months: ['agosto', 'septiembre', 'octubre']
    };

    this.applyFilters(filters);
  }

  onFiltersChange(filters: any) {
    const analysisFilters: AnalysisFilters = {
      classes: filters.classes || [],
      months: filters.months || []
    };

    this.applyFilters(analysisFilters);
  }

  private applyFilters(filters: AnalysisFilters) {
    this.loading.set(true);

    this.analysisService.getAnalysisResults(filters).subscribe(results => {
      this.results.set(results);
      this.loading.set(false);
    });

    if (filters.months.length > 0) {
      this.analysisService.getTemporalComparison(filters.months).subscribe(comparison => {
        this.temporalComparison.set(comparison);
        this.updateChart(comparison);
      });
    }
  }

  private updateChart(comparison: TemporalComparison[]) {
    const datasets = [
      {
        label: 'Áreas Verdes',
        data: comparison.map(c => c.data.find(d => d.className === 'Áreas Verdes')?.area || 0),
        backgroundColor: 'rgba(74, 124, 44, 0.7)',
        borderColor: '#4a7c2c',
        borderWidth: 2
      },
      {
        label: 'Edificios',
        data: comparison.map(c => c.data.find(d => d.className === 'Edificios')?.area || 0),
        backgroundColor: 'rgba(139, 115, 85, 0.7)',
        borderColor: '#8b7355',
        borderWidth: 2
      },
      {
        label: 'Cuerpos de Agua',
        data: comparison.map(c => c.data.find(d => d.className === 'Cuerpos de Agua')?.area || 0),
        backgroundColor: 'rgba(74, 144, 226, 0.7)',
        borderColor: '#4a90e2',
        borderWidth: 2
      }
    ];

    this.chartData = {
      labels: comparison.map(c => c.month.charAt(0).toUpperCase() + c.month.slice(1)),
      datasets
    };
  }

  viewDetails(analysis: AnalysisResult) {
    this.messageService.add({
      severity: 'info',
      summary: 'Ver Detalles',
      detail: `Mostrando detalles de: ${analysis.name}`
    });
  }

  downloadPDF(analysis: AnalysisResult) {
    this.messageService.add({
      severity: 'success',
      summary: 'Descargando',
      detail: `Generando PDF de: ${analysis.name}`
    });

    this.analysisService.exportAnalysis(analysis.id, 'pdf').subscribe({
      next: (blob) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Descarga Completa',
          detail: 'El archivo PDF se ha descargado correctamente'
        });
      }
    });
  }
}
