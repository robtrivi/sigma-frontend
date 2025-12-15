import { Injectable } from '@angular/core';
import { MapCell } from '../models/visualization.models';
import { PixelCoverageItem } from '../models/api.models';

export interface MaskData {
  sceneId?: string;
  captureDate?: string;
  imageUrl: string;
  pixelCoverageData: PixelCoverageItem[];
}

export interface ReportOptions {
  format: 'pdf' | 'csv';
  content: string[];
  region: 'full' | 'subregion' | 'green-only';
  cells?: MapCell[];
  monthLabel?: string;
  pixelCoverageData?: PixelCoverageItem[];
  filteredPixelCoverageData?: PixelCoverageItem[];
  vegetationCoveragePercentage?: number;
  vegetationAreaM2?: number;
  totalAreaM2?: number;
  maskImageUrl?: string;  // URL de la máscara actual de Leaflet (para modo individual)
  multipleMasks?: MaskData[];  // Array de máscaras para modo múltiple
  isMultipleMasks?: boolean;  // Flag indicando si es modo múltiples máscaras
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
          <h1>SIGMA - Informe de Análisis</h1>
          <p class="subtitle">Sistema Integrado de Gestión y Monitoreo de Áreas Verdes - ESPOL</p>
        </header>
    `;

    // Resumen Ejecutivo
    if (options.content.includes('map') || options.content.includes('stats') || options.content.includes('classes')) {
      content += `
        <div class="section">
          <div class="section-title">Resumen Ejecutivo</div>
          <p>Análisis de segmentación de áreas del Campus ESPOL correspondiente a: <strong>${monthLabel}</strong></p>
          <p style="margin-top: 10px;">Este informe presenta un análisis detallado de la distribución de áreas verdes, edificios, calles y otros elementos identificados en el campus. Los datos permiten evaluar el estado de la infraestructura verde y su relación con otras áreas del terreno.</p>
        </div>
      `;
    }

    // Estadísticas de Cobertura
    if (options.content.includes('stats')) {
      let statsContent = '';
      
      // Si hay datos de píxeles, usar esos; si no, usar celdas
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        const totalPixels = options.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        const vegetationArea = options.vegetationAreaM2 || 0;
        const totalArea = options.totalAreaM2 || 0;
        const greenPercentage = options.vegetationCoveragePercentage || 0;
        
        statsContent = `
        <div class="section">
          <div class="section-title">Estadísticas de Cobertura</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Área Total (m²)</div>
              <div class="stat-value">${totalArea.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cobertura Verde</div>
              <div class="stat-value">${greenPercentage.toFixed(2)}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Áreas Verdes (m²)</div>
              <div class="stat-value">${vegetationArea.toFixed(2)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total de Clases</div>
              <div class="stat-value">${options.pixelCoverageData.length}</div>
            </div>
          </div>
        </div>
        `;
      } else {
        const stats = this.calculateStatistics(cells);
        statsContent = `
        <div class="section">
          <div class="section-title">Estadísticas de Cobertura</div>
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
      
      content += statsContent;
    }

    // Distribución de Clases
    if (options.content.includes('classes')) {
      let classesContent = '';
      
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        // Usar datos filtrados (sin "Sin etiqueta") para la tabla
        const dataToDisplay = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 
          ? options.filteredPixelCoverageData 
          : options.pixelCoverageData.filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta');
        
        // Calcular área total filtrada
        const totalAreaFiltered = dataToDisplay.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
        
        // Ordenar por área descendente (igual que en el dashboard)
        const sortedData = [...dataToDisplay].sort((a, b) => (b.area_m2 || 0) - (a.area_m2 || 0));
        
        classesContent = `
        <div class="section">
          <div class="section-title">Cobertura de Área (m²)</div>
          <div style="margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #2d5016;">
              <span>Área total (m²):</span>
              <span>${totalAreaFiltered.toFixed(2)}</span>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 30px;">Color</th>
                <th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 110px;">Clase</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 60px;">Área (m²)</th>
                <th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 65px;">Cobertura (%)</th>
                <th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 140px;">Visualización</th>
              </tr>
            </thead>
            <tbody>
      `;
        
        sortedData.forEach(item => {
          const percentage = totalAreaFiltered > 0 ? ((item.area_m2 || 0) / totalAreaFiltered * 100).toFixed(2) : '0.00';
          const classColor = this.getColorForClass(item.class_name);
          classesContent += `
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 8px 4px; text-align: center;">
                  <div style="width: 20px; height: 20px; border-radius: 3px; background-color: ${classColor}; border: 1px solid #ccc; display: inline-block; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div>
                </td>
                <td style="padding: 8px 6px; font-size: 12px;">${item.class_name}</td>
                <td style="padding: 8px 4px; text-align: right; font-size: 12px;">${(item.area_m2 || 0).toFixed(2)}</td>
                <td style="padding: 8px 4px; text-align: center; font-weight: 600; color: #2d5016; font-size: 12px;">${percentage}%</td>
                <td style="padding: 8px 6px;">
                  <div style="width: 100%; height: 16px; background-color: #f0f0f0; border-radius: 2px; overflow: hidden; border: 1px solid #ddd; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                    <div style="height: 100%; width: ${percentage}%; background-color: ${classColor}; border-radius: 2px; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div>
                  </div>
                </td>
              </tr>
          `;
        });
        
        classesContent += `
            </tbody>
          </table>
        </div>
      `;
      } else {
        const distribution = this.getClassDistribution(cells);
        const totalCount = cells.length;
        classesContent = `
        <div class="section">
          <div class="section-title">Cobertura por Clase</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 30px;">Color</th>
                <th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 110px;">Clase</th>
                <th style="padding: 8px 4px; text-align: right; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 50px;">Cantidad</th>
                <th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 65px;">Cobertura (%)</th>
                <th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 140px;">Visualización</th>
              </tr>
            </thead>
            <tbody>
      `;
        
        for (const [className, data] of Object.entries(distribution)) {
          if (data.count > 0) {
            const percentage = totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0;
            classesContent += `
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 8px 4px; text-align: center;">
                  <div style="width: 20px; height: 20px; border-radius: 3px; background-color: ${data.color}; border: 1px solid #ccc; display: inline-block; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div>
                </td>
                <td style="padding: 8px 6px; font-size: 12px;">${className}</td>
                <td style="padding: 8px 4px; text-align: right; font-size: 12px;">${data.count}</td>
                <td style="padding: 8px 4px; text-align: center; font-weight: 600; color: #2d5016; font-size: 12px;">${percentage}%</td>
                <td style="padding: 8px 6px;">
                  <div style="width: 100%; height: 16px; background-color: #f0f0f0; border-radius: 2px; overflow: hidden; border: 1px solid #ddd; print-color-adjust: exact; -webkit-print-color-adjust: exact;">
                    <div style="height: 100%; width: ${percentage}%; background-color: ${data.color}; border-radius: 2px; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div>
                  </div>
                </td>
              </tr>
          `;
          }
        }
        
        classesContent += `
            </tbody>
          </table>
        </div>
      `;
      }
      
      content += classesContent;
    }

