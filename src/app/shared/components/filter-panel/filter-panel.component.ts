import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';

export interface FilterConfig {
  type: 'checkbox' | 'text';
  label: string;
  key: string;
  options?: Array<{ label: string; value: any }>;
  value?: any;
  multiple?: boolean;
}

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PanelModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule
  ],
  template: `
    <p-panel [header]="title" [toggleable]="collapsible" [collapsed]="collapsed">
      <div class="filter-panel-content">
        @for (filter of filters; track filter.key) {
          <div class="filter-item">
            <label [for]="filter.key" class="filter-label">{{ filter.label }}</label>
            
            @switch (filter.type) {
              @case ('checkbox') {
                <div class="checkbox-group">
                  @for (option of filter.options; track option.value) {
                    <div class="checkbox-item">
                      <p-checkbox
                        [inputId]="filter.key + '_' + option.value"
                        [value]="option.value"
                        [(ngModel)]="filterValues[filter.key]"
                        (onChange)="onFilterChange()"
                      />
                      <label [for]="filter.key + '_' + option.value">{{ option.label }}</label>
                    </div>
                  }
                </div>
              }
              @case ('text') {
                <input
                  pInputText
                  [id]="filter.key"
                  [(ngModel)]="filterValues[filter.key]"
                  [placeholder]="filter.label"
                  [style]="{'width':'100%'}"
                  (input)="onFilterChange()"
                />
              }
            }
          </div>
        }
      </div>
      <div class="filter-actions">
        <button pButton label="Limpiar" icon="pi pi-times" class="p-button-secondary p-button-sm" (click)="clearFilters()"></button>
        <button pButton label="Aplicar" icon="pi pi-check" class="p-button-success p-button-sm" (click)="applyFilters()"></button>
      </div>
    </p-panel>
  `,
  styles: [`
    .filter-panel-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 0.5rem 0;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--sigma-primary);
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .checkbox-item:hover {
      background-color: #f0f4eb;
    }

    .checkbox-item label {
      cursor: pointer;
      font-size: 0.875rem;
    }

    .filter-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--sigma-border);
    }
  `]
})
export class FilterPanelComponent {
  @Input() title: string = 'Filtros';
  @Input() filters: FilterConfig[] = [];
  @Input() collapsible: boolean = true;
  @Input() collapsed: boolean = false;
  @Output() filtersChange = new EventEmitter<any>();

  protected filterValues: any = {};

  ngOnInit() {
    this.initializeFilterValues();
  }

  private initializeFilterValues() {
    this.filters.forEach(filter => {
      if (filter.type === 'checkbox' && filter.multiple) {
        this.filterValues[filter.key] = filter.value || [];
      } else {
        this.filterValues[filter.key] = filter.value || null;
      }
    });
  }

  onFilterChange() {
    // Emit on each change for real-time filtering
  }

  applyFilters() {
    this.filtersChange.emit(this.filterValues);
  }

  clearFilters() {
    this.initializeFilterValues();
    this.filtersChange.emit(this.filterValues);
  }
}
