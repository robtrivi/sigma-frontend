import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private sidebarVisible = signal(true);
  private pageTitle = signal('SIGMA');
  private pageSubtitle = signal('Sistema Integrado de Gestión y Monitoreo de Áreas Verdes');
  private breadcrumbs = signal<Array<{ label: string; url?: string }>>([]);

  getSidebarVisible() {
    return this.sidebarVisible;
  }

  toggleSidebar() {
    this.sidebarVisible.update(value => !value);
  }

  setSidebarVisible(visible: boolean) {
    this.sidebarVisible.set(visible);
  }

  getPageTitle() {
    return this.pageTitle;
  }

  setPageTitle(title: string) {
    this.pageTitle.set(title);
  }

  getPageSubtitle() {
    return this.pageSubtitle;
  }

  setPageSubtitle(subtitle: string) {
    this.pageSubtitle.set(subtitle);
  }

  getBreadcrumbs() {
    return this.breadcrumbs;
  }

  setBreadcrumbs(items: Array<{ label: string; url?: string }>) {
    this.breadcrumbs.set(items);
  }
}
