
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalibrationData, PipetteType, CalculatedStats, PdfTheme, StoredPipette, PdfOptions } from '../types';

// Helper to format numbers
const fmt = (num: number | string | undefined, decimals = 4) => {
  if (num === '' || num === undefined || isNaN(Number(num))) return '-';
  return Number(num).toFixed(decimals);
};

// Helper to format percentage
const fmtPct = (val: number, target: number, decimals = 2) => {
  if (target === 0 || val === undefined || isNaN(val)) return '-';
  const pct = (val / target) * 100;
  return pct.toFixed(decimals);
};

// Helper to format date string to IT format
const fmtDate = (dateStr: string | undefined) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // Return as is if already formatted or weird
    return d.toLocaleDateString('it-IT');
  } catch (e) {
    return dateStr || '-';
  }
};

// Helper to parse nominal volume from string
const parseNominal = (val: string): number => {
  const match = val.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

// Helper: Hex to RGB Tuple
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] 
    : [0, 0, 0];
};

// Calculate stats for the PDF
const calculateStats = (measurements: (number | '')[], zFactor: number, nominalVolUl: number): CalculatedStats => {
  const valid = measurements.filter((m): m is number => typeof m === 'number');
  if (valid.length === 0) {
    return { meanMass: 0, meanVolume: 0, count: 0, sd: 0, inaccuracy: 0, uncertainty: 0, volumes: [] };
  }
  
  const sumMass = valid.reduce((a, b) => a + b, 0);
  const meanMass = sumMass / valid.length;
  const volumes = valid.map(m => m * zFactor);
  const meanVolume = meanMass * zFactor;
  
  const squaredDiffs = volumes.map(v => Math.pow(v - meanVolume, 2));
  const sumSquaredDiffs = squaredDiffs.reduce((a, b) => a + b, 0);
  const variance = valid.length > 1 ? sumSquaredDiffs / (valid.length - 1) : 0;
  const sd = Math.sqrt(variance);

  const inaccuracy = nominalVolUl > 0 ? meanVolume - nominalVolUl : 0;
  const uncertainty = 2 * sd;
  
  return { meanMass, meanVolume, count: valid.length, volumes, sd, inaccuracy, uncertainty };
};

const checkCompliance = (stats: CalculatedStats, limitSys: number | '', limitRand: number | ''): boolean => {
  if (limitSys === '' || limitRand === '' || typeof limitSys !== 'number' || typeof limitRand !== 'number') return true; 
  
  const isSysOk = Math.abs(stats.inaccuracy) <= limitSys;
  const isRandOk = stats.sd <= limitRand;
  
  return isSysOk && isRandOk;
};

type ColorTuple = [number, number, number];

interface ThemeColors {
  primary: ColorTuple;
  accent: ColorTuple;
  blue: ColorTuple;
  textDark: ColorTuple;
  textMed: ColorTuple;
  textLight: ColorTuple;
  divider: ColorTuple;
  bgLight: ColorTuple;
  success: ColorTuple;
  fail: ColorTuple;
}

// --- THEME DEFINITIONS ---
const BASE_THEMES: Record<Exclude<PdfTheme, 'custom'>, ThemeColors> = {
  default: {
    primary: [76, 29, 149],   // Violet 900
    accent: [124, 58, 237],   // Violet 600
    blue: [59, 130, 246],     // Blue 500
    textDark: [15, 23, 42],   // Slate 900
    textMed: [51, 65, 85],    // Slate 700
    textLight: [100, 116, 139], // Slate 500
    divider: [226, 232, 240], // Slate 200
    bgLight: [248, 250, 252], // Slate 50
    success: [22, 163, 74],    // Green 600
    fail: [220, 38, 38]       // Red 600
  },
  blue: {
    primary: [30, 58, 138],   // Blue 900
    accent: [37, 99, 235],    // Blue 600
    blue: [96, 165, 250],     // Blue 400
    textDark: [17, 24, 39],   // Gray 900
    textMed: [55, 65, 81],    // Gray 700
    textLight: [107, 114, 128], // Gray 500
    divider: [229, 231, 235], // Gray 200
    bgLight: [249, 250, 251], // Gray 50
    success: [5, 150, 105],   // Emerald 600
    fail: [220, 38, 38]       // Red 600
  },
  grayscale: {
    primary: [30, 30, 30],    // Dark Gray
    accent: [80, 80, 80],     // Med Gray
    blue: [150, 150, 150],    // Light Gray
    textDark: [0, 0, 0],      // Black
    textMed: [60, 60, 60],    // Dark Gray
    textLight: [100, 100, 100], // Gray
    divider: [200, 200, 200], // Light Gray
    bgLight: [250, 250, 250], // White-ish
    success: [80, 80, 80],    // Gray
    fail: [0, 0, 0]           // Black
  }
};

