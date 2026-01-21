import { Injectable } from '@angular/core';
import { PixelCoverageItem } from '../models/api.models';
import { ClassColorService } from './class-color.service';
import { groupCoverageByCategory } from '../models/coverage-categories';

export interface MaskData {
  sceneId?: string;
  captureDate?: string;
  imageUrl: string;
  pixelCoverageData: PixelCoverageItem[];
}

export interface PeriodReportData {
  monthLabel: string;
  periodo?: string;  // Período en formato YYYY-MM para regenerar máscaras
  pixelCoverageData: PixelCoverageItem[];
  filteredPixelCoverageData: PixelCoverageItem[];
  vegetationCoveragePercentage: number;
  vegetationAreaM2: number;
  totalAreaM2: number;
  multipleMasks?: MaskData[];
  isMultipleMasks: boolean;
}

export interface ReportOptions {
  format: 'pdf' | 'csv';
  content: string[];
  region: 'full' | 'subregion' | 'green-only';
  monthLabel?: string;  // Para reporte de un período (modo legado)
  pixelCoverageData?: PixelCoverageItem[];
  filteredPixelCoverageData?: PixelCoverageItem[];
  vegetationCoveragePercentage?: number;
  vegetationAreaM2?: number;
  totalAreaM2?: number;
  maskImageUrl?: string;  // URL de la máscara actual de Leaflet (para modo individual)
  multipleMasks?: MaskData[];  // Array de máscaras para modo múltiple
  isMultipleMasks?: boolean;  // Flag indicando si es modo múltiples máscaras
  multiPeriodData?: PeriodReportData[];  // Array de datos por período para reportes multi-período
  areaUnit?: 'm2' | 'ha';  // Unidad de área seleccionada por el usuario
  coverageViewMode?: 'classes' | 'categories';  // Modo de vista: clases o categorías
  selectedCategoryIds?: string[];  // IDs de categorías seleccionadas en el panel de control
  categoryColors?: Map<string, string>;  // Colores personalizados de categorías
}

@Injectable({
  providedIn: 'root'
})
export class ReportGeneratorService {
  private readonly M2_TO_HA = 0.0001; // Conversión: 1 m² = 0.0001 ha

  constructor(private classColorService: ClassColorService) {}

  generateReport(options: ReportOptions): void {
    if (options.format === 'pdf') {
      this.generatePDF(options);
    } else {
      this.generateCSV(options);
    }
  }

  private convertArea(areaM2: number, unit: 'm2' | 'ha' = 'm2'): number {
    if (unit === 'ha') {
      return areaM2 * this.M2_TO_HA;
    }
    return areaM2;
  }

  private getAreaUnitLabel(unit: 'm2' | 'ha' = 'm2'): string {
    return unit === 'm2' ? 'm²' : 'ha';
  }

  private formatCaptureDate(dateString?: string): string {
    if (!dateString) {
      return 'Fecha desconocida';
    }
    
    // Parsear la fecha en formato YYYY-MM-DD sin considerar zona horaria
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      // Formato: D/M/YYYY
      return `${day}/${month}/${year}`;
    }
    