    // Mapa Segmentado
    if (options.content.includes('map')) {
      let mapContent = '';
      
      // Si hay máscaras múltiples, mostrarlas todas
      if (options.isMultipleMasks && options.multipleMasks && options.multipleMasks.length > 0) {
        mapContent = `
        <div class="section" style="page-break-inside: avoid;">
          <div class="section-title">Mapas Segmentados de Múltiples Escenas</div>
          <p style="font-size: 12px; color: #666; margin-bottom: 15px;">Se muestran las imágenes de segmentación de las ${options.multipleMasks.length} escena(s) analizadas en el período seleccionado:</p>
      `;
        
        options.multipleMasks.forEach((mask, index) => {
          mapContent += `
          <div style="margin-bottom: 20px; page-break-inside: avoid;">
            <h3 style="font-size: 13px; font-weight: 600; color: #2d5016; margin-bottom: 8px;">Escena ${index + 1}</h3>
            <div style="text-align: center; margin: 15px 0;">
              <img src="${mask.imageUrl}" style="max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 6px; display: block; margin: 0 auto;">
            </div>
            <p style="font-size: 11px; color: #999; text-align: center; margin-top: 8px;">Segmentación de ${mask.sceneId}</p>
          </div>
        `;
        });
        
        mapContent += `
        </div>
      `;
      } else if (options.maskImageUrl && options.maskImageUrl.trim() !== '') {
        // Si hay una imagen de máscara individual válida, mostrarla
        mapContent = `
        <div class="section" style="page-break-inside: avoid;">
          <div class="section-title">Mapa Segmentado</div>
          <div style="text-align: center; margin: 20px 0; page-break-inside: avoid;">
            <img src="${options.maskImageUrl}" style="max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 6px; display: block; margin: 0 auto;">
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">Imagen de segmentación del área analizada según los filtros aplicados en el período seleccionado.</p>
        </div>
      `;
      }
      
      if (mapContent) {
        content += mapContent;
      }
    }

