import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatDate',
  standalone: true
})
export class FormatDatePipe implements PipeTransform {
  transform(value: Date | string | number, format: 'short' | 'long' | 'time' = 'short'): string {
    if (!value) return '';

    const date = new Date(value);
    
    if (isNaN(date.getTime())) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    switch (format) {
      case 'short':
        return `${day}/${month}/${year}`;
      case 'long':
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return `${day} de ${monthNames[date.getMonth()]} de ${year}`;
      case 'time':
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      default:
        return `${day}/${month}/${year}`;
    }
  }
}
