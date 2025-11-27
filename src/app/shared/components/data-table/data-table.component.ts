import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

export interface ColumnConfig {
  field: string;
  header: string;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'badge' | 'actions';
  sortable?: boolean;
  width?: string;
  badgeConfig?: (value: any) => { severity: string; value: string };
}

export interface ActionConfig {
  icon: string;
  label?: string;
  command: (row: any) => void;
  styleClass?: string;
  tooltip?: string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, InputTextModule, TagModule, TooltipModule],
  template: `
    <div class="data-table-container">
      <p-table
        [value]="data"
        [columns]="columns"
        [paginator]="paginator"
        [rows]="rows"
        [totalRecords]="totalRecords"
        [loading]="loading"
        [lazy]="lazy"
        [rowsPerPageOptions]="rowsPerPageOptions"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
        [globalFilterFields]="globalFilterFields"
        [rowHover]="true"
        styleClass="p-datatable-striped"
        (onLazyLoad)="onLazyLoad($event)"
      >
        <ng-template pTemplate="caption">
          @if (showGlobalFilter) {
            <div class="table-header">
              <span class="p-input-icon-left">
                <i class="pi pi-search"></i>
                <input
                  pInputText
                  type="text"
                  (input)="onGlobalFilter($event)"
                  placeholder="Buscar..."
                />
              </span>
            </div>
          }
        </ng-template>

        <ng-template pTemplate="header" let-columns>
          <tr>
            @for (col of columns; track col.field) {
              <th [pSortableColumn]="col.sortable ? col.field : null" [style.width]="col.width">
                {{ col.header }}
                @if (col.sortable) {
                  <p-sortIcon [field]="col.field"></p-sortIcon>
                }
              </th>
            }
            @if (actions && actions.length > 0) {
              <th style="width: 150px">Acciones</th>
            }
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-rowData let-columns="columns">
          <tr>
            @for (col of columns; track col.field) {
              <td>
                @switch (col.type) {
                  @case ('badge') {
                    @if (col.badgeConfig) {
                      <p-tag 
                        [value]="col.badgeConfig(rowData[col.field]).value" 
                        [severity]="col.badgeConfig(rowData[col.field]).severity"
                      />
                    }
                  }
                  @case ('date') {
                    {{ rowData[col.field] | date: 'dd/MM/yyyy' }}
                  }
                  @case ('boolean') {
                    <i [class]="rowData[col.field] ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'"></i>
                  }
                  @default {
                    {{ rowData[col.field] }}
                  }
                }
              </td>
            }
            @if (actions && actions.length > 0) {
              <td>
                <div class="action-buttons">
                  @for (action of actions; track action.icon) {
                    <button
                      pButton
                      [icon]="action.icon"
                      [class]="action.styleClass || 'p-button-text p-button-rounded'"
                      [pTooltip]="action.tooltip || action.label"
                      (click)="action.command(rowData)"
                    ></button>
                  }
                </div>
              </td>
            }
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr>
            <td [attr.colspan]="columns.length + (actions?.length ? 1 : 0)" class="text-center">
              No se encontraron registros.
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    .data-table-container {
      background-color: white;
      border-radius: 6px;
      padding: 1rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .action-buttons {
      display: flex;
      gap: 0.25rem;
      justify-content: center;
    }

    :host ::ng-deep .p-datatable .p-datatable-thead > tr > th {
      background-color: var(--sigma-primary);
      color: white;
      font-weight: 600;
    }

    :host ::ng-deep .p-datatable .p-datatable-tbody > tr:hover {
      background-color: #f0f4eb;
    }

    :host ::ng-deep .p-paginator {
      background-color: transparent;
      border: none;
    }
  `]
})
export class DataTableComponent {
  @Input() data: any[] = [];
  @Input() columns: ColumnConfig[] = [];
  @Input() actions?: ActionConfig[] = [];
  @Input() paginator: boolean = true;
  @Input() rows: number = 10;
  @Input() totalRecords: number = 0;
  @Input() loading: boolean = false;
  @Input() lazy: boolean = false;
  @Input() rowsPerPageOptions: number[] = [5, 10, 20, 50];
  @Input() showGlobalFilter: boolean = true;
  @Input() globalFilterFields: string[] = [];

  @Output() lazyLoad = new EventEmitter<any>();
  @Output() globalFilter = new EventEmitter<any>();

  onLazyLoad(event: any) {
    this.lazyLoad.emit(event);
  }

  onGlobalFilter(event: any) {
    this.globalFilter.emit(event);
  }
}
