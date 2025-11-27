import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';

export interface PageHeaderAction {
  label: string;
  icon?: string;
  command: () => void;
  styleClass?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, BreadcrumbModule, ButtonModule],
  template: `
    <div class="page-header">
      <div class="page-header-content">
        <div class="page-header-info">
          <h2 class="page-title">{{ title }}</h2>
          @if (subtitle) {
            <p class="page-subtitle">{{ subtitle }}</p>
          }
          @if (breadcrumbs && breadcrumbs.length > 0) {
            <p-breadcrumb [model]="breadcrumbs" [home]="{ icon: 'pi pi-home', routerLink: '/' }"></p-breadcrumb>
          }
        </div>
        @if (actions && actions.length > 0) {
          <div class="page-header-actions">
            @for (action of actions; track action.label) {
              <button 
                pButton 
                [label]="action.label" 
                [icon]="action.icon || ''"
                [class]="action.styleClass || 'p-button-success'"
                (click)="action.command()">
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      background-color: white;
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .page-header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .page-header-info {
      flex: 1;
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--sigma-primary);
      margin: 0 0 0.5rem 0;
    }

    .page-subtitle {
      font-size: 0.938rem;
      color: var(--sigma-text-secondary);
      margin: 0 0 1rem 0;
    }

    .page-header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    @media (max-width: 768px) {
      .page-header-content {
        flex-direction: column;
      }

      .page-header-actions {
        width: 100%;
      }

      .page-header-actions button {
        flex: 1;
      }
    }
  `]
})
export class PageHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle?: string;
  @Input() breadcrumbs?: Array<{ label: string; routerLink?: string }> = [];
  @Input() actions?: PageHeaderAction[] = [];
}
