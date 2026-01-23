import { Component, Input, Output, EventEmitter, signal, computed, OnDestroy, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { NoThousandSeparatorPipe } from '../../pipes/no-thousand-separator.pipe';

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
  imports: [CommonModule, NoThousandSeparatorPipe],
  templateUrl: './segmentation-progress-dialog.component.html',
  styleUrls: ['./segmentation-progress-dialog.component.scss']
})
export class SegmentationProgressDialogComponent implements OnDestroy {
  @Input() isVisible = signal(false);
  @Input() sceneId = signal<string | null>(null);
  @Output() progressClosed = new EventEmitter<void>();
  @Output() visualizeRequested = new EventEmitter<string>();

  progress = signal<SegmentationProgress | null>(null);
  elapsedSeconds = signal(0);
  private startTime: number = 0;
  private timerInterval: any = null;
  private pollingInterval: any = null;
  private pollingIntervalMs = 500; // ✅ Aggressive polling: 500ms at start (reduced from 1000ms)
  private isCompleted = false; // ✅ Flag to freeze timer when completed

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

  constructor(private readonly http: HttpClient, private readonly destroyRef: DestroyRef) {
    // Effect para monitorear cambios en el progreso y detener el timer cuando se complete
    effect(() => {
      const prog = this.progress();
      if (prog && (prog.status === 'completed' || prog.status === 'error')) {
        this.isCompleted = true; // ✅ Set flag to freeze timer
        this.stopPolling();
        this.stopTimer();
      }
    }, { injector: undefined });
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

  ngOnDestroy(): void {
    this.stopPolling();
  }

  close(): void {
    this.stopTimer();
    this.stopPolling();
    this.progress.set(null);
    this.progressClosed.emit();
    
    // Reload page when closing due to error
    if (this.isError()) {
      globalThis.location.reload();
    }
  }

  visualizeMap(): void {
    const sceneId = this.sceneId();
    if (sceneId) {
      this.visualizeRequested.emit(sceneId);
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
      // ✅ Don't update elapsed time if processing is completed
      if (!this.isCompleted) {
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.elapsedSeconds.set(elapsed);
      }
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
    this.isCompleted = false; // ✅ Reset completion flag
    this.startTimer();
    
    // ✅ Aggressive polling at start
    this.pollingIntervalMs = 500;
    this.startPolling();
    
    // ✅ Reduce polling frequency after 10 seconds
    setTimeout(() => {
      this.pollingIntervalMs = 1000;
      this.stopPolling();
      this.startPolling();
    }, 10000);
  }
}
