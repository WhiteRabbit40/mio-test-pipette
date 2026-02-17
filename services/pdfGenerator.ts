
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
  violet: { primary: [76, 29, 149], accent: [124, 58, 237], textDark: [15, 23, 42], textLight: [51, 65, 85], divider: [203, 213, 225], success: [22, 163, 74], fail: [220, 38, 38] },
  teal: { primary: [13, 148, 136], accent: [20, 184, 166], textDark: [17, 24, 39], textLight: [51, 65, 85], divider: [203, 213, 225], success: [5, 150, 105], fail: [220, 38, 38] },
  sky: { primary: [2, 132, 199], accent: [14, 165, 233], textDark: [17, 24, 39], textLight: [51, 65, 85], divider: [203, 213, 225], success: [5, 150, 105], fail: [220, 38, 38] },
  blue: { primary: [30, 58, 138], accent: [37, 99, 235], textDark: [17, 24, 39], textLight: [51, 65, 85], divider: [203, 213, 225], success: [5, 150, 105], fail: [220, 38, 38] }
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
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.1);
  doc.rect(x, y, w, h, 'FD');

  const paddingL = 24;
  const paddingR = 12;
  const paddingT = 18;
  const paddingB = 18;
  const chartW = w - (paddingL + paddingR);
  const chartH = h - (paddingT + paddingB);
  const startX = x + paddingL;
  const startY = y + paddingT;

  const sysTol = Number(tol) || target * 0.05;
  const dataMin = Math.min(...volumes);
  const dataMax = Math.max(...volumes);
  const displayRange = Math.max(sysTol * 2.2, (dataMax - dataMin) * 2.5);
  const minVal = target - (displayRange / 2);
  const maxVal = target + (displayRange / 2);
  const range = maxVal - minVal;

  const getX = (i: number) => startX + (i * chartW / 9);
  const getY = (v: number) => startY + chartH - ((v - minVal) / (range || 1) * chartH);

  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.05);
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const v = minVal + (i * range / steps);
    const py = getY(v);
    doc.line(startX, py, startX + chartW, py);
    doc.setFontSize(7.5); 
    doc.setTextColor(140, 140, 140);
    doc.text(v.toFixed(3).toString(), startX - 2, py + 1, { align: 'right' });
  }

  const u2sd = stats.meanVolume + (2 * stats.sd);
  const l2sd = stats.meanVolume - (2 * stats.sd);
  doc.setFillColor(...colors.accent);
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  const rectTop = getY(Math.min(maxVal, u2sd));
  const rectBottom = getY(Math.max(minVal, l2sd));
  doc.rect(startX, rectTop, chartW, Math.abs(rectBottom - rectTop), 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setDrawColor(...colors.fail); doc.setLineWidth(0.4); doc.setLineDashPattern([1.5, 1], 0);
  doc.line(startX, getY(target + sysTol), startX + chartW, getY(target + sysTol));
  doc.line(startX, getY(target - sysTol), startX + chartW, getY(target - sysTol));
  
  doc.setDrawColor(...colors.primary); doc.setLineWidth(0.3); doc.setLineDashPattern([3, 2], 0);
  doc.line(startX, getY(target), startX + chartW, getY(target));
  doc.setLineDashPattern([], 0);

  doc.setDrawColor(...colors.primary); doc.setLineWidth(1.1);
  for (let i = 0; i < volumes.length - 1; i++) {
    doc.line(getX(i), getY(volumes[i]), getX(i + 1), getY(volumes[i + 1]));
  }
  
  volumes.forEach((v, i) => {
    doc.setFillColor(...colors.primary); doc.circle(getX(i), getY(v), 1.0, 'F');
    doc.setFillColor(255, 255, 255); doc.circle(getX(i), getY(v), 0.35, 'F');
  });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...colors.textDark);
  doc.text("ANALISI PERFORMANCE VOLUMETRICA (µl)", startX, startY - 6);
  
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...colors.textLight);
  doc.text(`Area Evidenziata: Incertezza Estesa (k=2, 95% conf.) | Linee Rosse: Limiti ISO 8655`, startX, startY + chartH + 10);
};

const drawStatsDashboard = (doc: jsPDF, curY: number, stats: CalculatedStats, targetVol: number, tolSys: number | '', tolRand: number | '', colors: ThemeColors, title: string): boolean => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...colors.primary); doc.text(title.toUpperCase(), 14, curY);
  const startY = curY + 4, cardW = 35, cardH = 36, gap = 2; 
  
  const inaccuracy = stats.meanVolume - targetVol;
  const isPassSys = tolSys === '' ? true : Math.abs(inaccuracy) <= tolSys;
  const isPassRand = tolRand === '' ? true : stats.sd <= tolRand;

  const drawCard = (x: number, label: string, val: string, unit: string, tol?: number, cur?: number) => {
    doc.setFillColor(252, 252, 252); doc.setDrawColor(200, 200, 200); doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(8.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 3, startY + 8);
    doc.setFontSize(11.5); doc.setTextColor(10, 10, 10); doc.setFont('helvetica', 'bold');
    const valText = String(val);
    doc.text(valText, x + 3, startY + 20);
    const valWidth = doc.getTextWidth(valText);
    doc.setFontSize(9.5); doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal');
    doc.text(unit, x + 3 + valWidth + 1.8, startY + 20);

    if (tol && cur !== undefined) {
      doc.setFillColor(230, 230, 230); doc.rect(x + 3, startY + 28, cardW - 6, 2.2, 'F');
      const usage = Math.min(100, (Math.abs(cur)/tol)*100);
      doc.setFillColor(...(usage > 100 ? colors.fail : colors.success));
      doc.rect(x + 3, startY + 28, (usage/100)*(cardW-6), 2.2, 'F');
    }
  };

  drawCard(14, "Volume Medio", fmt(stats.meanVolume, 3), "µl");
  drawCard(14 + (cardW+gap), "Errore Sist.", fmt(inaccuracy, 3), "µl", Number(tolSys), inaccuracy);
  drawCard(14 + (cardW+gap)*2, "Err. Relat.", fmt(targetVol > 0 ? (inaccuracy/targetVol)*100 : 0, 2), "%");
  drawCard(14 + (cardW+gap)*3, "SD (Ripet.)", fmt(stats.sd, 4), "µl", Number(tolRand), stats.sd);
  drawCard(14 + (cardW+gap)*4, "Incertezza", fmt(stats.uncertainty, 3), "µl");

  drawPdfChart(doc, 14, startY + cardH + 7, 183, 88, stats, targetVol, tolSys, colors);
  return isPassSys && isPassRand;
};

