
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
    if (isNaN(d.getTime())) return dateStr; 
    return d.toLocaleDateString('it-IT');
  } catch (e) {
    return dateStr || '-';
  }
};

const parseNominal = (val: string): number => {
  const match = val.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] 
    : [0, 0, 0];
};

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

const BASE_THEMES: Record<Exclude<PdfTheme, 'custom'>, ThemeColors> = {
  default: {
    primary: [76, 29, 149], accent: [124, 58, 237], blue: [59, 130, 246],
    textDark: [15, 23, 42], textMed: [51, 65, 85], textLight: [100, 116, 139],
    divider: [226, 232, 240], bgLight: [248, 250, 252], success: [22, 163, 74], fail: [220, 38, 38]
  },
  blue: {
    primary: [30, 58, 138], accent: [37, 99, 235], blue: [96, 165, 250],
    textDark: [17, 24, 39], textMed: [55, 65, 81], textLight: [107, 114, 128],
    divider: [229, 231, 235], bgLight: [249, 250, 251], success: [5, 150, 105], fail: [220, 38, 38]
  },
  grayscale: {
    primary: [30, 30, 30], accent: [80, 80, 80], blue: [150, 150, 150],
    textDark: [0, 0, 0], textMed: [60, 60, 60], textLight: [100, 100, 100],
    divider: [200, 200, 200], bgLight: [250, 250, 250], success: [80, 80, 80], fail: [0, 0, 0]
  }
};

const getTheme = (options: PdfOptions): ThemeColors => {
  if (options.colorTheme === 'custom' && options.customPrimaryColor) {
    const primary = hexToRgb(options.customPrimaryColor);
    const accent = options.customSecondaryColor ? hexToRgb(options.customSecondaryColor) : primary;
    const bgLight: ColorTuple = [Math.min(255, primary[0] + 240), Math.min(255, primary[1] + 240), Math.min(255, primary[2] + 240)];
    return { primary, accent, blue: accent, textDark: [20, 20, 20], textMed: [60, 60, 60], textLight: [100, 100, 100], divider: [220, 220, 220], bgLight, success: [22, 163, 74], fail: [220, 38, 38] };
  }
  return BASE_THEMES[options.colorTheme as keyof typeof BASE_THEMES] || BASE_THEMES.default;
};

const drawChart = (doc: jsPDF, title: string, data: number[], startX: number, startY: number, width: number, height: number, color: [number, number, number], targetVolume: number, stats?: { meanVolume: number, sd: number }, manualYMin?: number | '', manualYMax?: number | '') => {
  if (data.length === 0) return;
  const chartX = startX + 10;
  const chartY = startY + 8; 
  const chartW = width - 15;
  const chartH = height - 15;

  doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'bold');
  doc.text(title, startX, startY + 3);

  let yMin: number, yMax: number;
  if (manualYMin !== '' && manualYMin !== undefined && manualYMax !== '' && manualYMax !== undefined) {
    yMin = Number(manualYMin); yMax = Number(manualYMax);
  } else {
    let pts = [...data];
    if (targetVolume > 0) pts.push(targetVolume);
    if (stats) { pts.push(stats.meanVolume); pts.push(stats.meanVolume + (2 * stats.sd)); pts.push(stats.meanVolume - (2 * stats.sd)); }
    pts = pts.filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n));
    if (pts.length === 0) { yMin = 0; yMax = 10; } else {
      let minVal = Math.min(...pts), maxVal = Math.max(...pts);
      let span = maxVal - minVal;
      if (span === 0) { const b = maxVal === 0 ? 1 : Math.abs(maxVal * 0.05); minVal -= b; maxVal += b; span = maxVal - minVal; }
      const minAbs = (targetVolume > 0 ? targetVolume : 100) * 0.01;
      if (span < minAbs) { const c = (minVal + maxVal) / 2; minVal = c - (minAbs/2); maxVal = c + (minAbs/2); span = minAbs; }
      const pad = span * 0.15; yMin = minVal - pad; yMax = maxVal + pad;
    }
  }

  const range = yMax - yMin;
  const mapY = (v: number) => range === 0 ? chartY + (chartH/2) : (chartY + chartH) - (((v - yMin) / range) * chartH);

  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.1); doc.setLineDashPattern([1, 1], 0);
  for (let i = 0; i <= 5; i++) {
    const frac = i / 5; const yp = (chartY + chartH) - (frac * chartH); const lv = yMin + (frac * range);
    doc.line(chartX, yp, chartX + chartW, yp);
    doc.setFontSize(5); doc.text(lv.toFixed(2), chartX - 2, yp + 1, { align: 'right' });
  }
  doc.setLineDashPattern([], 0);

  if (stats && stats.sd > 0) {
    const up = mapY(stats.meanVolume + 2*stats.sd); const lo = mapY(stats.meanVolume - 2*stats.sd);
    doc.setFillColor(color[0], color[1], color[2], 0.1);
    doc.rect(chartX, up, chartW, Math.abs(lo - up), 'F');
  }

  const ty = mapY(targetVolume);
  if (ty >= chartY && ty <= chartY + chartH) { doc.setDrawColor(50); doc.setLineWidth(0.3); doc.setLineDashPattern([3, 2], 0); doc.line(chartX, ty, chartX + chartW, ty); doc.setLineDashPattern([], 0); }

  if (data.length > 0) {
    doc.setDrawColor(...color); doc.setLineWidth(0.5);
    const xs = chartW / (data.length > 1 ? data.length - 1 : 1);
    data.forEach((v, i) => {
      const x = chartX + (i * xs); const y = mapY(v);
      if (i > 0) doc.line(chartX + (i-1)*xs, mapY(data[i-1]), x, y);
      doc.setFillColor(...color); doc.circle(x, y, 1, 'F');
    });
  }
};

