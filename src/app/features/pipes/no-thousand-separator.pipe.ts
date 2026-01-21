import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe que formatea números sin separadores de miles
 * Ejemplos:
 * - 22794.77 -> '22794.77'
 * - 22794.7749 con formato '1.2-2' -> '22794.77'
 */
@Pipe({
  name: 'noThousandSeparator',
  standalone: true
})
export class NoThousandSeparatorPipe implements PipeTransform {
  transform(value: number | null | undefined, format: string = '1.2-2'): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Parsear el formato: '1.2-2' significa minDigits.minDecimals-maxDecimals
    const parts = format.match(/(\d+)\.(\d+)-(\d+)/);
    if (!parts) {
      return String(value);
    }

    const maxDecimals = parseInt(parts[3], 10);

    // Redondear el número al máximo de decimales especificado
    const multiplier = Math.pow(10, maxDecimals);
    const rounded = Math.round(value * multiplier) / multiplier;

    // Convertir a string y aplicar decimales mínimos
    let result = rounded.toFixed(maxDecimals);
    
    // Si los decimales son menos que los mínimos, no es necesario hacer nada
    // ya que toFixed() añade ceros al final
    
    return result;
  }
}