const getTheme = (options: PdfOptions): ThemeColors => {
  if (options.colorTheme === 'custom' && options.customPrimaryColor) {
    const primary = hexToRgb(options.customPrimaryColor);
    const accent = options.customSecondaryColor ? hexToRgb(options.customSecondaryColor) : primary;
    
    // Generate a light tint for backgrounds based on primary
    const bgLight: ColorTuple = [
      Math.min(255, primary[0] + 200),
      Math.min(255, primary[1] + 200),
      Math.min(255, primary[2] + 200)
    ];

    return {
      primary,
      accent,
      blue: accent,
      textDark: [20, 20, 20],
      textMed: [60, 60, 60],
      textLight: [100, 100, 100],
      divider: [220, 220, 220],
      bgLight,
      success: [22, 163, 74],
      fail: [220, 38, 38]
    };
  }
  return BASE_THEMES[options.colorTheme as keyof typeof BASE_THEMES] || BASE_THEMES.default;
};

const drawChart = (
  doc: jsPDF, 
  title: string,
  data: number[], 
  startX: number, 
  startY: number, 
  width: number, 
  height: number, 
  color: [number, number, number],
  targetVolume: number,
  stats?: { meanVolume: number, sd: number },
  manualYMin?: number | '',
  manualYMax?: number | ''
) => {
  if (data.length === 0) return;

  // Chart dimensions
  const chartX = startX + 10;
  const chartY = startY + 8; 
  const chartW = width - 15;
  const chartH = height - 15;

  // Title
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100); 
  doc.setFont('helvetica', 'bold');
  doc.text(title, startX, startY + 3);

  // --- Y-AXIS SCALING LOGIC ---
  // Improved logic to ensure Mean, Target, +/- 2SD are visible with padding
  
  let yMin: number;
  let yMax: number;

  if (manualYMin !== '' && manualYMin !== undefined && manualYMax !== '' && manualYMax !== undefined) {
    // Fully Manual
    yMin = Number(manualYMin);
    yMax = Number(manualYMax);
  } else {
    // --- AUTOMATIC CALCULATION ---
    
    // 1. Collect all "Critical Points" that MUST be visible in the chart
    let criticalPoints = [...data]; // All measurement points
    
    if (targetVolume > 0) criticalPoints.push(targetVolume); // Target Line

    if (stats) {
        criticalPoints.push(stats.meanVolume); // Mean Line
        if (stats.sd > 0) {
            // +/- 2SD Bands
            criticalPoints.push(stats.meanVolume + (2 * stats.sd));
            criticalPoints.push(stats.meanVolume - (2 * stats.sd));
        }
    }

    // Filter out NaNs or infinite values
    criticalPoints = criticalPoints.filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n));

    if (criticalPoints.length === 0) {
        // Fallback if no valid data
        yMin = 0;
        yMax = 10;
    } else {
        // 2. Find bounding box of critical points
        let minVal = Math.min(...criticalPoints);
        let maxVal = Math.max(...criticalPoints);
        let span = maxVal - minVal;

        // 3. Handle Flat Data (span = 0)
        // If all points are identical (e.g. perfect precision), create artificial span
        if (span === 0) {
            const buffer = maxVal === 0 ? 1 : Math.abs(maxVal * 0.05); // +/- 5%
            minVal -= buffer;
            maxVal += buffer;
            span = maxVal - minVal;
        }

        // 4. Ensure Minimum Visual Span
        // To prevent extreme zoom on micro-deviations (e.g. 0.0000001 diff), enforce min range
        // relative to the Target Volume (or Mean if target is 0).
        const refVol = targetVolume > 0 ? targetVolume : (stats?.meanVolume || 100);
        const minSpanPercent = 0.01; // 1% minimum visual range
        const minAbsSpan = refVol * minSpanPercent;

        if (span < minAbsSpan) {
            const center = (minVal + maxVal) / 2;
            minVal = center - (minAbsSpan / 2);
            maxVal = center + (minAbsSpan / 2);
            span = minAbsSpan; // Update span
        }

        // 5. Add Padding (e.g., 15% top and bottom)
        // This ensures points aren't touching the chart borders
        const padding = span * 0.15; 
        
        const autoMin = minVal - padding;
        const autoMax = maxVal + padding;

        // 6. Apply limits (respecting partial manual overrides if ever implemented)
        yMin = (manualYMin !== '' && manualYMin !== undefined) ? Number(manualYMin) : autoMin;
        yMax = (manualYMax !== '' && manualYMax !== undefined) ? Number(manualYMax) : autoMax;
    }
  }

  const effectiveRange = yMax - yMin;

  const mapY = (val: number) => {
    // Safety for flat lines
    if (effectiveRange === 0) return chartY + (chartH / 2);
    
    const normalized = (val - yMin) / effectiveRange;
    return (chartY + chartH) - (normalized * chartH);
  };

  // --- GRID LINES & LABELS (11 Intersections) ---
  doc.setDrawColor(150, 150, 150); 
  doc.setLineWidth(0.15); 
  doc.setLineDashPattern([1, 1], 0);

  const gridSteps = 10; 
  
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);

  for (let i = 0; i <= gridSteps; i++) {
    const fraction = i / gridSteps;
    const yPos = (chartY + chartH) - (fraction * chartH); 
    const labelVal = yMin + (fraction * effectiveRange);

    doc.line(chartX, yPos, chartX + chartW, yPos);
    doc.text(labelVal.toFixed(2), chartX - 2, yPos + 1, { align: 'right' });
  }
  doc.setLineDashPattern([], 0); 

  // --- DRAW MEAN AND SD AREA (If stats provided) ---
  if (stats && stats.sd > 0) {
    const upperVal = stats.meanVolume + (2 * stats.sd);
    const lowerVal = stats.meanVolume - (2 * stats.sd);
    
    // Clamp values to chart area for filling
    const topY = Math.max(chartY, Math.min(chartY + chartH, mapY(upperVal)));
    const bottomY = Math.max(chartY, Math.min(chartY + chartH, mapY(lowerVal)));
    const bandHeight = bottomY - topY;

    // Draw Shaded Area (Band)
    if (bandHeight > 0) {
        const r = Math.round(color[0] + (255 - color[0]) * 0.90);
        const g = Math.round(color[1] + (255 - color[1]) * 0.90);
        const b = Math.round(color[2] + (255 - color[2]) * 0.90);

        doc.setFillColor(r, g, b);
        doc.rect(chartX, topY, chartW, bandHeight, 'F');
    }

    doc.setDrawColor(color[0], color[1], color[2]); 
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([2, 2], 0); 
    
    // Draw Top Limit Line
    if (upperVal <= yMax && upperVal >= yMin) {
        doc.line(chartX, mapY(upperVal), chartX + chartW, mapY(upperVal));
        doc.setFontSize(5);
        doc.setTextColor(80, 80, 80);
        doc.text("+2SD", chartX + chartW - 2, mapY(upperVal) - 1, { align: 'right' });
    }
    
    // Draw Bottom Limit Line
    if (lowerVal <= yMax && lowerVal >= yMin) {
        doc.line(chartX, mapY(lowerVal), chartX + chartW, mapY(lowerVal));
        doc.setFontSize(5);
        doc.setTextColor(80, 80, 80);
        doc.text("-2SD", chartX + chartW - 2, mapY(lowerVal) + 2.5, { align: 'right' });
    }

    doc.setLineDashPattern([], 0); // RESET DASH PATTERN
  }

  // --- TARGET LINE (Nominal) ---
  const targetY = mapY(targetVolume);
  if (targetY >= chartY && targetY <= chartY + chartH) {
      doc.setDrawColor(50, 50, 50); 
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([5, 3], 0); 
      doc.line(chartX, targetY, chartX + chartW, targetY);
      doc.setLineDashPattern([], 0); 
  }

  // --- MEAN LINE ---
  if (stats) {
    const meanY = mapY(stats.meanVolume);
    if (meanY >= chartY && meanY <= chartY + chartH) {
        doc.setDrawColor(...color); 
        doc.setLineWidth(0.3);
        // Solid line for mean
        doc.setLineDashPattern([], 0); 
        doc.line(chartX, meanY, chartX + chartW, meanY);

        doc.setFontSize(5);
        doc.setTextColor(80, 80, 80);
        doc.text("Media", chartX + chartW - 2, meanY - 1, { align: 'right' });
    }
  }

  // Axes (Border) - Ensure solid line
  doc.setDrawColor(180, 180, 180); 
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0); 
  doc.line(chartX, chartY, chartX, chartY + chartH); 
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  // --- DATA POINTS ---
  if (data.length > 0) {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.8); 
      doc.setLineDashPattern([], 0); // Ensure solid line
      
      const xStep = chartW / (data.length > 1 ? data.length - 1 : 1);
      let prevX = 0;
      let prevY = 0;
      let firstPoint = true;

      // Draw Lines
      data.forEach((val, i) => {
        const x = chartX + (i * xStep);
        const y = mapY(val);
        
        if (!firstPoint) {
           // Simple clipping check
           const y1 = Math.max(chartY, Math.min(chartY + chartH, prevY));
           const y2 = Math.max(chartY, Math.min(chartY + chartH, y));
           
           // Only draw if roughly within bounds (visual improvement)
           if ((prevY >= chartY && prevY <= chartY + chartH) || (y >= chartY && y <= chartY + chartH)) {
               doc.line(prevX, prevY, x, y);
           }
        }
        prevX = x;
        prevY = y;
        firstPoint = false;
      });

      // Draw Dots
      data.forEach((val, i) => {
        const x = chartX + (i * xStep);
        const y = mapY(val);
        
        if (y >= chartY && y <= chartY + chartH) {
            doc.setFillColor(...color);
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.5);
            doc.circle(x, y, 1.5, 'FD'); 
        }
      });
  }
};

