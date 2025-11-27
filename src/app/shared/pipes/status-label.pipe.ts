import { Pipe, PipeTransform } from '@angular/core';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined;

@Pipe({
  name: 'statusLabel',
  standalone: true
})
export class StatusLabelPipe implements PipeTransform {
  transform(status: string): { label: string; severity: TagSeverity } {
    const statusMap: Record<string, { label: string; severity: TagSeverity }> = {
      'pending': { label: 'Pendiente', severity: 'warn' },
      'processing': { label: 'Procesando', severity: 'info' },
      'completed': { label: 'Completado', severity: 'success' },
      'error': { label: 'Error', severity: 'danger' },
      'active': { label: 'Activo', severity: 'success' },
      'inactive': { label: 'Inactivo', severity: 'secondary' },
      'approved': { label: 'Aprobado', severity: 'success' },
      'rejected': { label: 'Rechazado', severity: 'danger' }
    };

    return statusMap[status?.toLowerCase()] || { label: status, severity: 'secondary' };
  }
}
