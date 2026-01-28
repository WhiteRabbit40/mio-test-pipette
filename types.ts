
export enum PipetteType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

export type ZFactorMethod = 'ISO_WATER' | 'MANUAL';

export type PdfTheme = 'default' | 'blue' | 'grayscale' | 'custom';

export interface PdfOptions {
  includeCharts: boolean;
  colorTheme: PdfTheme;
  customPrimaryColor?: string;
  customSecondaryColor?: string;
  operatorName: string;
  approverName: string;
  customLogoBase64?: string; // Base64 string of the uploaded logo
  // Manual Chart Axis Limits
  chartYMin?: number | ''; 
  chartYMax?: number | '';
}

export interface CalibrationData {
  // General Info
  manufacturer: string;
  model: string;
  serialNumber: string;
  nominalVolume: string; // Numeric value as string
  nominalVolumeUnit: 'ul' | 'ml'; // Unit of measurement
  
  // Test Metadata
  testDate: string;
  testNumber: string;
  calibrationFrequencyMonths: number; // Frequency in months
  nextCalibrationDate: string; // Calculated due date
  
  // Environment
  temperature: number | '';
  pressure: number | ''; // In hPa (mbar)
  humidity: number | '';
  zFactor: number | ''; // Fattore Z
  zFactorMethod: ZFactorMethod; // Method of calculation
  
  // Configuration
  type: PipetteType;
  
  // Tolerances (ISO Limits) in µl
  toleranceSystematic: number | ''; // Systematic Error Limit (Inaccuracy)
  toleranceRandom: number | '';     // Random Error Limit (SD)

  // Measurements (Mass in mg or g)
  measurementsFixed: (number | '')[];
  measurementsVarMin: (number | '')[];
  measurementsVarMid: (number | '')[];
  measurementsVarMax: (number | '')[];

  // PDF Configuration
  pdfOptions?: PdfOptions;
  
  // Additional Notes
  notes?: string;
}

export interface CalculatedStats {
  meanMass: number;
  meanVolume: number; // calculated using Z-factor
  count: number;
  sd: number; // Standard Deviation
  inaccuracy: number; // Systematic Error (Mean Vol - Nominal)
  uncertainty: number; // Expanded Uncertainty (k=2)
  volumes: number[];
}

// --- DATABASE TYPES ---

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
  full_data: CalibrationData; // JSONB dump
  created_at: string;
}
