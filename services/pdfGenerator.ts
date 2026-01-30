
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

  // Sfondo tecnico
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(x, y, w, h, 'FD');

  const paddingL = 20;
  const paddingR = 10;
  const paddingT = 15;
  const paddingB = 15;
  const chartW = w - (paddingL + paddingR);
  const chartH = h - (paddingT + paddingB);
  const startX = x + paddingL;
  const startY = y + paddingT;

  const sysTol = Number(tol) || target * 0.05;
  const upperTol = target + sysTol;
  const lowerTol = target - sysTol;
  
  // Scala centrata
  const allPoints = [...volumes, upperTol, lowerTol];
  let minVal = Math.min(...allPoints);
  let maxVal = Math.max(...allPoints);
  const span = maxVal - minVal || target * 0.01;
  minVal -= span * 0.2;
  maxVal += span * 0.2;
  const range = maxVal - minVal;

  const getX = (i: number) => startX + (i * chartW / 9);
  const getY = (v: number) => startY + chartH - ((v - minVal) / range * chartH);

  // Grid Millimetrata
  doc.setDrawColor(245, 245, 245);
  doc.setLineWidth(0.05);
  for (let i = 0; i <= 10; i++) {
    const v = minVal + (i * range / 10);
    doc.line(startX, getY(v), startX + chartW, getY(v));
    doc.setFontSize(5); doc.setTextColor(150);
    doc.text(v.toFixed(2).toString(), startX - 2, getY(v) + 1, { align: 'right' });
  }

  // --- AREA INCERTEZZA (±2SD) ---
  const upper2sd = stats.meanVolume + (2 * stats.sd);
  const lower2sd = stats.meanVolume - (2 * stats.sd);
  doc.setFillColor(...colors.accent);
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.rect(startX, getY(upper2sd), chartW, getY(lower2sd) - getY(upper2sd), 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // --- LIMITI ISO (ROSSI) ---
  doc.setDrawColor(...colors.fail); doc.setLineWidth(0.4); doc.setLineDashPattern([1.5, 1], 0);
  doc.line(startX, getY(upperTol), startX + chartW, getY(upperTol));
  doc.line(startX, getY(lowerTol), startX + chartW, getY(lowerTol));
  
  // --- NOMINALE ---
  doc.setDrawColor(...colors.primary); doc.setLineWidth(0.3); doc.setLineDashPattern([3, 2], 0);
  doc.line(startX, getY(target), startX + chartW, getY(target));
  doc.setLineDashPattern([], 0);

  // --- DATI ---
  doc.setDrawColor(...colors.primary); doc.setLineWidth(0.8);
  for (let i = 0; i < volumes.length - 1; i++) {
    doc.line(getX(i), getY(volumes[i]), getX(i + 1), getY(volumes[i + 1]));
  }
  volumes.forEach((v, i) => {
    doc.setFillColor(...colors.primary); doc.circle(getX(i), getY(v), 0.8, 'F');
    doc.setFillColor(255, 255, 255); doc.circle(getX(i), getY(v), 0.3, 'F');
  });

  // Legenda Tecnica
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...colors.textDark);
  doc.text("ANALISI GRAVIMETRICA (µl)", startX, startY - 5);
  
  const legX = startX + chartW - 55;
  const legY = startY - 5;
  doc.setDrawColor(...colors.fail); doc.setLineWidth(0.4); doc.setLineDashPattern([1, 1], 0); doc.line(legX, legY, legX+4, legY);
  doc.setFontSize(5); doc.text("ISO LIMITS", legX+5, legY+0.5);
  
  doc.setFillColor(...colors.accent); doc.setGState(new (doc as any).GState({ opacity: 0.2 })); doc.rect(legX+20, legY-1.5, 4, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.text("± 2SD (UNC.)", legX+25, legY+0.5);
};

const drawStatsDashboard = (doc: jsPDF, curY: number, stats: CalculatedStats, targetVol: number, tolSys: number | '', tolRand: number | '', colors: ThemeColors, title: string) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...colors.primary); doc.text(title.toUpperCase(), 14, curY);
  const startY = curY + 4, cardW = 35, cardH = 30, gap = 2;
  
  const drawCard = (x: number, label: string, val: string, unit: string, tol?: number, cur?: number) => {
    doc.setFillColor(252, 252, 252); doc.setDrawColor(230, 230, 230); doc.roundedRect(x, startY, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(6); doc.setTextColor(150, 150, 150); doc.text(label.toUpperCase(), x + 3, startY + 6);
    doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.text(String(val), x + 3, startY + 18);
    doc.setFontSize(6); doc.text(String(unit), x + 3 + doc.getTextWidth(String(val)) + 1, startY + 18);
    if (tol && cur !== undefined) {
      doc.setFillColor(240, 240, 240); doc.rect(x + 3, startY + 24, cardW - 6, 1.5, 'F');
      const usage = Math.min(100, (Math.abs(cur)/tol)*100);
      doc.setFillColor(...(usage > 100 ? colors.fail : colors.success));
      doc.rect(x + 3, startY + 24, (usage/100)*(cardW-6), 1.5, 'F');
    }
  };

  drawCard(14, "Vol. Medio", fmt(stats.meanVolume, 3), "µl");
  drawCard(14 + (cardW+gap), "Err. Sist. (E)", fmt(stats.inaccuracy, 3), "µl", Number(tolSys), stats.inaccuracy);
  drawCard(14 + (cardW+gap)*2, "Err. Rel. (E%)", fmt(targetVol > 0 ? (stats.inaccuracy/targetVol)*100 : 0, 2), "%");
  drawCard(14 + (cardW+gap)*3, "Ripetib. (SD)", fmt(stats.sd, 4), "µl", Number(tolRand), stats.sd);
  drawCard(14 + (cardW+gap)*4, "Incert. (k=2)", fmt(stats.uncertainty, 3), "µl");

  drawPdfChart(doc, 14, startY + cardH + 4, 183, 55, stats, targetVol, tolSys, colors);
  return startY + cardH + 68;
};

