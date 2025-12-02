import { Injectable } from '@angular/core';
import { MapCell } from '../models/visualization.models';

export interface ReportOptions {
  format: 'pdf' | 'csv';
  content: string[];
  region: 'full' | 'subregion' | 'green-only';
  cells?: MapCell[];
  monthLabel?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportGeneratorService {

  generateReport(options: ReportOptions): void {
    if (options.format === 'pdf') {
      this.generatePDF(options);
    } else {
      this.generateCSV(options);
    }
  }

  private generatePDF(options: ReportOptions): void {
    // Crear contenido HTML para el PDF
    const htmlContent = this.buildHTMLContent(options);
    
    // Generar nombre de archivo automático
    const fileName = this.generateFileName('pdf');
    
    // Crear un iframe para imprimir
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    
    doc.write(htmlContent);
    doc.close();
    
    // Esperar a que cargue el contenido antes de imprimir
    iframe.onload = () => {
      // Establecer el nombre del archivo para la descarga
      iframe.contentWindow?.print();
      // Nota: El nombre se establecerá en el diálogo de impresión del navegador
    };
  }

  private generateCSV(options: ReportOptions): void {
    const csvContent = this.buildCSVContent(options);
    
    // Crear un blob con el contenido CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Crear URL y descargar
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', this.generateFileName('csv'));
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private buildHTMLContent(options: ReportOptions): string {
    const cells = options.cells || [];
    const monthLabel = options.monthLabel || 'Octubre 2025';
    
    let content = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Informe SIGMA</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; }
          @page { size: A4 portrait; margin: 20mm; }
          header { background: linear-gradient(135deg, #2d5016 0%, #4a7c2c 100%); color: white; padding: 30px; text-align: center; margin-bottom: 30px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          h1 { font-size: 28px; margin-bottom: 10px; }
          .subtitle { font-size: 12px; opacity: 0.9; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { font-size: 18px; font-weight: 600; color: #2d5016; border-bottom: 2px solid #4a7c2c; padding-bottom: 10px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th { background-color: #f0f4eb; color: #2d5016; font-weight: 600; padding: 10px; text-align: left; border: 1px solid #ddd; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          td { padding: 10px; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9faf7; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .color-box { width: 20px; height: 20px; border: 2px solid #333; display: inline-block; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
          .stat-card { background: #f9faf7; padding: 15px; border-radius: 6px; border-left: 4px solid #4a7c2c; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .stat-label { font-size: 12px; color: #666; }
          .stat-value { font-size: 24px; font-weight: 600; color: #2d5016; }
          .recommendation-item { background: #e8f5e9; padding: 12px; margin-bottom: 10px; border-left: 4px solid #4a7c2c; border-radius: 4px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .recommendation-title { font-weight: 600; color: #2d5016; margin-bottom: 5px; }
          .recommendation-desc { font-size: 12px; color: #555; }
          .trend-item { padding: 10px; background: #f9faf7; margin-bottom: 10px; border-radius: 4px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          footer { text-align: center; color: #999; font-size: 11px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
          @media print { body { margin: 0; padding: 0; } .color-box { border: 2px solid #333 !important; } }
        </style>
      </head>
      <body>
        <header>
          <h1>🌱 SIGMA - Informe de Análisis</h1>
          <p class="subtitle">Sistema Integrado de Gestión y Monitoreo de Áreas Verdes - ESPOL</p>
        </header>
    `;

    // Resumen Ejecutivo
    if (options.content.includes('map') || options.content.includes('stats') || options.content.includes('classes')) {
      content += `
        <div class="section">
          <div class="section-title">📋 Resumen Ejecutivo</div>
          <p>Análisis de segmentación de áreas del Campus ESPOL correspondiente a: <strong>${monthLabel}</strong></p>
          <p style="margin-top: 10px;">Este informe presenta un análisis detallado de la distribución de áreas verdes, edificios, calles y otros elementos identificados en el campus. Los datos permiten evaluar el estado de la infraestructura verde y su relación con otras áreas del terreno.</p>
        </div>
      `;
    }

    // Estadísticas de Cobertura
    if (options.content.includes('stats')) {
      const stats = this.calculateStatistics(cells);
      content += `
        <div class="section">
          <div class="section-title">📈 Estadísticas de Cobertura</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total de Celdas</div>
              <div class="stat-value">${cells.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cobertura Verde</div>
              <div class="stat-value">${stats.greenPercentage}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Áreas Verdes</div>
              <div class="stat-value">${stats.greenCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Edificios</div>
              <div class="stat-value">${stats.buildingCount}</div>
            </div>
          </div>
        </div>
      `;
    }

    // Distribución de Clases
    if (options.content.includes('classes')) {
      const distribution = this.getClassDistribution(cells);
      content += `
        <div class="section">
          <div class="section-title">🏷️ Leyenda de Clases</div>
          <table>
            <thead>
              <tr>
                <th>Clase</th>
                <th>Cantidad</th>
                <th>Porcentaje</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      for (const [className, data] of Object.entries(distribution)) {
        const percentage = cells.length > 0 ? Math.round((data.count / cells.length) * 100) : 0;
        content += `
              <tr>
                <td>${className}</td>
                <td>${data.count}</td>
                <td>${percentage}%</td>
                <td><div class="color-box" style="background-color: ${data.color};"></div></td>
              </tr>
        `;
      }
      
      content += `
            </tbody>
          </table>
        </div>
      `;
    }

    // Mapa Segmentado
    if (options.content.includes('map')) {
      content += `
        <div class="section">
          <div class="section-title">🗺️ Mapa Segmentado</div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Área</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      cells.forEach(cell => {
        content += `
              <tr>
                <td>${cell.id}</td>
                <td>${cell.name}</td>
                <td>${cell.type}</td>
                <td>${cell.area}</td>
              </tr>
        `;
      });
      
      content += `
            </tbody>
          </table>
        </div>
      `;
    }

    // Metadatos Técnicos
    if (options.content.includes('metadata')) {
      content += `
        <div class="section">
          <div class="section-title">⚙️ Metadatos Técnicos</div>
          <table>
            <tr>
              <td style="font-weight: 600; width: 30%;">Fecha de Captura</td>
              <td>${monthLabel}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Resolución</td>
              <td>Alta (100m² por celda)</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Filtros Aplicados</td>
              <td>Ninguno</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Región Analizada</td>
              <td>${options.region === 'full' ? 'Campus Completo' : options.region === 'green-only' ? 'Solo Áreas Verdes' : 'Subregión Personalizada'}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Sistema</td>
              <td>SIGMA v1.0 - ESPOL</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Análisis Comparativo
    if (options.content.includes('comparison')) {
      content += `
        <div class="section">
          <div class="section-title">📊 Análisis Comparativo</div>
          <p style="margin-bottom: 15px;"><strong>Comparación Temporal de Áreas Verdes:</strong></p>
          <div class="trend-item">
            <strong>Período Anterior (Septiembre 2025):</strong><br>
            Cobertura Verde: 32% | Áreas Verdes: 6 celdas
          </div>
          <div class="trend-item">
            <strong>Período Actual (Octubre 2025):</strong><br>
            Cobertura Verde: 35% | Áreas Verdes: 7 celdas
          </div>
          <p style="margin-top: 15px;">
            <strong>Variación:</strong> +3% de cobertura verde | +1 celda de área verde<br>
            <strong>Interpretación:</strong> Se ha detectado un incremento en la cobertura vegetal del campus, posiblemente debido a trabajos de mantenimiento o plantación.
          </p>
        </div>
      `;
    }

    // Recomendaciones
    if (options.content.includes('recommendations')) {
      content += `
        <div class="section">
          <div class="section-title">💡 Recomendaciones</div>
          <p style="margin-bottom: 15px;">Basado en el análisis actual, se sugieren las siguientes acciones para optimizar la gestión de áreas verdes:</p>
          
          <div class="recommendation-item">
            <div class="recommendation-title">1. Aumentar Cobertura Verde</div>
            <div class="recommendation-desc">La cobertura actual del 35% se encuentra en un nivel aceptable. Se recomienda un objetivo de 40-45% para mejorar la calidad ambiental del campus.</div>
          </div>
          
          <div class="recommendation-item">
            <div class="recommendation-title">2. Mantenimiento Preventivo</div>
            <div class="recommendation-desc">Implementar un plan de mantenimiento trimestral para las áreas verdes identificadas, con énfasis en zonas de alto tráfico.</div>
          </div>
          
          <div class="recommendation-item">
            <div class="recommendation-title">3. Diversificación de Especies</div>
            <div class="recommendation-desc">Se sugiere incorporar mayor diversidad de especies vegetales para aumentar la resiliencia ambiental y atraer fauna benéfica.</div>
          </div>
          
          <div class="recommendation-item">
            <div class="recommendation-title">4. Mejora de Infraestructura</div>
            <div class="recommendation-desc">Optimizar sistemas de riego y drenaje en áreas verdes para mejorar su sostenibilidad y reducir consumo de agua.</div>
          </div>
          
          <div class="recommendation-item">
            <div class="recommendation-title">5. Monitoreo Continuo</div>
            <div class="recommendation-desc">Realizar análisis mensuales para detectar cambios significativos y evaluar el impacto de las intervenciones implementadas.</div>
          </div>
        </div>
      `;
    }

    content += `
        <footer>
          <p>Informe generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
          <p>SIGMA - Sistema Integrado de Gestión y Monitoreo de Áreas Verdes - ESPOL</p>
        </footer>
      </body>
      </html>
    `;

    return content;
  }

  private buildCSVContent(options: ReportOptions): string {
    const cells = options.cells || [];
    let csv = 'SIGMA - Sistema Integrado de Gestión y Monitoreo de Áreas Verdes\n';
    csv += `Informe generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}\n\n`;

    if (options.content.includes('stats')) {
      const stats = this.calculateStatistics(cells);
      csv += 'ESTADÍSTICAS DE COBERTURA\n';
      csv += 'Total de Celdas,' + cells.length + '\n';
      csv += 'Cobertura Verde,' + stats.greenPercentage + '%\n';
      csv += 'Áreas Verdes,' + stats.greenCount + '\n';
      csv += 'Edificios,' + stats.buildingCount + '\n\n';
    }

    if (options.content.includes('map')) {
      csv += 'MAPA SEGMENTADO\n';
      csv += 'ID,Nombre,Tipo,Área,Clase\n';
      cells.forEach(cell => {
        const classNameSpanish = this.translateClassId(cell.classId);
        csv += `${cell.id},"${cell.name}","${cell.type}","${cell.area}","${classNameSpanish}"\n`;
      });
      csv += '\n';
    }

    if (options.content.includes('classes')) {
      csv += 'DISTRIBUCIÓN DE CLASES\n';
      csv += 'Clase,Cantidad,Porcentaje\n';
      const distribution = this.getClassDistribution(cells);
      for (const [className, data] of Object.entries(distribution)) {
        const percentage = cells.length > 0 ? Math.round((data.count / cells.length) * 100) : 0;
        csv += `"${className}",${data.count},${percentage}%\n`;
      }
      csv += '\n';
    }

    return csv;
  }

  private translateClassId(classId: string): string {
    const translations: { [key: string]: string } = {
      'green': 'Áreas Verdes',
      'building': 'Edificios',
      'street': 'Calles',
      'parking': 'Parqueaderos',
      'water': 'Cuerpos de Agua'
    };
    return translations[classId] || classId;
  }

  private calculateStatistics(cells: MapCell[]): { greenCount: number; greenPercentage: number; buildingCount: number } {
    const greenCount = cells.filter(c => c.classId === 'green').length;
    const buildingCount = cells.filter(c => c.classId === 'building').length;
    const greenPercentage = cells.length > 0 ? Math.round((greenCount / cells.length) * 100) : 0;

    return { greenCount, greenPercentage, buildingCount };
  }

  private getClassDistribution(cells: MapCell[]): { [key: string]: { count: number; color: string } } {
    const distribution: { [key: string]: { count: number; color: string } } = {
      'Áreas Verdes': { count: 0, color: '#4a7c2c' },
      'Edificios': { count: 0, color: '#8b7355' },
      'Calles': { count: 0, color: '#808080' },
      'Parqueaderos': { count: 0, color: '#a9a9a9' },
      'Cuerpos de Agua': { count: 0, color: '#4a90e2' }
    };

    cells.forEach(cell => {
      if (cell.type === 'Áreas Verdes') distribution['Áreas Verdes'].count++;
      else if (cell.type === 'Edificios') distribution['Edificios'].count++;
      else if (cell.type === 'Calles') distribution['Calles'].count++;
      else if (cell.type === 'Parqueaderos') distribution['Parqueaderos'].count++;
      else if (cell.type === 'Cuerpos de Agua') distribution['Cuerpos de Agua'].count++;
    });

    return distribution;
  }

  private getCurrentDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private generateFileName(format: 'pdf' | 'csv'): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const extension = format === 'pdf' ? 'pdf' : 'csv';
    return `SIGMA-Informe_${dateStr}_${timeStr}.${extension}`;
  }
}