// --- CLIENT LIST PDF GENERATOR ---
export const generateClientListPDF = (clientName: string, pipettes: StoredPipette[]) => {
  const doc = new jsPDF();
  const colors = BASE_THEMES.default;

  // Header
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, 210, 20, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(clientName.toUpperCase(), 14, 13);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lista Pipette (${pipettes.length})`, 200, 13, { align: 'right' });

  // Data preparation for AutoTable
  const tableData = pipettes.map(p => [
    p.manufacturer,
    p.model,
    p.serial_number,
    `${p.nominal_volume} ${p.full_data.nominalVolumeUnit || 'µl'}`,
    fmtDate(p.full_data.testDate),
    fmtDate(p.full_data.nextCalibrationDate)
  ]);

  autoTable(doc, {
    startY: 25,
    head: [['Costruttore', 'Modello', 'Matricola', 'Volume', 'Data di Taratura', 'Data di Scadenza']],
    body: tableData,
    theme: 'striped',
    headStyles: { 
      fillColor: colors.primary, 
      textColor: 255, 
      fontStyle: 'bold', 
      halign: 'left'
    },
    bodyStyles: { textColor: 50 },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { top: 25 },
    columnStyles: {
        4: { halign: 'center' },
        5: { halign: 'center' }
    }
  });

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generato il ${new Date().toLocaleDateString()} - PipetteCal`, 14, doc.internal.pageSize.height - 10);
    doc.text(`Pagina ${i} di ${pageCount}`, 200, doc.internal.pageSize.height - 10, { align: 'right' });
  }

  doc.save(`lista_pipette_${clientName.replace(/\s+/g, '_')}.pdf`);
};

