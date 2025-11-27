import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { LayoutService } from '../services/layout.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent],
  template: `
    <div class="app-layout">
      <app-header></app-header>
      <div class="layout-container">
        <app-sidebar></app-sidebar>
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .layout-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      background-color: var(--sigma-background);
      padding: 1.5rem;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }
    }
  `]
})
export class LayoutComponent {
  protected layoutService = inject(LayoutService);
}
