
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalibrationData, PipetteType, CalculatedStats, StoredPipette, UiTheme } from '../types';

const fmt = (num: number | string | undefined, decimals = 4) => {
  if (num === '' || num === undefined || isNaN(Number(num))) return '-';
  return Number(num).toFixed(decimals);
};

const parseNominal = (val: string): number => {
  const match = val.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

type ColorTuple = [number, number, number];

interface ThemeColors {
  primary: ColorTuple;
  accent: ColorTuple;
  textDark: ColorTuple;
  textLight: ColorTuple;
  divider: ColorTuple;
  success: ColorTuple;
  fail: ColorTuple;
}

const BASE_THEMES: Record<string, ThemeColors> = {
  violet: { primary: [76, 29, 149], accent: [124, 58, 237], textDark: [15, 23, 42], textLight: [100, 116, 139], divider: [226, 232, 240], success: [22, 163, 74], fail: [220, 38, 38] },
  teal: { primary: [13, 148, 136], accent: [20, 184, 166], textDark: [17, 24, 39], textLight: [107, 114, 128], divider: [229, 231, 235], success: [5, 150, 105], fail: [220, 38, 38] },
  sky: { primary: [2, 132, 199], accent: [14, 165, 233], textDark: [17, 24, 39], textLight: [107, 114, 128], divider: [229, 231, 235], success: [5, 150, 105], fail: [220, 38, 38] },
  blue: { primary: [30, 58, 138], accent: [37, 99, 235], textDark: [17, 24, 39], textLight: [107, 114, 128], divider: [229, 231, 235], success: [5, 150, 105], fail: [220, 38, 38] }
};

const getThemeColors = (theme: string = 'violet'): ThemeColors => BASE_THEMES[theme] || BASE_THEMES.violet;

/**
 * Disegna l'intestazione premium con il nuovo logo "2S" e nome azienda
 */
const drawHeader = (doc: jsPDF, colors: ThemeColors, title: string) => {
  const x = 14;
  const y = 15;

  // Logo "2S" Stilizzato (Design geometrico premium)
  doc.setFillColor(...colors.primary);
  doc.roundedRect(x, y, 14, 14, 3, 3, 'F');
  
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.8);
  doc.roundedRect(x + 2, y + 2, 14, 14, 3, 3, 'S');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2S', x + 7, y + 9.5, { align: 'center' });

  // Nome Azienda: Strumentazione & Servizi
  doc.setTextColor(...colors.textDark);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STRUMENTAZIONE & SERVIZI', x + 20, y + 7);
  
  doc.setTextColor(...colors.textLight);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SOLUZIONI AVANZATE PER IL LABORATORIO', x + 20, y + 12);

  // Titolo Documento
  doc.setTextColor(...colors.accent);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 196, y + 9.5, { align: 'right' });

  // Linea divisoria
  doc.setDrawColor(...colors.divider);
  doc.setLineWidth(0.3);
  doc.line(x, y + 18, 196, y + 18);

  return y + 28;
};

const calculateStats = (measurements: (number | '')[], zFactor: number, nominalVolUl: number): CalculatedStats => {
  const valid = measurements.filter((m): m is number => typeof m === 'number');
  if (valid.length === 0) return { meanMass: 0, meanVolume: 0, count: 0, sd: 0, inaccuracy: 0, uncertainty: 0, volumes: [] };
  const meanMass = valid.reduce((a, b) => a + b, 0) / valid.length;
  const volumes = valid.map(m => m * zFactor);
  const meanVolume = meanMass * zFactor;
  const sd = Math.sqrt(valid.length > 1 ? volumes.map(v => Math.pow(v - meanVolume, 2)).reduce((a, b) => a + b, 0) / (valid.length - 1) : 0);
  return { meanMass, meanVolume, count: valid.length, volumes, sd, inaccuracy: nominalVolUl > 0 ? meanVolume - nominalVolUl : 0, uncertainty: 2 * sd };
};

const drawStatsCard = (doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, unit: string, colors: ThemeColors, tolUsage?: number) => {
  doc.setFillColor(252, 252, 252); doc.setDrawColor(230, 230, 230); doc.roundedRect(x, y, w, h, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.text(label.toUpperCase(), x + 4, y + 8);
  doc.setFontSize(11); doc.setTextColor(40, 40, 40); doc.text(value, x + 4, y + 20);
  const valWidth = doc.getTextWidth(value);
  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text(unit, x + 4 + valWidth + 1, y + 20);
  if (tolUsage !== undefined) {
    doc.setFillColor(240, 240, 240); doc.rect(x + 4, y + 26, w - 8, 1.5, 'F');
    const fillCol = tolUsage > 100 ? colors.fail : tolUsage > 80 ? [245, 158, 11] as ColorTuple : colors.success;
    doc.setFillColor(...fillCol); doc.rect(x + 4, y + 26, Math.min(w - 8, (tolUsage / 100) * (w - 8)), 1.5, 'F');
  }
};

const drawStatsDashboard = (doc: jsPDF, curY: number, stats: CalculatedStats, nominalVol: number, tolSys: number | '', tolRand: number | '', colors: ThemeColors, title: string) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...colors.primary); doc.text(title.toUpperCase(), 14, curY);
  const startY = curY + 4, cardW = 35, cardH = 32, gap = 2;
  drawStatsCard(doc, 14, startY, cardW, cardH, "Vol. Medio", fmt(stats.meanVolume, 3), "µl", colors);
  drawStatsCard(doc, 14 + (cardW + gap), startY, cardW, cardH, "Err. Sist. (E)", fmt(stats.inaccuracy, 3), "µl", colors, tolSys ? (Math.abs(stats.inaccuracy) / tolSys) * 100 : undefined);
  drawStatsCard(doc, 14 + (cardW + gap) * 2, startY, cardW, cardH, "Err. Rel. (E%)", fmt(nominalVol > 0 ? (stats.inaccuracy/nominalVol)*100 : 0, 2), "%", colors);
  drawStatsCard(doc, 14 + (cardW + gap) * 3, startY, cardW, cardH, "Imprec. (SD)", fmt(stats.sd, 4), "µl", colors, tolRand ? (stats.sd / tolRand) * 100 : undefined);
  drawStatsCard(doc, 14 + (cardW + gap) * 4, startY, cardW, cardH, "Incert. (k=2)", fmt(stats.uncertainty, 3), "µl", colors);
  return startY + cardH + 10;
};

