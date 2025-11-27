import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { MenuService } from '../../../services/menu.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, PanelMenuModule],
  template: `
    <aside class="app-sidebar" [class.collapsed]="!isVisible">
      <div class="sidebar-header">
        <h2>Panel de Control</h2>
      </div>
      <div class="sidebar-content">
        <p-panelMenu 
          [model]="menuItems()" 
          [style]="{'width':'100%', 'border': 'none'}">
        </p-panelMenu>
      </div>
    </aside>
  `,
  styles: [`
    .app-sidebar {
      width: 280px;
      background-color: #ffffff;
      border-right: 1px solid #e0e0e0;
      box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
      overflow-y: auto;
      height: 100%;
    }

    .app-sidebar.collapsed {
      width: 0;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 1.25rem;
      border-bottom: 2px solid var(--sigma-primary);
      background-color: #f9faf7;
    }

    .sidebar-header h2 {
      font-size: 1rem;
      color: var(--sigma-primary);
      margin: 0;
      font-weight: 600;
    }

    .sidebar-content {
      flex: 1;
      padding: 0.5rem;
    }

    :host ::ng-deep .p-panelmenu {
      border: none;
    }

    :host ::ng-deep .p-panelmenu .p-panelmenu-header-link {
      background-color: transparent;
      border: none;
      padding: 0.75rem 1rem;
      color: var(--sigma-text-primary);
    }

    :host ::ng-deep .p-panelmenu .p-panelmenu-header-link:hover {
      background-color: #f0f4eb;
    }

    :host ::ng-deep .p-panelmenu .p-panelmenu-header-link:focus {
      box-shadow: none;
    }

    :host ::ng-deep .p-panelmenu .p-menuitem-link {
      padding: 0.75rem 1rem 0.75rem 2.5rem;
    }

    :host ::ng-deep .p-panelmenu .p-menuitem-link:hover {
      background-color: #f0f4eb;
    }

    :host ::ng-deep .p-panelmenu .p-menuitem-link.router-link-active {
      background-color: #e8f5e9;
      color: var(--sigma-primary);
      font-weight: 600;
      border-left: 3px solid var(--sigma-primary);
    }

    @media (max-width: 768px) {
      .app-sidebar {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        z-index: 999;
      }
    }
  `]
})
export class SidebarComponent {
  private menuService = inject(MenuService);
  protected menuItems = this.menuService.getMenuItems();
  protected isVisible = true;
}