    return 'Fecha desconocida';
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
          .period-header { background-color: #e8f5e9; border-left: 4px solid #4a7c2c; padding: 15px; margin: 30px 0 20px 0; page-break-after: avoid; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .period-title { font-size: 16px; font-weight: 600; color: #2d5016; }
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

    // Si hay datos de múltiples períodos, generar secciones por período
    if (options.multiPeriodData && options.multiPeriodData.length > 0) {
      const multiPeriodData = options.multiPeriodData; // Asignación local para type narrowing
      multiPeriodData.forEach((periodData, index) => {
        content += `<div class="period-header"><div class="period-title">📅 ${periodData.monthLabel}</div></div>`;
        
        // Generar contenido para este período
        content += this.buildPeriodContent({
          ...options,
          monthLabel: periodData.monthLabel,
          pixelCoverageData: periodData.pixelCoverageData,
          filteredPixelCoverageData: periodData.filteredPixelCoverageData,
          vegetationCoveragePercentage: periodData.vegetationCoveragePercentage,
          vegetationAreaM2: periodData.vegetationAreaM2,
          totalAreaM2: periodData.totalAreaM2,
          multipleMasks: periodData.multipleMasks,
          isMultipleMasks: periodData.isMultipleMasks
        });
        
        // Page break entre períodos (excepto el último)
        if (index < multiPeriodData.length - 1) {
          content += `<div style="page-break-after: always;"></div>`;
        }
      });
    } else {
      // Generar contenido de un único período
      content += this.buildPeriodContent(options);
    }

    // Agregar Análisis Comparativo y Recomendaciones solo una vez al final
    if (options.content.includes('comparison') && options.multiPeriodData && options.multiPeriodData.length > 1) {
      let comparisonContent = `<div class="section"><div class="section-title">Análisis Comparativo</div>`;
      
      // Crear gráfica de líneas con SVG
      const periods = options.multiPeriodData;
      const vegetationAreas = periods.map(p => p.vegetationAreaM2 || 0);
      const maxArea = Math.max(...vegetationAreas);
      const minArea = Math.min(...vegetationAreas);
      const range = maxArea - minArea || maxArea || 1;
      
      const chartWidth = 600;
      const chartHeight = 300;
      const padding = 60;
      const pointRadius = 6;
      
      let svgContent = `<h4 style="font-size: 14px; font-weight: bold; margin-bottom: 12px; margin-top: 20px; text-align: center;">Evolución de Áreas Verdes por Período</h4>`;
      svgContent += `<svg width="${chartWidth}" height="${chartHeight}" style="border: 1px solid #ddd; display: block; margin: 20px auto;">`;
      
      // Ejes
      svgContent += `<line x1="${padding}" y1="${chartHeight - padding}" x2="${chartWidth - padding}" y2="${chartHeight - padding}" stroke="#333" stroke-width="2"/>`;
      svgContent += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${chartHeight - padding}" stroke="#333" stroke-width="2"/>`;
      
      // Etiquetas de ejes
      svgContent += `<text x="${chartWidth/2}" y="${chartHeight - 10}" text-anchor="middle" font-size="12" fill="#666">Períodos</text>`;
      svgContent += `<text x="15" y="${chartHeight/2}" text-anchor="middle" font-size="12" fill="#666" transform="rotate(-90 15 ${chartHeight/2})">Área Verde (m²)</text>`;
      
      // Calcular puntos
      const xStep = (chartWidth - 2 * padding) / (periods.length + 1);
      const points = vegetationAreas.map((area, idx) => {
        const x = padding + (idx + 1) * xStep;
        const y = chartHeight - padding - ((area - minArea) / range) * (chartHeight - 2 * padding);
        return { x, y, area, label: periods[idx].monthLabel };
      });
      
      // Dibujar línea
      let pathData = '';
      points.forEach((point, idx) => {
        if (idx === 0) {
          pathData += `M ${point.x} ${point.y}`;
        } else {
          pathData += ` L ${point.x} ${point.y}`;
        }
      });
      svgContent += `<path d="${pathData}" stroke="#4a7c2c" stroke-width="2" fill="none"/>`;
      
      // Dibujar puntos
      points.forEach(point => {
        svgContent += `<circle cx="${point.x}" cy="${point.y}" r="${pointRadius}" fill="#2d5016" stroke="#fff" stroke-width="2"/>`;
        svgContent += `<text x="${point.x}" y="${chartHeight - padding + 25}" text-anchor="middle" font-size="11" fill="#333">${point.label}</text>`;
        svgContent += `<text x="${point.x}" y="${point.y - 15}" text-anchor="middle" font-size="11" font-weight="600" fill="#2d5016">${point.area.toFixed(0)} m²</text>`;
      });
      
      svgContent += `</svg>`;
      
      comparisonContent += svgContent + `</div>`;
      
      // Tabla de evolución de áreas verdes
      comparisonContent += `
        <div style="margin-top: 30px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f5f5f5; border-bottom: 2px solid #333;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold;">Período</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #ddd; font-weight: bold;">Área Verde (m²)</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold;">Cambio (m²)</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold;">Cambio (%)</th>
              </tr>
            </thead>
            <tbody>`;
      
      vegetationAreas.forEach((area, idx) => {
        const period = periods[idx];
        const change = idx > 0 ? area - vegetationAreas[idx - 1] : 0;
        const changePercent = idx > 0 ? ((change / vegetationAreas[idx - 1]) * 100) : 0;
        const changeText = idx > 0 ? (change >= 0 ? `+${change.toFixed(2)}` : `${change.toFixed(2)}`) : '—';
        const changePercentText = idx > 0 ? (changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`) : '—';
        const changeColor = idx > 0 ? (change >= 0 ? '#4a7c2c' : '#d32f2f') : '#999';
        
        comparisonContent += `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; border: 1px solid #ddd;">${period.monthLabel}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${area.toFixed(2)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; color: ${changeColor}; font-weight: bold;">${changeText}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; color: ${changeColor}; font-weight: bold;">${changePercentText}</td>
              </tr>`;
      });
      
      comparisonContent += `
            </tbody>
          </table>
        </div>`;
      
      content += comparisonContent;
    }

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

  private buildPeriodContent(options: ReportOptions): string {
    const monthLabel = options.monthLabel || 'Octubre 2025';
    let content = '';

    // Resumen Ejecutivo
    if (options.content.includes('map') || options.content.includes('stats') || options.content.includes('classes')) {
      content += `<div class="section"><div class="section-title">Resumen Ejecutivo</div><p>Análisis de segmentación de áreas del Campus ESPOL correspondiente a: <strong>${monthLabel}</strong>. Este informe presenta un análisis detallado de la distribución de áreas verdes, edificios, calles y otros elementos identificados en el campus. Los datos permiten evaluar el estado de la infraestructura verde y su relación con otras áreas del terreno.</p></div>`;
    }

    // Estadísticas de Cobertura
    if (options.content.includes('stats')) {
      let statsContent = '';
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        const areaUnit = options.areaUnit || 'm2';
        const unitLabel = this.getAreaUnitLabel(areaUnit);
        const totalArea = this.convertArea(options.totalAreaM2 || 0, areaUnit);
        const greenPercentage = options.vegetationCoveragePercentage || 0;
        const vegetationArea = this.convertArea(options.vegetationAreaM2 || 0, areaUnit);
        
        // Mostrar categorías o clases según el modo
        let totalItemsLabel = 'Total de Clases';
        let totalItemsCount = options.pixelCoverageData.filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta').length;
        
        if (options.coverageViewMode === 'categories') {
          const categorizedData = groupCoverageByCategory(options.pixelCoverageData, options.totalAreaM2 || 0);
          totalItemsLabel = 'Total de Categorías';
          
          // Contar categorías según selección
          if (options.selectedCategoryIds && options.selectedCategoryIds.length > 0) {
            // Si hay categorías seleccionadas, contar solo las seleccionadas
            totalItemsCount = options.selectedCategoryIds.length;
          } else {
            // Si no hay selección, contar todas las categorías
            totalItemsCount = categorizedData.length;
          }
        }
        
        statsContent = `<div class="section"><div class="section-title">Estadísticas de Cobertura</div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Área Total (${unitLabel})</div><div class="stat-value">${totalArea.toFixed(2)}</div></div><div class="stat-card"><div class="stat-label">Cobertura Verde</div><div class="stat-value">${greenPercentage.toFixed(2)}%</div></div><div class="stat-card"><div class="stat-label">Áreas Verdes (${unitLabel})</div><div class="stat-value">${vegetationArea.toFixed(2)}</div></div><div class="stat-card"><div class="stat-label">${totalItemsLabel}</div><div class="stat-value">${totalItemsCount}</div></div></div></div>`;
      }
      content += statsContent;
    }

    // Distribución de Clases o Categorías
    if (options.content.includes('classes')) {
      let classesContent = '';
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        const areaUnit = options.areaUnit || 'm2';
        const unitLabel = this.getAreaUnitLabel(areaUnit);
        
        if (options.coverageViewMode === 'categories') {
          // Mostrar distribución por categorías
          const dataToDisplay = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 ? options.filteredPixelCoverageData : options.pixelCoverageData;
          const categorizedData = groupCoverageByCategory(dataToDisplay, options.totalAreaM2 || 0);
          
          // Filtrar categorías seleccionadas o todas si no hay selección
          let categoriesToDisplay: typeof categorizedData;
          if (options.selectedCategoryIds && options.selectedCategoryIds.length > 0) {
            // Mostrar solo las categorías seleccionadas, incluso si no tienen datos
            categoriesToDisplay = categorizedData
              .filter(cat => options.selectedCategoryIds!.includes(cat.categoryId))
              .sort((a, b) => b.totalAreaM2 - a.totalAreaM2);
          } else {
            // Mostrar todas las categorías sin filtrar por datos
            categoriesToDisplay = categorizedData
              .sort((a, b) => b.totalAreaM2 - a.totalAreaM2);
          }
          
          const totalAreaFiltered = categoriesToDisplay.reduce((sum, cat) => sum + cat.totalAreaM2, 0);
          const displayTotalArea = this.convertArea(totalAreaFiltered, areaUnit);
          
          classesContent = `<div class="section"><div class="section-title">Cobertura de Categorías (${unitLabel})</div><div style="margin-top: 15px;"><div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #2d5016;"><span>Área total (${unitLabel}):</span><span>${displayTotalArea.toFixed(2)}</span></div></div><table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;"><thead><tr style="background-color: #f5f5f5;"><th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 30px;">Color</th><th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 110px;">Categoría</th><th style="padding: 8px 4px; text-align: right; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 60px;">Área (${unitLabel})</th><th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 65px;">Cobertura (%)</th><th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 140px;">Visualización</th></tr></thead><tbody>`;
          
          categoriesToDisplay.forEach(category => {
            const percentage = totalAreaFiltered > 0 ? (category.totalAreaM2 / totalAreaFiltered * 100).toFixed(2) : '0.00';
            const displayArea = this.convertArea(category.totalAreaM2, areaUnit);
            
            // Usar el color personalizado de la categoría si está disponible, si no usar el color por defecto
            const categoryColor = options.categoryColors?.get(category.categoryName) || category.categoryColor;
            
            classesContent += `<tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 4px; text-align: center;"><div style="width: 20px; height: 20px; border-radius: 3px; background-color: ${categoryColor}; border: 1px solid #ccc; display: inline-block; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div></td><td style="padding: 8px 6px; font-size: 12px;">${category.categoryName}</td><td style="padding: 8px 4px; text-align: right; font-size: 12px;">${displayArea.toFixed(2)}</td><td style="padding: 8px 4px; text-align: center; font-weight: 600; color: #2d5016; font-size: 12px;">${percentage}%</td><td style="padding: 8px 6px;"><div style="width: 100%; height: 16px; background-color: #f0f0f0; border-radius: 2px; overflow: hidden; border: 1px solid #ddd; print-color-adjust: exact; -webkit-print-color-adjust: exact;"><div style="height: 100%; width: ${percentage}%; background-color: ${categoryColor}; border-radius: 2px; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div></div></td></tr>`;
          });
          
          classesContent += `</tbody></table></div>`;
        } else {
          // Mostrar distribución por clases (modo original)
          const dataToDisplay = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 ? options.filteredPixelCoverageData : options.pixelCoverageData.filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta');
          const totalAreaFiltered = dataToDisplay.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
          const displayTotalArea = this.convertArea(totalAreaFiltered, areaUnit);
          const sortedData = [...dataToDisplay].sort((a, b) => (b.area_m2 || 0) - (a.area_m2 || 0));
          classesContent = `<div class="section"><div class="section-title">Cobertura de Área (${unitLabel})</div><div style="margin-top: 15px;"><div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 2px solid #f0f0f0; margin-bottom: 10px; font-size: 14px; font-weight: 600; color: #2d5016;"><span>Área total (${unitLabel}):</span><span>${displayTotalArea.toFixed(2)}</span></div></div><table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;"><thead><tr style="background-color: #f5f5f5;"><th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 30px;">Color</th><th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 110px;">Clase</th><th style="padding: 8px 4px; text-align: right; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 60px;">Área (${unitLabel})</th><th style="padding: 8px 4px; text-align: center; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 65px;">Cobertura (%)</th><th style="padding: 8px 6px; text-align: left; font-weight: 600; color: #666; border-bottom: 1px solid #e0e0e0; width: 140px;">Visualización</th></tr></thead><tbody>`;
          sortedData.forEach(item => {
            const percentage = totalAreaFiltered > 0 ? ((item.area_m2 || 0) / totalAreaFiltered * 100).toFixed(2) : '0.00';
            const classColor = this.getColorForClass(item.class_name);
            const displayArea = this.convertArea(item.area_m2 || 0, areaUnit);
            classesContent += `<tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 4px; text-align: center;"><div style="width: 20px; height: 20px; border-radius: 3px; background-color: ${classColor}; border: 1px solid #ccc; display: inline-block; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div></td><td style="padding: 8px 6px; font-size: 12px;">${item.class_name}</td><td style="padding: 8px 4px; text-align: right; font-size: 12px;">${displayArea.toFixed(2)}</td><td style="padding: 8px 4px; text-align: center; font-weight: 600; color: #2d5016; font-size: 12px;">${percentage}%</td><td style="padding: 8px 6px;"><div style="width: 100%; height: 16px; background-color: #f0f0f0; border-radius: 2px; overflow: hidden; border: 1px solid #ddd; print-color-adjust: exact; -webkit-print-color-adjust: exact;"><div style="height: 100%; width: ${percentage}%; background-color: ${classColor}; border-radius: 2px; print-color-adjust: exact; -webkit-print-color-adjust: exact;"></div></div></td></tr>`;
          });
          classesContent += `</tbody></table></div>`;
        }
      }
      content += classesContent;
    }

    // Metadatos Técnicos
    if (options.content.includes('metadata')) {
      const filterLabel = options.coverageViewMode === 'categories' ? 'Filtros Aplicados (Categorías)' : 'Filtros Aplicados (Clases)';
      
      let appliedFilters: string;
      if (options.coverageViewMode === 'categories') {
        // En modo categorías, mostrar el número de categorías seleccionadas o todas si no hay selección
        if (options.selectedCategoryIds && options.selectedCategoryIds.length > 0) {
          appliedFilters = `${options.selectedCategoryIds.length} categoría(s) seleccionada(s)`;
        } else {
          // Si no hay selección, contar todas las categorías
          const categorizedData = groupCoverageByCategory(options.pixelCoverageData || [], options.totalAreaM2 || 0);
          appliedFilters = `${categorizedData.length} categoría(s) seleccionada(s)`;
        }
      } else {
        // En modo clases, mostrar el número de clases filtradas
        appliedFilters = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 ? `${options.filteredPixelCoverageData.length} clase(s) seleccionada(s)` : 'Ninguno';
      }
      
      content += `<div class="section"><div class="section-title">Metadatos Técnicos</div><table style="font-size: 14px;"><tr><td style="font-weight: 600; width: 30%;">${filterLabel}</td><td>${appliedFilters}</td></tr><tr><td style="font-weight: 600;">Período Temporal</td><td>${monthLabel}</td></tr><tr><td style="font-weight: 600;">Región Analizada</td><td>${options.region === 'full' ? 'Campus Completo' : options.region === 'green-only' ? 'Solo Áreas Verdes' : 'Subregión Personalizada'}</td></tr><tr><td style="font-weight: 600;">Sistema</td><td>SIGMA v2.0 - ESPOL</td></tr><tr><td style="font-weight: 600;">Precisión</td><td>85%</td></tr></table></div>`;
    }

    // Mapa Segmentado
    if (options.content.includes('map')) {
      let mapContent = '';
      if (options.isMultipleMasks && options.multipleMasks && options.multipleMasks.length > 0) {
        mapContent = `<div class="section" style="page-break-inside: avoid;"><div class="section-title">Mapas Segmentados de Múltiples Escenas</div><p style="font-size: 12px; color: #666; margin-bottom: 15px;">Se muestran las imágenes de segmentación de las ${options.multipleMasks.length} escena(s) analizadas en el período seleccionado:</p>`;
        options.multipleMasks.forEach((mask, index) => {
          const captureDate = this.formatCaptureDate(mask.captureDate);
          mapContent += `<div style="margin-bottom: 20px; page-break-inside: avoid;"><h3 style="font-size: 13px; font-weight: 600; color: #2d5016; margin-bottom: 8px;">Escena ${index + 1}</h3><div style="text-align: center; margin: 15px 0;"><img src="${mask.imageUrl}" style="max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 6px; display: block; margin: 0 auto;"></div><p style="font-size: 11px; color: #999; text-align: center; margin-top: 8px;">Fecha de Captura: ${captureDate}</p></div>`;
        });
        mapContent += `</div>`;
      } else if (options.maskImageUrl && options.maskImageUrl.trim() !== '') {
        mapContent = `<div class="section" style="page-break-inside: avoid;"><div class="section-title">Mapa Segmentado</div><div style="text-align: center; margin: 20px 0; page-break-inside: avoid;"><img src="${options.maskImageUrl}" style="max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 6px; display: block; margin: 0 auto;"></div><p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">Imagen de segmentación del área analizada según los filtros aplicados en el período seleccionado.</p></div>`;
      }
      if (mapContent) {
        content += mapContent;
      }
    }

    return content;
  }

  private buildCSVContent(options: ReportOptions): string {
    let csv = 'SIGMA - Sistema Integrado de Gestión y Monitoreo de Áreas Verdes\n';
    csv += `Informe generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}\n`;

    // Si hay múltiples períodos, generar secciones por período
    if (options.multiPeriodData && options.multiPeriodData.length > 0) {
      const multiPeriodData = options.multiPeriodData; // Asignación local para type narrowing
      csv += `Período: Múltiples períodos (${multiPeriodData.length})\n\n`;
      
      multiPeriodData.forEach((periodData, periodIndex) => {
        csv += `===== PERÍODO ${periodIndex + 1}: ${periodData.monthLabel} =====\n\n`;
        csv += this.buildPeriodCSVContent(
          {
            ...options,
            monthLabel: periodData.monthLabel,
            pixelCoverageData: periodData.pixelCoverageData,
            filteredPixelCoverageData: periodData.filteredPixelCoverageData,
            vegetationCoveragePercentage: periodData.vegetationCoveragePercentage,
            vegetationAreaM2: periodData.vegetationAreaM2,
            totalAreaM2: periodData.totalAreaM2,
            multipleMasks: periodData.multipleMasks,
            isMultipleMasks: periodData.isMultipleMasks
          }
        );
        
        // Separador entre períodos
        if (periodIndex < multiPeriodData.length - 1) {
          csv += '\n========================================\n\n';
        }
      });

      // Agregar tabla de análisis comparativo si se solicita
      if (options.content.includes('comparison') && multiPeriodData.length > 1) {
        csv += '\n========================================\n';
        csv += 'ANÁLISIS COMPARATIVO\n';
        csv += '========================================\n\n';
        csv += 'Evolución de Áreas Verdes por Período\n';
        csv += 'Período,Área Verde (m²),Cambio (m²),Cambio (%)\n';
        
        const vegetationAreas = multiPeriodData.map(p => p.vegetationAreaM2 || 0);
        vegetationAreas.forEach((area, idx) => {
          const period = multiPeriodData[idx];
          const change = idx > 0 ? area - vegetationAreas[idx - 1] : 0;
          const changePercent = idx > 0 ? ((change / vegetationAreas[idx - 1]) * 100) : 0;
          const changeText = idx > 0 ? (change >= 0 ? `+${change.toFixed(2)}` : `${change.toFixed(2)}`) : '—';
          const changePercentText = idx > 0 ? (changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`) : '—';
          
          csv += `${period.monthLabel},${area.toFixed(2)},${changeText},${changePercentText}\n`;
        });
        csv += '\n';
      }
    } else {
      // Generar contenido de un único período
      csv += `Período: ${options.monthLabel || 'Noviembre 2024'}\n\n`;
      csv += this.buildPeriodCSVContent(options);
    }

    return csv;
  }

  private buildPeriodCSVContent(options: ReportOptions): string {
    let csv = '';
    
    if (options.content.includes('stats')) {
      csv += 'ESTADÍSTICAS DE COBERTURA\n';
      
      if (options.pixelCoverageData && options.pixelCoverageData.length > 0) {
        const areaUnit = options.areaUnit || 'm2';
        const unitLabel = this.getAreaUnitLabel(areaUnit);
        const totalPixels = options.pixelCoverageData.reduce((sum, item) => sum + item.pixel_count, 0);
        const totalClassCount = options.pixelCoverageData.filter(item => item.class_name?.toLowerCase() !== 'unlabeled' && item.class_name !== 'Sin etiqueta').length;
        const totalArea = this.convertArea(options.totalAreaM2 || 0, areaUnit);
        const vegetationArea = this.convertArea(options.vegetationAreaM2 || 0, areaUnit);
        csv += `Área Total (${unitLabel}),` + totalArea.toFixed(2) + '\n';
        csv += 'Cobertura Verde,' + (options.vegetationCoveragePercentage || 0).toFixed(2) + '%\n';
        csv += `Áreas Verdes (${unitLabel}),` + vegetationArea.toFixed(2) + '\n';
        csv += 'Total de Clases,' + totalClassCount + '\n';
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
      }
      csv += '\n';
    }

    if (options.content.includes('metadata')) {
      csv += 'METADATOS TÉCNICOS\n';
      const appliedFilters = options.filteredPixelCoverageData && options.filteredPixelCoverageData.length > 0 ? `${options.filteredPixelCoverageData.length} clase(s) seleccionada(s)` : 'Ninguno';
      csv += 'Filtros Aplicados (Clases),' + appliedFilters + '\n';
      csv += 'Período Temporal,' + options.monthLabel + '\n';
      csv += 'Región Analizada,' + (options.region === 'full' ? 'Campus Completo' : options.region === 'green-only' ? 'Solo Áreas Verdes' : 'Subregión Personalizada') + '\n';
      csv += 'Sistema,SIGMA v2.0 - ESPOL\n';
      csv += 'Precisión,85%\n';
    }

    return csv;
  }

  private getColorForClass(className: string): string {
    // Intentar obtener color personalizado primero
    const customColors = this.classColorService.getAllColors();
    if (customColors && customColors.size > 0) {
      const customColor = customColors.get(className);
      if (customColor) {
        // Convertir de formato #RRGGBB a #RRGGBB
        return customColor;
      }
    }

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

  private generateFileName(format: 'pdf' | 'csv'): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const extension = format === 'pdf' ? 'pdf' : 'csv';
    return `SIGMA-Informe_${dateStr}_${timeStr}.${extension}`;
  }
}