// --- LABELS GENERATOR ---
export const generateLabelsPDF = (calibrationDate: string, totalCount: number) => {
  const doc = new jsPDF();
  const d = new Date(calibrationDate);
  d.setFullYear(d.getFullYear() + 1);
  const nextDate = d.toISOString().split('T')[0];

  const labelWidth = 48; 
  const labelHeight = 14;
  const cols = 4;
  const rows = Math.floor((297 - 20) / labelHeight); 
  
  const marginX = 9;
  const marginY = 10;
  const gapX = 0; 
  const gapY = 0; 

  let col = 0;
  let row = 0;

  doc.setFont('helvetica');

  for (let c = 0; c < totalCount; c++) {
    const x = marginX + (col * (labelWidth + gapX));
    const y = marginY + (row * (labelHeight + gapY));

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, labelWidth, labelHeight);
    doc.setLineDashPattern([], 0); 

    doc.setFontSize(14); 
    doc.setTextColor(0, 0, 0); 
    doc.setFont('helvetica', 'bold');
    doc.text("2S", x + 2, y + 9); 

    const col1X = x + 11;
    const col2X = x + 29;

    doc.setFontSize(5); 
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    doc.text("Data Taratura", col1X, y + 4.5);
    doc.text("Prossima Taratura", col2X, y + 4.5);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    
    doc.text(calibrationDate, col1X, y + 8);
    doc.text(nextDate, col2X, y + 8);

    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
    
    if (row >= rows) {
      doc.addPage();
      col = 0;
      row = 0;
    }
  }

  doc.save(`etichette_generiche_${calibrationDate}.pdf`);
};

