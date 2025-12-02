import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartBar, ClassDistributionStat } from '../../models/visualization.models';

@Component({
  selector: 'app-dashboard-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-panel.component.html',
  styleUrls: ['./dashboard-panel.component.scss']
})
export class DashboardPanelComponent {
  @Input({ required: true }) dashboardTitle: string = '';
  @Input({ required: true }) statLabel: string = '';
  @Input({ required: true }) visibleCellsCount: number = 0;
  @Input({ required: true }) totalCells: number = 0;
  @Input({ required: true }) coverageLabel: string = '';
  @Input({ required: true }) coveragePercentage: number = 0;
  @Input({ required: true }) classDistribution: ClassDistributionStat[] = [];
  @Input({ required: true }) chartData: ChartBar[] = [];
}
