
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

const drawHeader = (doc: jsPDF, colors: ThemeColors, title: string) => {
  const x = 14, y = 15;
  doc.setFillColor(...colors.primary); doc.roundedRect(x, y, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('2S', x + 7, y + 9.5, { align: 'center' });
  doc.setTextColor(...colors.textDark); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('STRUMENTAZIONE & SERVIZI', x + 20, y + 7);
  doc.setTextColor(...colors.textLight); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text('SOLUZIONI AVANZATE PER IL LABORATORIO', x + 20, y + 12);
  doc.setTextColor(...colors.accent); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(title.toUpperCase(), 196, y + 9.5, { align: 'right' });
  doc.setDrawColor(...colors.divider); doc.setLineWidth(0.3); doc.line(x, y + 18, 196, y + 18);
  return y + 28;
};

const calculateStats = (measurements: (number | '')[], zFactor: number, nominalVolUl: number): CalculatedStats => {
  const valid = measurements.filter((m): m is number => typeof m === 'number' && m > 0);
  if (valid.length === 0) return { meanMass: 0, meanVolume: 0, count: 0, sd: 0, inaccuracy: 0, uncertainty: 0, volumes: [] };
  const meanMass = valid.reduce((a, b) => a + b, 0) / valid.length;
  const volumes = valid.map(m => m * zFactor);
  const meanVolume = meanMass * zFactor;
  const sd = Math.sqrt(valid.length > 1 ? volumes.map(v => Math.pow(v - meanVolume, 2)).reduce((a, b) => a + b, 0) / (valid.length - 1) : 0);
  return { meanMass, meanVolume, count: valid.length, volumes, sd, inaccuracy: nominalVolUl > 0 ? meanVolume - nominalVolUl : 0, uncertainty: 2 * sd };
};

const drawPdfChart = (doc: jsPDF, x: number, y: number, w: number, h: number, stats: CalculatedStats, target: number, tol: number | '', colors: ThemeColors) => {
  const volumes = stats.volumes;
  if (volumes.length === 0) return;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(x, y, w, h, 'FD');

  const padding = 12;
  const chartW = w - padding * 2;
  const chartH = h - padding * 2;
  const startX = x + padding;
  const startY = y + padding;

  const sysTol = Number(tol) || target * 0.05;
  const minVal = Math.min(...volumes, target - sysTol) - (sysTol * 0.5);
  const maxVal = Math.max(...volumes, target + sysTol) + (sysTol * 0.5);
  const range = maxVal - minVal;

  const getX = (i: number) => startX + (i * chartW / 9);
  const getY = (v: number) => startY + chartH - ((v - minVal) / range * chartH);

  // Grid
  doc.setDrawColor(240, 240, 240);
  [target - sysTol, target, target + sysTol].forEach(v => {
    doc.line(startX, getY(v), startX + chartW, getY(v));
    // Fixed: Explicitly convert result of toFixed to string to satisfy jsPDF types
    doc.setFontSize(5); doc.setTextColor(150, 150, 150); doc.text(v.toFixed(2).toString(), startX - 2, getY(v) + 1, { align: 'right' });
  });

  // Limits
  doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.2); doc.setLineDashPattern([1, 1], 0);
  doc.line(startX, getY(target + sysTol), startX + chartW, getY(target + sysTol));
  doc.line(startX, getY(target - sysTol), startX + chartW, getY(target - sysTol));
  
  // Nominal
  doc.setDrawColor(...colors.primary); doc.setLineWidth(0.3); doc.setLineDashPattern([2, 2], 0);
  doc.line(startX, getY(target), startX + chartW, getY(target));
  doc.setLineDashPattern([], 0);

  // Data
  doc.setDrawColor(...colors.accent); doc.setLineWidth(0.6);
  for (let i = 0; i < volumes.length - 1; i++) {
    doc.line(getX(i), getY(volumes[i]), getX(i + 1), getY(volumes[i + 1]));
  }
  doc.setFillColor(...colors.accent);
  volumes.forEach((v, i) => doc.circle(getX(i), getY(v), 0.7, 'F'));
};