export const generateLabelsSheetPDF = (count: number, date: string, frequencyMonths: number, themeKey: UiTheme = 'violet') => {
  const doc = new jsPDF();
  const colors = getThemeColors(themeKey);
  const labelW = 60;
  const labelH = 35;
  const marginX = 15;
  const marginY = 20;
  const labelsPerRow = 3;
  
  const calDate = new Date(date);
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);

  for (let i = 0; i < count; i++) {
    const row = Math.floor((i % 24) / labelsPerRow);
    const col = i % labelsPerRow;
    
    // Se finiamo la pagina (max 24 per pagina)
    if (i > 0 && i % 24 === 0) {
      doc.addPage();
    }

    const x = marginX + (col * labelW);
    const y = marginY + (row * labelH);

    // Linee di taglio (tratteggiate grigie)
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.setLineDashPattern([1, 1], 0);
    doc.rect(x, y, labelW, labelH, 'S');
    doc.setLineDashPattern([], 0);

    // Contenuto Etichetta
    // Logo 2S piccolo
    doc.setFillColor(...colors.primary); doc.roundedRect(x + 3, y + 3, 5, 5, 1, 1, 'F');
    doc.setTextColor(255); doc.setFontSize(4); doc.setFont('helvetica', 'bold'); doc.text('2S', x + 5.5, y + 6.5, { align: 'center' });
    
    doc.setTextColor(...colors.textDark); doc.setFontSize(6); doc.text('STRUMENTAZIONE & SERVIZI', x + 10, y + 6.5);
    doc.setDrawColor(230); doc.setLineWidth(0.1); doc.line(x + 3, y + 10, x + labelW - 3, y + 10);

    doc.setTextColor(150); doc.setFontSize(5); doc.text('DATA TARATURA:', x + 5, y + 15);
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(calDate.toLocaleDateString('it-IT'), x + 5, y + 21);

    doc.setTextColor(150); doc.setFontSize(5); doc.text('PROSSIMA SCADENZA:', x + 5, y + 27);
    doc.setTextColor(...colors.primary); doc.setFontSize(10); doc.text(nextDate.toLocaleDateString('it-IT'), x + 5, y + 32);

    // Stato
    doc.setFillColor(...colors.success); doc.roundedRect(x + labelW - 12, y + 15, 9, 15, 1, 1, 'F');
    doc.setTextColor(255); doc.setFontSize(4); doc.text('OK', x + labelW - 7.5, y + 23, { align: 'center' });
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
      doc.setFontSize(5); doc.setTextColor(150, 150, 150); doc.text(f.l.toUpperCase(), x + 2, y + 3);
      doc.setFontSize(8); doc.setTextColor(40, 40, 40); doc.text(String(f.v || '-'), x + 2, y + 8);
    });
  };

  drawRow(curY, [{l: 'Costruttore', v: String(data.manufacturer)}, {l: 'Modello', v: String(data.model)}, {l: 'S/N', v: String(data.serialNumber)}, {l: 'Vol. Nominale', v: `${data.nominalVolume} ${data.nominalVolumeUnit}`}]);
  curY += 12;
  drawRow(curY, [{l: 'Data Test', v: String(data.testDate)}, {l: 'Temp (°C)', v: String(data.temperature)}, {l: 'Pres (hPa)', v: String(data.pressure)}, {l: 'Fattore Z', v: fmt(z, 5)}]);
  curY += 20;

  if (data.type === PipetteType.FIXED) {
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsFixed, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Risultati Taratura");
  } else {
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMin, z, nomVol*0.1), nomVol*0.1, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 1: Volume Minimo (10%)");
    if (curY > 180) { doc.addPage(); curY = 25; }
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMid, z, nomVol*0.5), nomVol*0.5, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 2: Volume Medio (50%)");
    if (curY > 180) { doc.addPage(); curY = 25; }
    curY = drawStatsDashboard(doc, curY, calculateStats(data.measurementsVarMax, z, nomVol), nomVol, data.toleranceSystematic, data.toleranceRandom, theme, "Punto 3: Volume Massimo (100%)");
  }

  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.text("Generato da PipetteCal 2S - Conformità ISO 8655-6. Il presente certificato ha validità legale solo se firmato.", 14, 285);
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