    // Metadatos Técnicos
    if (options.content.includes('metadata')) {
      const appliedFilters = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 
        ? `${options.filteredPixelCoverageData.length} clase(s) seleccionada(s)`
        : 'Ninguno';
      
      content += `
        <div class="section">
          <div class="section-title">Metadatos Técnicos</div>
          <table>
            <tr>
              <td style="font-weight: 600; width: 30%;">Fecha de Captura</td>
              <td>${monthLabel}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Resolución</td>
              <td>Alta (píxeles de ${(options.pixelCoverageData && options.pixelCoverageData.length > 0 ? '1m²' : '100m²')})</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Filtros Aplicados (Clases)</td>
              <td>${appliedFilters}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Período Temporal</td>
              <td>${monthLabel}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Región Analizada</td>
              <td>${options.region === 'full' ? 'Campus Completo' : options.region === 'green-only' ? 'Solo Áreas Verdes' : 'Subregión Personalizada'}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Sistema</td>
              <td>SIGMA v2.0 - ESPOL</td>
            </tr>
          </table>
        </div>
      `;
    }

    // Análisis Comparativo
    if (options.content.includes('comparison')) {
      content += `
        <div class="section">
          <div class="section-title">Análisis Comparativo</div>
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
          <div class="section-title">Recomendaciones</div>
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
    const monthLabel = options.monthLabel || 'Noviembre 2024';
    let csv = 'SIGMA - Sistema Integrado de Gestión y Monitoreo de Áreas Verdes\n';
    csv += `Informe generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}\n`;
    csv += `Período: ${monthLabel}\n\n`;

    if (options.content.includes('stats')) {
      csv += 'ESTADÍSTICAS DE COBERTURA\n';
      
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        const totalPixels = options.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        csv += 'Área Total (m²),' + (options.totalAreaM2 || 0).toFixed(2) + '\n';
        csv += 'Cobertura Verde,' + (options.vegetationCoveragePercentage || 0).toFixed(2) + '%\n';
        csv += 'Áreas Verdes (m²),' + (options.vegetationAreaM2 || 0).toFixed(2) + '\n';
        csv += 'Total de Clases,' + options.pixelCoverageData.length + '\n';
      } else {
        const stats = this.calculateStatistics(cells);
        csv += 'Total de Celdas,' + cells.length + '\n';
        csv += 'Cobertura Verde,' + stats.greenPercentage + '%\n';
        csv += 'Áreas Verdes,' + stats.greenCount + '\n';
        csv += 'Edificios,' + stats.buildingCount + '\n';
      }
      csv += '\n';
    }

    if (options.content.includes('map')) {
      csv += 'MAPA SEGMENTADO\n';
      
      // Si hay máscaras múltiples, registrar información de cada una
      if (options.isMultipleMasks && options.multipleMasks && options.multipleMasks.length > 0) {
        csv += 'Se incluyen máscaras segmentadas de las siguientes escenas:\n';
        options.multipleMasks.forEach((mask, index) => {
          csv += `Escena ${index + 1},${mask.sceneId || 'Escena sin ID'},${mask.captureDate || 'Fecha no disponible'}\n`;
        });
        csv += '\n';
      }
      
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        csv += 'Clase,Píxeles,Área (m²)\n';
        options.pixelCoverageData.forEach(item => {
          csv += `"${item.class_name}",${item.pixel_count},${(item.area_m2 || 0).toFixed(2)}\n`;
        });
      } else {
        csv += 'ID,Nombre,Tipo,Área,Clase\n';
        cells.forEach(cell => {
          const classNameSpanish = this.translateClassId(cell.classId);
          csv += `${cell.id},"${cell.name}","${cell.type}","${cell.area}","${classNameSpanish}"\n`;
        });
      }
      csv += '\n';
    }

    if (options.content.includes('classes')) {
      csv += 'COBERTURA DE ÁREA (M²)\n';
      
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        // Usar datos filtrados (sin "Sin etiqueta")
        const dataToDisplay = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 
          ? options.filteredPixelCoverageData 
          : options.pixelCoverageData.filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta');
        
        const totalAreaFiltered = dataToDisplay.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
        
        // Ordenar por área descendente
        const sortedData = [...dataToDisplay].sort((a, b) => (b.area_m2 || 0) - (a.area_m2 || 0));
        
        csv += 'Clase,Área (m²),Porcentaje\n';
        sortedData.forEach(item => {
          const percentage = totalAreaFiltered > 0 ? ((item.area_m2 || 0) / totalAreaFiltered * 100).toFixed(2) : '0.00';
          csv += `"${item.class_name}",${(item.area_m2 || 0).toFixed(2)},${percentage}%\n`;
        });
      } else {
        csv += 'Clase,Cantidad,Porcentaje\n';
        const distribution = this.getClassDistribution(cells);
        for (const [className, data] of Object.entries(distribution)) {
          const percentage = cells.length > 0 ? Math.round((data.count / cells.length) * 100) : 0;
          csv += `"${className}",${data.count},${percentage}%\n`;
        }
      }
      csv += '\n';
    }

    if (options.content.includes('metadata')) {
      csv += 'METADATOS TÉCNICOS\n';
      csv += 'Fecha de Captura,' + options.monthLabel + '\n';
      csv += 'Período Temporal,' + options.monthLabel + '\n';
      csv += 'Región Analizada,' + (options.region === 'full' ? 'Campus Completo' : options.region === 'green-only' ? 'Solo Áreas Verdes' : 'Subregión Personalizada') + '\n';
      csv += 'Filtros Aplicados,' + (options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 ? `${options.filteredPixelCoverageData.length} clase(s) seleccionada(s)` : 'Ninguno') + '\n';
      csv += 'Sistema,SIGMA v2.0 - ESPOL\n\n';
    }

    return csv;
  }

  private getColorForClass(className: string): string {
    // Mapear nombre de clase a ID de clase para obtener el color correcto del catálogo
    const classNameToIdMap: { [key: string]: string } = {
      'Sin etiqueta': 'unlabeled',
      'Área pavimentada': 'paved-area',
      'Tierra': 'dirt',
      'Césped': 'grass',
      'Grava': 'gravel',
      'Agua': 'water',
      'Rocas': 'rocks',
      'Piscina': 'pool',
      'Vegetación': 'vegetation',
      'Techo': 'roof',
      'Pared': 'wall',
      'Ventana': 'window',
      'Puerta': 'door',
      'Cerca': 'fence',
      'Poste de cerca': 'fence-pole',
      'Persona': 'person',
      'Perro': 'dog',
      'Automóvil': 'car',
      'Bicicleta': 'bicycle',
      'Árbol': 'tree',
      'Árbol sin hojas': 'bald-tree',
      'Marcador AR': 'ar-marker',
      'Obstáculo': 'obstacle',
      'Conflicto': 'conflicting'
    };
    
    // Colores del catálogo CLASS_CATALOG (deben estar en sincronía con el frontend)
    const classColorMap: { [key: string]: string } = {
      'unlabeled': '#000000',
      'paved-area': '#804080',
      'dirt': '#824C00',
      'grass': '#006600',
      'gravel': '#706757',
      'water': '#1C2AA8',
      'rocks': '#30291E',
      'pool': '#003259',
      'vegetation': '#6B8E23',
      'roof': '#464646',
      'wall': '#66669C',
      'window': '#FEE40C',
      'door': '#FE940C',
      'fence': '#BE9999',
      'fence-pole': '#999999',
      'person': '#FF1660',
      'dog': '#663300',
      'car': '#098F96',
      'bicycle': '#770B20',
      'tree': '#333300',
      'bald-tree': '#BEFABE',
      'ar-marker': '#709692',
      'obstacle': '#028773',
      'conflicting': '#FF0000'
    };
    
    // Obtener el ID de clase correspondiente
    let classId = classNameToIdMap[className];
    
    // Si no se encuentra en el mapping, intentar limpiar y normalizar el nombre
    if (!classId) {
      const normalized = className.toLowerCase().replace(/\s+/g, '-');
      classId = normalized;
    }
    
    // Retornar el color si existe en el catálogo
    if (classColorMap[classId]) {
      return classColorMap[classId];
    }
    
    // Si no se encuentra, generar un color basado en el hash del nombre
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 45%)`;
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
