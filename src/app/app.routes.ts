import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/initial/initial-screen.component').then(m => m.InitialScreenComponent)
  },
  {
    path: 'visualization',
    loadComponent: () => import('./features/visualization/visualization-sigma.component').then(m => m.VisualizationSigmaComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
