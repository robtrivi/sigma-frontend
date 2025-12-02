import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-download-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-modal.component.html',
  styleUrl: './download-modal.component.scss'
})
export class DownloadModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<{ format: string; content: string[]; region: string }>();

  // Form state
  selectedFormat: 'pdf' | 'csv' = 'pdf';
  selectedContent: { [key: string]: boolean } = {
    map: true,
    stats: true,
    classes: true,
    metadata: false,
    comparison: false,
    recommendations: false
  };
  selectedRegion: 'full' | 'subregion' | 'green-only' = 'full';

  onFormatChange(format: 'pdf' | 'csv'): void {
    this.selectedFormat = format;
  }

  onContentToggle(key: string): void {
    this.selectedContent[key] = !this.selectedContent[key];
  }

  onRegionChange(region: 'full' | 'subregion' | 'green-only'): void {
    this.selectedRegion = region;
  }

  getSelectedContentCount(): number {
    return Object.values(this.selectedContent).filter(v => v).length;
  }

  getEstimatedSize(): string {
    const baseSize = 3; // MB
    const count = this.getSelectedContentCount();
    const multiplier = 1 + (count * 0.5);
    return `~${Math.round(baseSize * multiplier)} MB`;
  }

  getRegionLabel(): string {
    switch (this.selectedRegion) {
      case 'full':
        return 'Campus Completo';
      case 'subregion':
        return 'Subregión Personalizada';
      case 'green-only':
        return 'Solo Áreas Verdes';
      default:
        return 'Campus Completo';
    }
  }

  getFormatLabel(): string {
    return this.selectedFormat === 'pdf' ? 'PDF' : 'CSV';
  }

  onDownload(): void {
    const selectedContent = Object.keys(this.selectedContent).filter(
      key => this.selectedContent[key]
    );

    this.download.emit({
      format: this.selectedFormat,
      content: selectedContent,
      region: this.selectedRegion
    });

    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }
}