export const generatePDF = (data: CalibrationData) => {
  const doc = new jsPDF();
  const zFactor = Number(data.zFactor) || 1.0;
  
  const pdfOpts = data.pdfOptions || { 
    includeCharts: true, 
    colorTheme: 'default', 
    operatorName: '', 
    approverName: '',
    chartYMin: '',
    chartYMax: ''
  };

  const colors = getTheme(pdfOpts);

  let nominalVolUl = parseNominal(data.nominalVolume);
  if (data.nominalVolumeUnit === 'ml') {
    nominalVolUl = nominalVolUl * 1000;
  }

  // --- HEADER START ---
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, 210, 3, 'F');

  // Logic to draw Logo OR Default "2S"
  if (pdfOpts.customLogoBase64) {
      try {
          const logoProps = doc.getImageProperties(pdfOpts.customLogoBase64);
          const maxLogoW = 50;
          const maxLogoH = 20;
          
          // Calculate scale to fit
          const scale = Math.min(maxLogoW / logoProps.width, maxLogoH / logoProps.height);
          const w = logoProps.width * scale;
          const h = logoProps.height * scale;
          
          doc.addImage(pdfOpts.customLogoBase64, 14, 8, w, h);
      } catch (e) {
          // Fallback if image fails
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(48); 
          doc.setTextColor(50, 50, 60); 
          doc.text('2S', 14, 24);
      }
  } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(48); 
      doc.setTextColor(50, 50, 60); 
      doc.text('2S', 14, 24);
  }

  const titleX = 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...colors.textDark);
  // Shift title slightly if there is a logo (optional, keeping aligned for now)
  doc.text('CERTIFICATO DI TARATURA', 70, 18);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...colors.accent);
  doc.text('PIPETTE CALIBRATION REPORT', 70, 24);
  
  const rightX = 196;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colors.textLight);
  doc.text('Data Test', rightX, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.textDark);
  doc.text(data.testDate || new Date().toLocaleDateString(), rightX, 19, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.textLight);
  doc.text('Prossima Taratura', rightX, 26, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.textDark);
  doc.text(data.nextCalibrationDate || 'N/A', rightX, 31, { align: 'right' });

  doc.setDrawColor(...colors.divider);
  doc.setLineWidth(0.1);
  doc.line(14, 38, 196, 38);

  let currentY = 48;

  const drawField = (label: string, value: string, x: number, y: number, width: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...colors.textLight);
    doc.text(label.toUpperCase(), x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.textDark);
    doc.text(value, x, y + 5);
  };

  const colW = 45;
  drawField('Costruttore', data.manufacturer || '-', 14, currentY, colW);
  drawField('Modello', data.model || '-', 14 + colW, currentY, colW);
  drawField('Matricola (S/N)', data.serialNumber || '-', 14 + colW*2, currentY, colW);
  // Ensure unit is displayed
  drawField('Vol. Nominale', data.nominalVolume ? `${data.nominalVolume} ${data.nominalVolumeUnit || 'µl'}` : '-', 14 + colW*3, currentY, colW);

  currentY += 15;

  drawField('Tipo Pipetta', data.type === PipetteType.FIXED ? 'Fissa' : 'Variabile', 14, currentY, colW);
  drawField('Temperatura', `${data.temperature} °C`, 14 + colW, currentY, colW);
  drawField('Pressione', `${data.pressure} kPa`, 14 + colW*2, currentY, colW);
  drawField('Fattore Z', `${data.zFactor}`, 14 + colW*3, currentY, colW);
  
  currentY += 15;

  doc.setFontSize(7);
  doc.setTextColor(...colors.textLight);
  doc.setFont('helvetica', 'italic');
  const zMethodText = data.zFactorMethod === 'ISO_WATER' 
    ? 'Fattore Z calcolato (ISO 8655-6). Liquido: Acqua Distillata.'
    : 'Fattore Z inserito manualmente. Verificare densità liquido.';
  doc.text(zMethodText, 14, currentY);
  
  currentY += 8;

  const tableTheme: any = {
    theme: 'grid',
    headStyles: { 
      fillColor: colors.bgLight, 
      textColor: colors.textMed,
      fontStyle: 'bold', 
      halign: 'center',
      valign: 'middle',
      lineWidth: 0,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }
    },
    bodyStyles: { 
      halign: 'center', 
      textColor: colors.textMed,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      lineWidth: 0
    },
    alternateRowStyles: { 
      fillColor: [255, 255, 255] 
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: colors.textLight, cellWidth: 15 },
    },
    styles: { 
      fontSize: 10, // Increased from 9 for better readability
      font: 'helvetica',
      lineColor: colors.divider,
      lineWidth: 0.1
    }
  };

  const drawSectionTitle = (title: string, y: number) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text(title.toUpperCase(), 14, y);
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(14, y + 2, 25, y + 2);
  };

  const statsFixed = calculateStats(data.measurementsFixed, zFactor, nominalVolUl);
  const targetMin = nominalVolUl > 0 ? nominalVolUl * 0.1 : 0;
  const targetMid = nominalVolUl > 0 ? nominalVolUl * 0.5 : 0;
  const targetMax = nominalVolUl;
  const statsMin = calculateStats(data.measurementsVarMin, zFactor, targetMin); 
  const statsMid = calculateStats(data.measurementsVarMid, zFactor, targetMid); 
  const statsMax = calculateStats(data.measurementsVarMax, zFactor, targetMax);

  if (data.type === PipetteType.FIXED) {
    if (pdfOpts.includeCharts) {
      drawSectionTitle('Grafico Stabilità Volume', currentY);
      currentY += 8;
      // Pass nominalVolUl as target
      drawChart(
          doc, 
          "Volume Nominale (Fisso)", 
          statsFixed.volumes, 
          14, currentY, 182, 80, 
          colors.accent, 
          nominalVolUl, 
          statsFixed,
          pdfOpts.chartYMin,
          pdfOpts.chartYMax
      );
      currentY += 90; 
    } else {
      currentY += 10; // Spacing if no charts
    }

    if (statsFixed.count > 0) {
       const hasLimits = data.toleranceSystematic !== '' && data.toleranceRandom !== '';
       const isCompliant = checkCompliance(statsFixed, data.toleranceSystematic, data.toleranceRandom);
       
       doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
       doc.setDrawColor(...colors.accent);
       doc.setLineWidth(0.1);
       doc.roundedRect(14, currentY, 182, 35, 2, 2, 'FD');

       doc.setFillColor(...colors.accent);
       doc.roundedRect(14, currentY, 182, 8, 2, 2, 'F');
       doc.rect(14, currentY + 6, 182, 2, 'F'); 

       doc.setTextColor(255, 255, 255);
       doc.setFontSize(9);
       doc.setFont('helvetica', 'bold');
       doc.text("RIEPILOGO STATISTICO", 18, currentY + 5.5);
       
       if (hasLimits) {
         doc.setFillColor(...(isCompliant ? colors.success : colors.fail));
         doc.roundedRect(145, currentY + 1.5, 48, 5, 1, 1, 'F');
         doc.setTextColor(255, 255, 255);
         doc.setFontSize(8); 
         doc.text(isCompliant ? "Passed" : "Not Passed", 169, currentY + 5, { align: 'center' });
       }

       const fieldsY = currentY + 16;
       const colW = 182 / 3; // Changed from 4 to 3 columns since we removed SD
       
       const drawResult = (label: string, val: string, unit: string, x: number) => {
         doc.setFontSize(7);
         doc.setTextColor(...colors.textLight);
         doc.text(label.toUpperCase(), x + colW/2, fieldsY, { align: 'center' });
         
         doc.setFontSize(14); 
         doc.setTextColor(...colors.textDark);
         doc.setFont('helvetica', 'bold');
         doc.text(val, x + colW/2, fieldsY + 6, { align: 'center' });

         doc.setFontSize(7);
         doc.setTextColor(...colors.textLight);
         doc.setFont('helvetica', 'normal');
         doc.text(unit, x + colW/2, fieldsY + 10, { align: 'center' });
       };

       drawResult('Volume Medio', fmt(statsFixed.meanVolume), 'µl', 14);
       drawResult('Inaccuratezza', fmtPct(statsFixed.inaccuracy, nominalVolUl), '%', 14 + colW);
       // Removed SD
       drawResult('Incertezza (k=2)', fmtPct(statsFixed.uncertainty, nominalVolUl), '%', 14 + colW*2);

       doc.setDrawColor(...colors.divider);
       doc.line(14 + colW, fieldsY - 4, 14 + colW, fieldsY + 12);
       doc.line(14 + colW*2, fieldsY - 4, 14 + colW*2, fieldsY + 12);
       
       currentY += 45;
    }

  } else {
    // VARIABLE PIPETTE
    if (pdfOpts.includeCharts) {
      drawSectionTitle('Grafici Trend (Multi-Volume)', currentY);
      currentY += 8;

      if (currentY + 50 > doc.internal.pageSize.height) { doc.addPage(); currentY = 20; }
      
      const chartH = 60; 
      const tableW = 58;
      const margin = 8;
      
      // Pass target volumes
      drawChart(
          doc, `Volume Minimo (${targetMin} µl)`, statsMin.volumes, 
          14, currentY, tableW, chartH, colors.blue, targetMin, statsMin,
          pdfOpts.chartYMin, pdfOpts.chartYMax
      );
      drawChart(
          doc, `Volume Intermedio (${targetMid} µl)`, statsMid.volumes, 
          14 + tableW + margin, currentY, tableW, chartH, colors.accent, targetMid, statsMid,
          pdfOpts.chartYMin, pdfOpts.chartYMax
      );
      drawChart(
          doc, `Volume Massimo (${targetMax} µl)`, statsMax.volumes, 
          14 + (tableW + margin)*2, currentY, tableW, chartH, colors.primary, targetMax, statsMax,
          pdfOpts.chartYMin, pdfOpts.chartYMax
      );

      currentY += 70;
    } else {
      currentY += 10; 
    }

    if (currentY + 40 > doc.internal.pageSize.height) { doc.addPage(); currentY = 20; }
    
    drawSectionTitle('Riepilogo Prestazioni', currentY);
    currentY += 8;
    
    const hasLimits = data.toleranceSystematic !== '' && data.toleranceRandom !== '';
    const isCompliant = hasLimits ? (
      checkCompliance(statsMin, data.toleranceSystematic, data.toleranceRandom) &&
      checkCompliance(statsMid, data.toleranceSystematic, data.toleranceRandom) &&
      checkCompliance(statsMax, data.toleranceSystematic, data.toleranceRandom)
    ) : true;
    
    if (hasLimits) {
       doc.setFillColor(...(isCompliant ? colors.success : colors.fail));
       doc.roundedRect(14, currentY - 5, 48, 5, 1, 1, 'F');
       doc.setTextColor(255, 255, 255);
       doc.setFontSize(8); 
       doc.setFont('helvetica', 'bold');
       doc.text(isCompliant ? "Passed" : "Not Passed", 38, currentY - 1.5, { align: 'center' });
       
       currentY += 2;
    }

    const summaryData = [
        ['Volume Medio [µl]', fmt(statsMin.meanVolume), fmt(statsMid.meanVolume), fmt(statsMax.meanVolume)],
        ['Inaccuratezza (E) [%]', fmtPct(statsMin.inaccuracy, targetMin), fmtPct(statsMid.inaccuracy, targetMid), fmtPct(statsMax.inaccuracy, targetMax)],
        // Removed SD
        ['Incertezza (U, k=2) [%]', fmtPct(statsMin.uncertainty, targetMin), fmtPct(statsMid.uncertainty, targetMid), fmtPct(statsMax.uncertainty, targetMax)],
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['Parametro', 'Min', 'Mid', 'Max']],
        body: summaryData,
        ...tableTheme,
        margin: { left: 14, right: 14 },
        tableWidth: 'auto',
        headStyles: {
            ...tableTheme.headStyles,
            fillColor: colors.primary, 
            textColor: 255,
        },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: colors.textDark, cellWidth: 60 }
        }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- NOTES SECTION ---
  if (data.notes && data.notes.trim()) {
    if (currentY + 20 > doc.internal.pageSize.height - 30) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textLight);
    doc.text('NOTE E OSSERVAZIONI:', 14, currentY);
    
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.textDark);
    
    // Split text into rows to wrap
    const splitNotes = doc.splitTextToSize(data.notes, 182);
    doc.text(splitNotes, 14, currentY);
    
    currentY += (splitNotes.length * 5);
  }

  // --- FOOTER (Main Page) ---
  const pageHeight = doc.internal.pageSize.height;
  
  doc.setDrawColor(...colors.divider);
  doc.line(14, pageHeight - 25, 196, pageHeight - 25);

  doc.setFontSize(8);
  doc.setTextColor(...colors.textLight);
  
  // Operator
  doc.text('Operatore:', 14, pageHeight - 18);
  if (pdfOpts.operatorName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text(pdfOpts.operatorName, 30, pageHeight - 18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textLight);
  } else {
    doc.text('_______________________', 30, pageHeight - 18);
  }
  
  // Approver
  doc.text('Approvato da:', 100, pageHeight - 18);
  if (pdfOpts.approverName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.textDark);
    doc.text(pdfOpts.approverName, 122, pageHeight - 18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.textLight);
  } else {
    doc.text('_______________________', 122, pageHeight - 18);
  }

  doc.setFontSize(6);
  doc.setTextColor(200);
  doc.text('Generato con PipetteCal', 196, pageHeight - 10, { align: 'right' });

  doc.save(`certificato_${data.serialNumber || 'taratura'}.pdf`);
};