export const createCalibrationPDF = (data: CalibrationData, returnBlob = false): any => {
  const doc = new jsPDF();
  const themeKey = data.uiTheme || 'violet';
  const colors = getThemeColors(themeKey);
  const zFactor = Number(data.zFactor) || 1.0;
  let nominalVolUl = parseNominal(data.nominalVolume); if (data.nominalVolumeUnit === 'ml') nominalVolUl *= 1000;

  let curY = drawHeader(doc, colors, "Certificato di Taratura");

  const drawField = (label: string, value: string, x: number, y: number, w: number) => {
    doc.setFillColor(248, 250, 252); doc.rect(x, y, w, 12, 'F');
    doc.setFontSize(6); doc.setTextColor(120, 120, 120); doc.text(label.toUpperCase(), x + 2, y + 4);
    doc.setFontSize(9); doc.setTextColor(40, 40, 40); doc.text(value || '-', x + 2, y + 10);
  };

  const colW = 45;
  drawField('Costruttore', data.manufacturer, 14, curY, colW);
  drawField('Modello', data.model, 14 + colW + 2, curY, colW);
  drawField('Matricola', data.serialNumber, 14 + (colW + 2) * 2, curY, colW);
  drawField('Volume Nominale', `${data.nominalVolume} ${data.nominalVolumeUnit}`, 14 + (colW + 2) * 3, curY, colW);

  curY += 16;
  drawField('Data Test', data.testDate, 14, curY, colW);
  drawField('Temp. Ambiente', `${data.temperature} °C`, 14 + colW + 2, curY, colW);
  drawField('Pressione', `${data.pressure} hPa`, 14 + (colW + 2) * 2, curY, colW);
  drawField('Fattore Z', fmt(data.zFactor, 5), 14 + (colW + 2) * 3, curY, colW);

  curY += 25;
  if (data.type === PipetteType.FIXED) {
    const statsFixed = calculateStats(data.measurementsFixed, zFactor, nominalVolUl);
    curY = drawStatsDashboard(doc, curY, statsFixed, nominalVolUl, data.toleranceSystematic, data.toleranceRandom, colors, "Sintesi dei Risultati");
  } else {
    const statsMin = calculateStats(data.measurementsVarMin, zFactor, nominalVolUl * 0.1);
    const statsMid = calculateStats(data.measurementsVarMid, zFactor, nominalVolUl * 0.5);
    const statsMax = calculateStats(data.measurementsVarMax, zFactor, nominalVolUl);
    curY = drawStatsDashboard(doc, curY, statsMin, nominalVolUl * 0.1, data.toleranceSystematic, data.toleranceRandom, colors, "Volume Minimo (10%)");
    curY = drawStatsDashboard(doc, curY, statsMid, nominalVolUl * 0.5, data.toleranceSystematic, data.toleranceRandom, colors, "Volume Medio (50%)");
    curY = drawStatsDashboard(doc, curY, statsMax, nominalVolUl, data.toleranceSystematic, data.toleranceRandom, colors, "Volume Massimo (100%)");
  }

  doc.setFontSize(7); doc.setTextColor(150); doc.text("2S - Strumentazione & Servizi. Protocollo ISO 8655.", 14, 285);
  if (returnBlob) return doc.output('bloburl');
  doc.save(`cert_${data.serialNumber || 'instrument'}.pdf`);
};

export const generatePDF = (data: CalibrationData) => createCalibrationPDF(data, false);
export const getPDFPreviewURL = (data: CalibrationData) => createCalibrationPDF(data, true);

export const generateClientListPDF = (clientName: string, pipettes: StoredPipette[], uiTheme: UiTheme = 'violet') => {
  const doc = new jsPDF();
  const colors = getThemeColors(uiTheme);

  let curY = drawHeader(doc, colors, "Elenco Strumentazione");

  doc.setFontSize(10);
  doc.setTextColor(...colors.textDark);
  doc.text(`CLIENTE: ${clientName.toUpperCase()}`, 14, curY);
  doc.setFontSize(8);
  doc.setTextColor(...colors.textLight);
  doc.text(`Estratto il: ${new Date().toLocaleDateString('it-IT')}`, 14, curY + 6);

  const tableData = pipettes.map(p => [
    p.manufacturer || '-',
    p.model || '-',
    p.serial_number || '-',
    p.nominal_volume || '-',
    new Date(p.last_calibrated).toLocaleDateString('it-IT')
  ]);

  autoTable(doc, {
    startY: curY + 12,
    head: [['COSTRUTTORE', 'MODELLO', 'MATRICOLA (S/N)', 'VOLUME', 'DATA TARATURA']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 4 },
    columnStyles: { 2: { fontStyle: 'bold' } }
  });

  doc.save(`elenco_${clientName.replace(/\s/g, '_').toLowerCase()}.pdf`);
};
