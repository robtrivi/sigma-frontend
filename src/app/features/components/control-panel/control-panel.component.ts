import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassType, MonthFilter } from '../../models/visualization.models';
import { SegmentFeature, Region } from '../../models/api.models';
import { RegionsService } from '../../services/regions.service';
import { TiffValidationService, TiffValidationResult } from '../../services/tiff-validation.service';

export interface SceneUploadData {
  file: File;
  captureDate: string;
  epsg: number;
  sensor: string;
  regionId: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent implements OnInit {
  @Input({ required: true }) uploadedFile: string = '';
  @Input({ required: true }) hoveredFeature: SegmentFeature | null = null;
  @Input({ required: true }) months: MonthFilter[] = [];
  @Input({ required: true }) classTypes: ClassType[] = [];
  @Input() isLoading: boolean = false;
  @Input() canRunSegmentation: boolean = false;

  @Output() sceneUpload = new EventEmitter<SceneUploadData>();
  @Output() runSegmentation = new EventEmitter<void>();
  @Output() monthFilterChange = new EventEmitter<void>();
  @Output() classFilterChange = new EventEmitter<void>();

  selectedFile: File | null = null;
  captureDate: string = '';
  epsg: number = 32717;
  sensor: string = 'drone_dji_phantom';
  regionId: string = '';
  regions: Region[] = [];
  regionsLoading: boolean = true;
  regionsError: string | null = null;

  // Validación TIFF
  tiffValidating: boolean = false;
  tiffValidationResult: TiffValidationResult | null = null;
  tiffValidationError: string | null = null;
  showTiffInfo: boolean = false;

  constructor(
    private regionsService: RegionsService,
    private tiffValidationService: TiffValidationService
  ) {}

  ngOnInit(): void {
    this.loadRegions();
  }

  private loadRegions(): void {
    this.regionsLoading = true;
    this.regionsError = null;
    this.regionsService.getRegions().subscribe({
      next: (regions) => {
        this.regions = regions;
        this.regionsLoading = false;
        if (regions.length > 0) {
          this.regionId = regions[0].id;
        } else {
          this.regionsError = 'No hay regiones disponibles';
        }
      },
      error: (err) => {
        this.regionsLoading = false;
        this.regionsError = `Error cargando regiones: ${err.message}`;
        console.error('Error cargando regiones:', err);
      }
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.tiffValidationError = null;
      this.tiffValidationResult = null;
      this.showTiffInfo = false;

      // Validar TIFF automáticamente
      this.validateSelectedTiff();

      // Auto-llenar fecha si no está establecida
      if (!this.captureDate) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        this.captureDate = `${year}-${month}-${day}`;
      }
    }
  }

  validateSelectedTiff(): void {
    if (!this.selectedFile) return;

    this.tiffValidating = true;
    this.tiffValidationError = null;

    this.tiffValidationService.validateTiff(this.selectedFile, this.epsg).subscribe({
      next: (result) => {
        this.tiffValidationResult = result;
        this.tiffValidating = false;

        // Solo mostrar error si la validación falló, no por advertencias
        if (!result.valid) {
          this.tiffValidationError = 'El TIFF no es válido. Revisa las advertencias arriba.';
        } else {
          // TIFF válido - limpiar error aunque haya advertencias
          this.tiffValidationError = null;
        }

        // Auto-llenar EPSG si está disponible en el TIFF
        if (result.epsgCode && result.epsgCode !== this.epsg) {
          this.epsg = result.epsgCode;
        }
      },
      error: (err) => {
        this.tiffValidating = false;
        this.tiffValidationError = 'Error validando TIFF: ' + (err.error?.detail || err.message);
      }
    });
  }

  toggleTiffInfo(): void {
    this.showTiffInfo = !this.showTiffInfo;
  }

  onUploadScene(): void {
    console.log('🎬 onUploadScene INICIADO EN CONTROL PANEL');
    
    if (!this.selectedFile) {
      console.error('❌ No se ha seleccionado archivo');
      return;
    }

    console.log('📄 selectedFile:', this.selectedFile.name);

    // Validar que TIFF sea válido
    if (this.tiffValidationResult && !this.tiffValidationResult.valid) {
      console.error('❌ TIFF inválido según validación');
      alert('No se puede cargar un TIFF inválido. Revisa las advertencias arriba.');
      return;
    }

    if (!this.captureDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      this.captureDate = `${year}-${month}-${day}`;
    }

    console.log('📤 Emitiendo sceneUpload con data:', {
      file: this.selectedFile.name,
      captureDate: this.captureDate,
      epsg: this.epsg,
      sensor: this.sensor,
      regionId: this.regionId
    });

    this.sceneUpload.emit({
      file: this.selectedFile,
      captureDate: this.captureDate,
      epsg: this.epsg,
      sensor: this.sensor,
      regionId: this.regionId
    });

    console.log('✅ sceneUpload EMITIDO');
  }

  get canUpload(): boolean {
    return (
      !!this.selectedFile &&
      !this.isLoading &&
      !this.tiffValidating &&
      (!this.tiffValidationResult || this.tiffValidationResult.valid)
    );
  }

  onRunSegmentation(): void {
    this.runSegmentation.emit();
  }

  notifyMonthChange(): void {
    this.monthFilterChange.emit();
  }

  toggleMonth(selectedMonth: MonthFilter): void {
    const selectedCount = this.months.filter(m => m.selected).length;
    
    // Si es el único seleccionado y intenta deseleccionarlo, no lo permite
    if (selectedMonth.selected && selectedCount === 1) {
      return;
    }
    
    selectedMonth.selected = !selectedMonth.selected;
    this.monthFilterChange.emit();
  }

  isMonthDisabled(month: MonthFilter): boolean {
    // Desabilitar si es el único seleccionado
    return month.selected && this.months.filter(m => m.selected).length === 1;
  }

  notifyClassChange(): void {
    this.classFilterChange.emit();
  }
}
