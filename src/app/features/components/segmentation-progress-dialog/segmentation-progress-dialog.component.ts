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
  private initialStepAdded = false; // ✅ Flag to track if initial step was added
  private initialStep: ProgressStep | null = null; // ✅ Store the initial step to keep it always

  progressPercentage = computed(() => {
    const prog = this.progress();
    if (!prog || prog.totalSteps === 0) return 0;
    
    // Contar cuántos pasos están completados
    const completedSteps = prog.steps.filter(step => step.status === 'completed').length;
    
    // Si está completado, mostrar 100%
    if (prog.status === 'completed') {
      return 100;
    }
    
    // Mostrar el porcentaje basado en pasos completados
    // Esto refleja el progreso real de lo que ya se ha terminado
    return (completedSteps / prog.totalSteps) * 100;
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
        // Get the current progress state
        const currentProgress = this.progress();
        const totalStepsFromCurrentProgress = currentProgress?.totalSteps || data.totalSteps;
        
        // If we haven't added the initial step yet
        if (!this.initialStepAdded && currentProgress && 
            currentProgress.steps.length === 1 && 
            currentProgress.steps[0].name === 'Conectando al servidor') {
          
          // Store the initial step (keep as in-progress for now)
          this.initialStep = { ...currentProgress.steps[0] };
          
          // Mark that we've added the initial step
          this.initialStepAdded = true;
          
          // Combine: initial step + backend steps
          const combinedSteps = [this.initialStep, ...data.steps];
          
          // Update progress with combined steps and keep the totalSteps from current progress
          this.progress.set({
            ...data,
            currentStep: data.currentStep, // Keep backend's currentStep as is (0-indexed, relative to backend steps)
            steps: combinedSteps,
            totalSteps: totalStepsFromCurrentProgress
          });
        } else if (this.initialStepAdded && this.initialStep) {
          // If we already have an initial step, always prepend it to the backend steps
          const combinedSteps = [this.initialStep, ...data.steps];
          
          // Mark the initial step as completed when a backend step becomes in-progress or completed
          const hasBackendStepStarted = data.steps.some(step => step.status === 'in-progress' || step.status === 'completed');
          if (hasBackendStepStarted && this.initialStep.status !== 'completed') {
            this.initialStep.status = 'completed';
            this.initialStep.message = 'Conexión establecida';
            combinedSteps[0] = this.initialStep;
          }
          
          this.progress.set({
            ...data,
            currentStep: data.currentStep + 1, // Adjust currentStep to account for the initial step
            steps: combinedSteps,
            totalSteps: totalStepsFromCurrentProgress
          });
        } else {
          // Normal case - just set the data as is (no initial step was added)
          this.progress.set(data);
        }
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
    const isNewScene = this.sceneId() !== sceneId;
    
    this.sceneId.set(sceneId);
    
    // Only reset elapsed time if it's a new scene
    if (isNewScene) {
      this.elapsedSeconds.set(0);
      this.stopTimer();
      this.startTimer();
    } else {
      // Ensure timer is running if it's the same scene
      if (!this.timerInterval) {
        this.startTimer();
      }
    }
    
    this.isCompleted = false; // ✅ Reset completion flag
    this.initialStepAdded = false; // ✅ Reset initial step flag
    this.initialStep = null; // ✅ Reset initial step storage
    
    // Set initial progress state with a connecting step
    this.progress.set({
      sceneId: sceneId,
      status: 'in-progress',
      currentStep: 0,
      totalSteps: 7, // 1 initial step + 6 backend steps
      steps: [
        {
          name: 'Conectando al servidor',
          status: 'in-progress',
          message: 'Estableciendo conexión con el servidor...',
          timestamp: new Date().toISOString(),
          error: ''
        }
      ],
      errorMessage: '',
      result: null
    });
    
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