export const generateLabelsSheetPDF = (count: number, date: string, frequencyMonths: number, themeKey: UiTheme = 'violet') => {
  const doc = new jsPDF();
  const colors = getThemeColors(themeKey);
  const labelW = 60;
  const labelH = 14; 
  const marginX = 15;
  const marginY = 15;
  const labelsPerRow = 3;
  const labelsPerPage = 54;
  
  const calDate = new Date(date);
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);

  for (let i = 0; i < count; i++) {
    const row = Math.floor((i % labelsPerPage) / labelsPerRow);
    const col = i % labelsPerRow;
    if (i > 0 && i % labelsPerPage === 0) doc.addPage();
    const x = marginX + (col * labelW);
    const y = marginY + (row * labelH);
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.05); doc.setLineDashPattern([0.5, 0.5], 0);
    doc.rect(x, y, labelW, labelH, 'S');
    doc.setLineDashPattern([], 0);
    doc.setTextColor(50, 50, 50); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    doc.text('STRUMENTAZIONE & SERVIZI', x + 3, y + 4.5);
    doc.setTextColor(140, 140, 140); doc.setFontSize(4.5); doc.setFont('helvetica', 'normal');
    doc.text(`TARATURA: ${calDate.toLocaleDateString('it-IT')}`, x + 3, y + 10);
    doc.text(`SCADENZA: ${nextDate.toLocaleDateString('it-IT')}`, x + 25, y + 10);
    doc.setFillColor(...colors.success); doc.roundedRect(x + labelW - 7, y + 2, 4.5, 10, 0.5, 0.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(4); doc.text('OK', x + labelW - 4.75, y + 7.5, { align: 'center' });
  }
  doc.save(`etichette_2S_${count}.pdf`);
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
      doc.setFontSize(7.5); doc.setTextColor(80, 80, 80); doc.text(f.l.toUpperCase(), x + 2, y + 3.8);
      doc.setFontSize(10); doc.setTextColor(15, 15, 15); doc.text(String(f.v || '-'), x + 2, y + 8.2);
    });
  };

  drawRow(curY, [{l: 'Costruttore', v: String(data.manufacturer)}, {l: 'Modello', v: String(data.model)}, {l: 'S/N', v: String(data.serialNumber)}, {l: 'Vol. Nominale', v: `${data.nominalVolume} ${data.nominalVolumeUnit}`}]);
  curY += 12;
  drawRow(curY, [{l: 'Data Test', v: String(data.testDate)}, {l: 'Temp (°C)', v: String(data.temperature)}, {l: 'Pres (hPa)', v: String(data.pressure)}, {l: 'Fattore Z', v: fmt(z, 5)}]);
  curY += 12;
  drawRow(curY, [{l: 'Bilancia di Riferimento', v: String(data.referenceBalance || 'Certificata ISO 17025')}, {l: 'Frequenza Taratura', v: `${data.calibrationFrequencyMonths} mesi`}]);
  curY += 26;

  let allPass = true;
  if (data.type === PipetteType.FIXED) {
    allPass = drawStatsDashboard(doc, curY, calculateStats(data.measurementsFixed, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Risultati Taratura");
  } else {
    const p1 = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMin, z, nomVol*0.1), nomVol*0.1, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 1: Volume Minimo (10%)");
    doc.addPage(); curY = 25;
    const p2 = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMid, z, nomVol*0.5), nomVol*0.5, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 2: Volume Medio (50%)");
    doc.addPage(); curY = 25;
    const p3 = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMax, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 3: Volume Massimo (100%)");
    allPass = p1 && p2 && p3;
  }

  // Verdetto di Conformità
  const verdictY = 270;
  doc.setFillColor(allPass ? theme.success[0] : theme.fail[0], allPass ? theme.success[1] : theme.fail[1], allPass ? theme.success[2] : theme.fail[2]);
  doc.roundedRect(14, verdictY, 183, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(`VERDETTO FINALE: LO STRUMENTO RISULTA ${allPass ? 'CONFORME' : 'NON CONFORME'} AI LIMITI ISO 8655`, 105, verdictY + 7.5, { align: 'center' });

  doc.setFontSize(8.5); doc.setTextColor(100, 100, 100); doc.text("Generato con PipetteCal 2S - Conformità ISO 8655. Firma e Timbro necessari per validità legale.", 14, 288);
  return returnBlob ? doc.output('bloburl') : doc.save(`cert_2S_${data.serialNumber}.pdf`);
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
    head: [['MARCA', 'MODELLO', 'SERIALE', 'VOLUME', 'ULTIMA TARATURA']], 
    body: pipettes.map(p => [p.manufacturer, p.model, p.serial_number, p.nominal_volume, new Date(p.last_calibrated).toLocaleDateString()]),
    headStyles: { fillColor: theme.primary }
  });
  doc.save(`elenco_strumenti_2S_${clientName}.pdf`);
};
