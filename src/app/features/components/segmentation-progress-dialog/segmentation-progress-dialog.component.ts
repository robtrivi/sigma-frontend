import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../../environments/environment';

interface ProgressStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message: string;
  timestamp: string;
  error: string;
}

interface SegmentationProgress {
  sceneId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  steps: ProgressStep[];
  errorMessage: string;
  result: any;
}

@Component({
  selector: 'app-segmentation-progress-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './segmentation-progress-dialog.component.html',
  styleUrls: ['./segmentation-progress-dialog.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class SegmentationProgressDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() isVisible = signal(false);
  @Input() sceneId = signal<string | null>(null);
  @Output() onClose = new EventEmitter<void>();
  @Output() onVisualize = new EventEmitter<string>();

  progress = signal<SegmentationProgress | null>(null);
  elapsedSeconds = signal(0);
  private startTime: number = 0;
  private timerInterval: any = null;
  private pollingInterval: any = null;
  private pollingIntervalMs = 1000; // Poll every 1 second

  progressPercentage = computed(() => {
    const prog = this.progress();
    if (!prog) return 0;
    
    // Si está completado, mostrar 100%
    if (prog.status === 'completed') {
      return 100;
    }
    
    // Si está en error, mostrar el porcentaje del step donde falló
    if (prog.status === 'error') {
      return ((prog.currentStep + 1) / prog.totalSteps) * 100;
    }
    
    // Si está en progreso, mostrar (currentStep + 0.5) para no llegar a 100%
    // hasta que realmente termine
    return ((prog.currentStep + 0.5) / prog.totalSteps) * 100;
  });

  isLoading = computed(() => {
    const prog = this.progress();
    return prog?.status === 'in-progress' || prog?.status === 'pending';
  });

  isSuccess = computed(() => {
    const prog = this.progress();
    return prog?.status === 'completed';
  });

  isError = computed(() => {
    const prog = this.progress();
    return prog?.status === 'error';
  });

  constructor(private http: HttpClient) {
    // Effect para monitorear cambios en el progreso y detener el timer cuando se complete
    effect(() => {
      const prog = this.progress();
      if (prog && (prog.status === 'completed' || prog.status === 'error')) {
        this.stopPolling();
        this.stopTimer();
      }
    });
  }

  ngOnInit(): void {
    // Watch for visibility changes to connect/disconnect polling
  }

  ngAfterViewInit(): void {
    // Setup initial subscription when component is ready
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (!this.sceneId()) return;

    // Stop any existing polling
    this.stopPolling();

    // Initial fetch
    this.fetchProgress();

    // Then poll regularly
    this.pollingInterval = setInterval(() => {
      this.fetchProgress();
    }, this.pollingIntervalMs);
  }

  private fetchProgress(): void {
    const sceneId = this.sceneId();
    if (!sceneId) return;

    const progressUrl = `${environment.apiBaseUrl}/api/v1/imports/progress/${sceneId}`;
    
    this.http.get<SegmentationProgress>(progressUrl).subscribe({
      next: (data) => {
        console.log('[Progress] Fetched:', data);
        this.progress.set(data);
      },
      error: (error) => {
        console.error('Error fetching progress:', error);
        // Don't stop polling on error - server might be temporarily unavailable
      }
    });
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  close(): void {
    this.stopTimer();
    this.stopPolling();
    this.progress.set(null);
    this.onClose.emit();
    
    // Reload page when closing due to error
    if (this.isError()) {
      window.location.reload();
    }
  }

  visualizeMap(): void {
    const sceneId = this.sceneId();
    if (sceneId) {
      this.onVisualize.emit(sceneId);
    }
  }

  getStepIcon(step: ProgressStep): string {
    switch (step.status) {
      case 'completed':
        return '✓';
      case 'error':
        return '✕';
      case 'in-progress':
        return '⟳';
      default:
        return '○';
    }
  }

  getStepClass(step: ProgressStep): string {
    return `step-${step.status}`;
  }

  private startTimer(): void {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.elapsedSeconds.set(elapsed);
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }

  // Public method to start streaming
  startStreaming(sceneId: string): void {
    this.sceneId.set(sceneId);
    this.progress.set(null);
    this.elapsedSeconds.set(0);
    this.startTimer();
    this.startPolling();
  }
}