const drawStatsDashboard = (doc: jsPDF, curY: number, stats: CalculatedStats, targetVol: number, tolSys: number | '', tolRand: number | '', colors: ThemeColors, title: string) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...colors.primary); doc.text(title.toUpperCase(), 14, curY);
  const startY = curY + 4, cardW = 35, cardH = 32, gap = 2;
  
  const drawCard = (x: number, label: string, val: string, unit: string, tol?: number, cur?: number) => {
    doc.setFillColor(252, 252, 252); doc.setDrawColor(230, 230, 230); doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(6); doc.setTextColor(150, 150, 150); doc.text(label.toUpperCase(), x + 3, startY + 6);
    doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.text(String(val), x + 3, startY + 18);
    doc.setFontSize(6); doc.text(String(unit), x + 3 + doc.getTextWidth(String(val)) + 1, startY + 18);
    if (tol && cur !== undefined) {
      doc.setFillColor(240, 240, 240); doc.rect(x + 3, startY + 25, cardW - 6, 1.5, 'F');
      const usage = Math.min(100, (Math.abs(cur)/tol)*100);
      doc.setFillColor(...(usage > 100 ? colors.fail : colors.success));
      doc.rect(x + 3, startY + 25, (usage/100)*(cardW-6), 1.5, 'F');
    }
  };

  drawCard(14, "Media", fmt(stats.meanVolume, 3), "µl");
  drawCard(14 + (cardW+gap), "Err. Sist.", fmt(stats.inaccuracy, 3), "µl", Number(tolSys), stats.inaccuracy);
  drawCard(14 + (cardW+gap)*2, "Err. Rel.", fmt(targetVol > 0 ? (stats.inaccuracy/targetVol)*100 : 0, 2), "%");
  drawCard(14 + (cardW+gap)*3, "SD", fmt(stats.sd, 4), "µl", Number(tolRand), stats.sd);
  drawCard(14 + (cardW+gap)*4, "Incertezza", fmt(stats.uncertainty, 3), "µl");

  drawPdfChart(doc, 14, startY + cardH + 4, 183, 30, stats, targetVol, tolSys, colors);
  return startY + cardH + 44;
};

export const generatePipetteLabelPDF = (pipette: StoredPipette) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
  const theme = getThemeColors(pipette.full_data.uiTheme);
  
  // Header / Logo
  doc.setFillColor(...theme.primary); doc.roundedRect(2, 2, 6, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.text('2S', 5, 6, { align: 'center' });
  doc.setTextColor(0, 0, 0); doc.setFontSize(6); doc.text('CERTIFICATO TARATURA', 10, 6);
  
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1); doc.line(2, 9, 48, 9);
  
  // Info
  doc.setFontSize(5); doc.setTextColor(120, 120, 120); doc.text('S/N MATRICOLA:', 2, 13);
  doc.setFontSize(8); doc.setTextColor(0, 0, 0); doc.text(pipette.serial_number.toUpperCase(), 2, 17);
  
  doc.setFontSize(5); doc.setTextColor(120, 120, 120); doc.text('VOLUME:', 30, 13);
  doc.setFontSize(7); doc.setTextColor(0, 0, 0); doc.text(pipette.nominal_volume, 30, 17);

  doc.setFontSize(5); doc.setTextColor(120, 120, 120); doc.text('DATA TARATURA:', 2, 22);
  doc.setFontSize(6); doc.setTextColor(0, 0, 0); doc.text(new Date(pipette.last_calibrated).toLocaleDateString('it-IT'), 2, 26);

  const nextCal = new Date(pipette.last_calibrated);
  nextCal.setMonth(nextCal.getMonth() + (pipette.full_data.calibrationFrequencyMonths || 12));
  
  doc.setFontSize(5); doc.setTextColor(120, 120, 120); doc.text('PROSSIMA SCADENZA:', 30, 22);
  doc.setFontSize(7); doc.setTextColor(...theme.primary); doc.text(nextCal.toLocaleDateString('it-IT'), 30, 26);
  
  doc.save(`label_${pipette.serial_number}.pdf`);
};

