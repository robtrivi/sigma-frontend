import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { LayoutService } from '../../../services/layout.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, MenubarModule, AvatarModule],
  template: `
    <header class="app-header">
      <div class="header-left">
        <button 
          pButton 
          icon="pi pi-bars" 
          class="p-button-text p-button-rounded"
          (click)="toggleSidebar()"
          [attr.aria-label]="'Toggle Menu'">
        </button>
        <div class="header-title">
          <h1>🌱 {{ layoutService.getPageTitle()() }}</h1>
          <p class="subtitle">{{ layoutService.getPageSubtitle()() }}</p>
        </div>
      </div>
      <div class="header-right">
        <button 
          pButton 
          icon="pi pi-bell" 
          class="p-button-text p-button-rounded"
          [attr.aria-label]="'Notifications'">
        </button>
        <button 
          pButton 
          icon="pi pi-question-circle" 
          class="p-button-text p-button-rounded"
          [attr.aria-label]="'Help'">
        </button>
        <p-avatar 
          label="U" 
          shape="circle" 
          [style]="{'background-color':'var(--sigma-primary)', 'color': '#ffffff'}">
        </p-avatar>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      background: linear-gradient(135deg, #2d5016 0%, #4a7c2c 100%);
      color: white;
      padding: 1rem 1.5rem;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-title h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
    }

    .header-title .subtitle {
      font-size: 0.813rem;
      opacity: 0.9;
      margin: 0.25rem 0 0 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    :host ::ng-deep .p-button-text {
      color: white;
    }

    :host ::ng-deep .p-button-text:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    @media (max-width: 768px) {
      .header-title h1 {
        font-size: 1.25rem;
      }
      
      .header-title .subtitle {
        display: none;
      }
    }
  `]
})
export class HeaderComponent {
  protected layoutService = inject(LayoutService);

  toggleSidebar() {
    this.layoutService.toggleSidebar();
  }
}