export const createCalibrationPDF = (data: CalibrationData, returnBlob = false): any => {
  const doc = new jsPDF();
  const zFactor = Number(data.zFactor) || 1.0;
  const pdfOpts = data.pdfOptions || { includeCharts: true, colorTheme: 'default', operatorName: '', approverName: '' };
  const colors = getTheme(pdfOpts);

  let nominalVolUl = parseNominal(data.nominalVolume);
  if (data.nominalVolumeUnit === 'ml') nominalVolUl *= 1000;

  // Header
  doc.setFillColor(...colors.primary); doc.rect(0, 0, 210, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(32); doc.setTextColor(50); doc.text('2S', 14, 22);
  doc.setFontSize(18); doc.setTextColor(...colors.textDark); doc.text('CERTIFICATO DI TARATURA', 60, 16);
  doc.setFontSize(9); doc.setTextColor(...colors.accent); doc.text('PIPETTE CALIBRATION REPORT', 60, 21);

  let curY = 40;
  const drawF = (l: string, v: string, x: number, y: number) => {
    doc.setFontSize(7); doc.setTextColor(...colors.textLight); doc.text(l.toUpperCase(), x, y);
    doc.setFontSize(9); doc.setTextColor(...colors.textDark); doc.text(v, x, y + 5);
  };

  const cw = 48;
  drawF('Costruttore', data.manufacturer || '-', 14, curY);
  drawF('Modello', data.model || '-', 14 + cw, curY);
  drawF('Matricola', data.serialNumber || '-', 14 + cw*2, curY);
  drawF('Volume', `${data.nominalVolume} ${data.nominalVolumeUnit}`, 14 + cw*3, curY);

  curY += 25;
  const statsFixed = calculateStats(data.measurementsFixed, zFactor, nominalVolUl);
  const targetMin = nominalVolUl * 0.1, targetMid = nominalVolUl * 0.5, targetMax = nominalVolUl;
  const statsMin = calculateStats(data.measurementsVarMin, zFactor, targetMin);
  const statsMid = calculateStats(data.measurementsVarMid, zFactor, targetMid);
  const statsMax = calculateStats(data.measurementsVarMax, zFactor, targetMax);

  if (data.type === PipetteType.FIXED) {
    if (pdfOpts.includeCharts) drawChart(doc, "Grafico Stabilità", statsFixed.volumes, 14, curY, 182, 60, colors.accent, nominalVolUl, statsFixed);
    curY += 75;
    autoTable(doc, { startY: curY, head: [['Parametro', 'Risultato']], body: [['Volume Medio', fmt(statsFixed.meanVolume) + ' µl'], ['Inaccuratezza', fmtPct(statsFixed.inaccuracy, nominalVolUl) + ' %'], ['Incertezza (k=2)', fmtPct(statsFixed.uncertainty, nominalVolUl) + ' %']], theme: 'grid', headStyles: { fillColor: colors.primary } });
  } else {
    autoTable(doc, { startY: curY, head: [['Volume', 'Media (µl)', 'E (%)', 'U (%)']], body: [[`Min (${targetMin})`, fmt(statsMin.meanVolume), fmtPct(statsMin.inaccuracy, targetMin), fmtPct(statsMin.uncertainty, targetMin)], [`Mid (${targetMid})`, fmt(statsMid.meanVolume), fmtPct(statsMid.inaccuracy, targetMid), fmtPct(statsMid.uncertainty, targetMid)], [`Max (${targetMax})`, fmt(statsMax.meanVolume), fmtPct(statsMax.inaccuracy, targetMax), fmtPct(statsMax.uncertainty, targetMax)]], theme: 'grid', headStyles: { fillColor: colors.primary } });
  }

  if (returnBlob) return doc.output('bloburl');
  doc.save(`certificato_${data.serialNumber || 'pipetta'}.pdf`);
};

export const generatePDF = (data: CalibrationData) => createCalibrationPDF(data, false);
export const getPDFPreviewURL = (data: CalibrationData) => createCalibrationPDF(data, true);
export const generateClientListPDF = (n: string, p: StoredPipette[]) => { /* ... remain unchanged ... */ };
export const generateLabelsPDF = (d: string, c: number) => { /* ... remain unchanged ... */ };
