import { Routes } from '@angular/router';

export const layoutRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('../../features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'segmentation',
        loadComponent: () => import('../../features/segmentation/segmentation.component').then(m => m.SegmentationComponent)
      },
      {
        path: 'visualization',
        loadComponent: () => import('../../features/visualization/visualization.component').then(m => m.VisualizationComponent)
      },
      {
        path: 'analysis',
        loadComponent: () => import('../../features/analysis/analysis.component').then(m => m.AnalysisComponent)
      }
    ]
  }
];