export const createCalibrationPDF = (data: CalibrationData, returnBlob = false): any => {
  const doc = new jsPDF();
  const theme = getThemeColors(data.uiTheme);
  const z = Number(data.zFactor) || 1.0;
  let nomVol = parseNominal(data.nominalVolume); if (data.nominalVolumeUnit === 'ml') nomVol *= 1000;

  let curY = drawHeader(doc, theme, "Certificato di Taratura");
  
  const drawRow = (y: number, fields: {l: string, v: string}[]) => {
    const w = 183 / fields.length;
    fields.forEach((f, i) => {
      const x = 14 + (i * w);
      doc.setFillColor(248, 248, 248); doc.rect(x, y, w - 1, 10, 'F');
      doc.setFontSize(5); doc.setTextColor(150, 150, 150); doc.text(f.l.toUpperCase(), x + 2, y + 3);
      doc.setFontSize(8); doc.setTextColor(40, 40, 40); doc.text(String(f.v || '-'), x + 2, y + 8);
    });
  };

  // Fixed: Explicitly convert potential non-string values to strings for drawRow fields
  drawRow(curY, [{l: 'Costruttore', v: String(data.manufacturer)}, {l: 'Modello', v: String(data.model)}, {l: 'S/N', v: String(data.serialNumber)}, {l: 'Vol. Nominale', v: `${data.nominalVolume} ${data.nominalVolumeUnit}`}]);
  curY += 12;
  drawRow(curY, [{l: 'Data Test', v: String(data.testDate)}, {l: 'Temp (°C)', v: String(data.temperature)}, {l: 'Pres (hPa)', v: String(data.pressure)}, {l: 'Fattore Z', v: fmt(z, 5)}]);
  curY += 20;

  if (data.type === PipetteType.FIXED) {
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsFixed, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Risultati");
  } else {
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMin, z, nomVol*0.1), nomVol*0.1, data.toleranceSystematic, data.toleranceRandom, theme, "Volume 10%");
    if (curY > 240) { doc.addPage(); curY = 25; }
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMid, z, nomVol*0.5), nomVol*0.5, data.toleranceSystematic, data.toleranceRandom, theme, "Volume 50%");
    if (curY > 240) { doc.addPage(); curY = 25; }
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMax, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Volume 100%");
  }

  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text("Generato da PipetteCal 2S - Conformità ISO 8655-6", 14, 285);
  return returnBlob ? doc.output('bloburl') : doc.save(`cert_${data.serialNumber}.pdf`);
};

export const generatePDF = (data: CalibrationData) => createCalibrationPDF(data);
export const getPDFPreviewURL = (data: CalibrationData) => createCalibrationPDF(data, true);

export const generateClientListPDF = (clientName: string, pipettes: StoredPipette[], uiTheme: UiTheme = 'violet') => {
  const doc = new jsPDF();
  const theme = getThemeColors(uiTheme);
  let curY = drawHeader(doc, theme, "Elenco Strumentazione");
  doc.setFontSize(10); doc.text(`CLIENTE: ${clientName.toUpperCase()}`, 14, curY);
  autoTable(doc, { 
    startY: curY + 10, 
    head: [['S/N', 'MODELLO', 'VOLUME', 'ULTIMA TARATURA']], 
    body: pipettes.map(p => [p.serial_number, p.model, p.nominal_volume, new Date(p.last_calibrated).toLocaleDateString()]),
    headStyles: { fillColor: theme.primary }
  });
  doc.save(`elenco_${clientName}.pdf`);
};
