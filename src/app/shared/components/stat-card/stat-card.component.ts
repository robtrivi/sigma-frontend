import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <div class="stat-card" [ngClass]="styleClass">
      <div class="stat-card-content">
        <div class="stat-icon" [ngClass]="'stat-icon-' + color">
          <i [class]="icon"></i>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ value }}</div>
          <div class="stat-label">{{ label }}</div>
          @if (subtitle) {
            <div class="stat-subtitle">{{ subtitle }}</div>
          }
        </div>
      </div>
      @if (showTrend && trend) {
        <div class="stat-trend" [ngClass]="trend > 0 ? 'trend-up' : 'trend-down'">
          <i [class]="trend > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
          {{ trend > 0 ? '+' : '' }}{{ trend }}%
        </div>
      }
    </div>
  `,
  styles: [`
    .stat-card {
      background-color: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .stat-card-content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      flex-shrink: 0;
    }

    .stat-icon-primary {
      background: linear-gradient(135deg, #2d5016 0%, #4a7c2c 100%);
      color: white;
    }

    .stat-icon-success {
      background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
      color: white;
    }

    .stat-icon-warning {
      background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%);
      color: white;
    }

    .stat-icon-info {
      background: linear-gradient(135deg, #2196F3 0%, #42a5f5 100%);
      color: white;
    }

    .stat-icon-danger {
      background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);
      color: white;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--sigma-primary);
      line-height: 1.2;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.938rem;
      font-weight: 600;
      color: var(--sigma-text-secondary);
      margin-bottom: 0.25rem;
    }

    .stat-subtitle {
      font-size: 0.813rem;
      color: var(--sigma-text-muted);
    }

    .stat-trend {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--sigma-border);
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .stat-trend.trend-up {
      color: #4caf50;
    }

    .stat-trend.trend-down {
      color: #f44336;
    }

    @media (max-width: 768px) {
      .stat-card {
        padding: 1rem;
      }

      .stat-icon {
        width: 50px;
        height: 50px;
        font-size: 1.5rem;
      }

      .stat-value {
        font-size: 1.5rem;
      }
    }
  `]
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() subtitle?: string;
  @Input() icon: string = 'pi pi-chart-line';
  @Input() color: 'primary' | 'success' | 'warning' | 'info' | 'danger' = 'primary';
  @Input() styleClass?: string;
  @Input() showTrend: boolean = false;
  @Input() trend?: number;
}
