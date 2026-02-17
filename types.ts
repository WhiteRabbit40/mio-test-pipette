
export enum PipetteType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

export type ZFactorMethod = 'ISO_WATER' | 'MANUAL';

export type PdfTheme = 'default' | 'blue' | 'grayscale' | 'teal' | 'sky' | 'custom';

export type UiTheme = 'violet' | 'teal' | 'sky' | 'blue';

export interface PdfOptions {
  includeCharts: boolean;
  colorTheme: PdfTheme;
  customPrimaryColor?: string;
  customSecondaryColor?: string;
  operatorName: string;
  approverName: string;
  customLogoBase64?: string;
  chartYMin?: number | ''; 
  chartYMax?: number | '';
}

export interface CalibrationData {
  manufacturer: string;
  model: string;
  serialNumber: string;
  nominalVolume: string;
  nominalVolumeUnit: 'ul' | 'ml';
  testDate: string;
  testNumber: string;
  calibrationFrequencyMonths: number;
  nextCalibrationDate: string;
  temperature: number | '';
  pressure: number | '';
  humidity: number | '';
  zFactor: number | '';
  zFactorMethod: ZFactorMethod;
  type: PipetteType;
  toleranceSystematic: number | '';
  toleranceRandom: number | '';
  measurementsFixed: (number | '')[];
  measurementsVarMin: (number | '')[];
  measurementsVarMid: (number | '')[];
  measurementsVarMax: (number | '')[];
  pdfOptions?: PdfOptions;
  uiTheme?: UiTheme;
  notes?: string;
  referenceBalance?: string; 
}

export interface CalculatedStats {
  meanMass: number;
  meanVolume: number;
  count: number;
  sd: number;
  inaccuracy: number;
  uncertainty: number;
  volumes: number[];
}

export interface Client {
  id: string;
  user_id?: string;
  name: string;
  created_at: string;
}

export interface StoredPipette {
  id: string;
  client_id: string;
  user_id?: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  nominal_volume: string;
  last_calibrated: string;
  full_data: CalibrationData;
  created_at: string;
}
