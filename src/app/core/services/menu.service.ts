import { Injectable, signal } from '@angular/core';

export interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  items?: MenuItem[];
  badge?: string;
  badgeClass?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private menuItems = signal<MenuItem[]>([
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      route: '/dashboard'
    },
    {
      label: 'Segmentación',
      icon: 'pi pi-upload',
      route: '/segmentation'
    },
    {
      label: 'Visualización',
      icon: 'pi pi-map',
      route: '/visualization'
    },
    {
      label: 'Análisis',
      icon: 'pi pi-chart-bar',
      route: '/analysis'
    },
    {
      label: 'Reportes',
      icon: 'pi pi-file-pdf',
      route: '/reports'
    },
    {
      label: 'Configuración',
      icon: 'pi pi-cog',
      items: [
        {
          label: 'Preferencias',
          icon: 'pi pi-sliders-h',
          route: '/settings/preferences'
        },
        {
          label: 'Usuarios',
          icon: 'pi pi-users',
          route: '/settings/users'
        }
      ]
    }
  ]);

  getMenuItems() {
    return this.menuItems;
  }

  updateMenuItems(items: MenuItem[]) {
    this.menuItems.set(items);
  }
}
