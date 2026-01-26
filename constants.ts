
export const INITIAL_MEASUREMENTS_FIXED = Array(10).fill('');
export const INITIAL_MEASUREMENTS_VAR = Array(10).fill('');

export const DEFAULT_Z_FACTOR = 1.0029; // Reference at 20°C, 101.3 kPa

// Logo is now rendered programmatically in pdfGenerator to ensure quality and avoid format errors
export const LOGO_BASE64 = "";

// Common Pipette Presets for Quick Fill (Generic Volumes Only)
export const PIPETTE_PRESETS = [
  // --- VARIABLE VOLUMES ---
  { name: "Variabile 0.2 - 2 µl", manufacturer: "", model: "", nominalVolume: "2", type: "VARIABLE" },
  { name: "Variabile 1 - 10 µl", manufacturer: "", model: "", nominalVolume: "10", type: "VARIABLE" },
  { name: "Variabile 2 - 20 µl", manufacturer: "", model: "", nominalVolume: "20", type: "VARIABLE" },
  { name: "Variabile 10 - 100 µl", manufacturer: "", model: "", nominalVolume: "100", type: "VARIABLE" },
  { name: "Variabile 20 - 200 µl", manufacturer: "", model: "", nominalVolume: "200", type: "VARIABLE" },
  { name: "Variabile 100 - 1000 µl", manufacturer: "", model: "", nominalVolume: "1000", type: "VARIABLE" },
  { name: "Variabile 0.5 - 5 ml", manufacturer: "", model: "", nominalVolume: "5000", type: "VARIABLE" },
  { name: "Variabile 1 - 10 ml", manufacturer: "", model: "", nominalVolume: "10000", type: "VARIABLE" },
  
  // --- FIXED VOLUMES ---
  { name: "Fissa 10 µl", manufacturer: "", model: "", nominalVolume: "10", type: "FIXED" },
  { name: "Fissa 20 µl", manufacturer: "", model: "", nominalVolume: "20", type: "FIXED" },
  { name: "Fissa 50 µl", manufacturer: "", model: "", nominalVolume: "50", type: "FIXED" },
  { name: "Fissa 100 µl", manufacturer: "", model: "", nominalVolume: "100", type: "FIXED" },
  { name: "Fissa 200 µl", manufacturer: "", model: "", nominalVolume: "200", type: "FIXED" },
  { name: "Fissa 500 µl", manufacturer: "", model: "", nominalVolume: "500", type: "FIXED" },
  { name: "Fissa 1000 µl (1 ml)", manufacturer: "", model: "", nominalVolume: "1000", type: "FIXED" },
  { name: "Fissa 2000 µl (2 ml)", manufacturer: "", model: "", nominalVolume: "2000", type: "FIXED" },
  { name: "Fissa 2500 µl (2.5 ml)", manufacturer: "", model: "", nominalVolume: "2500", type: "FIXED" },
  { name: "Fissa 5000 µl (5 ml)", manufacturer: "", model: "", nominalVolume: "5000", type: "FIXED" },
  { name: "Fissa 10000 µl (10 ml)", manufacturer: "", model: "", nominalVolume: "10000", type: "FIXED" },
];

// ISO Tolerance Lookup Table (Based on user provided image)
// Volumes are in µl. System automatically converts 'ml' input to µl.
export const ISO_TOLERANCES_DATA = [
  { vol: 2, sys: 0.08, rand: 0.04 },
  { vol: 10, sys: 0.12, rand: 0.08 },
  { vol: 20, sys: 0.20, rand: 0.10 },
  { vol: 50, sys: 0.50, rand: 0.20 }, // Added missing 50µl limits
  { vol: 100, sys: 0.80, rand: 0.30 },
  { vol: 200, sys: 1.60, rand: 0.60 },
  { vol: 500, sys: 4.00, rand: 1.50 },
  { vol: 1000, sys: 8.00, rand: 3.00 }, // 1 ml
  { vol: 2000, sys: 16.00, rand: 6.00 }, // 2 ml
  { vol: 2500, sys: 20.00, rand: 7.50 }, // 2.5 ml (Interpolated Standard)
  { vol: 5000, sys: 40.00, rand: 15.00 }, // 5 ml
  { vol: 10000, sys: 60.00, rand: 30.00 }, // 10 ml
];

// ISO 8655-6 Table A.1 Data Points
const TABLE_PRESSURES_KPA = [80, 85, 90, 95, 100, 101.3, 105];
const TABLE_TEMPS = [
  15.0, 15.5, 16.0, 16.5, 17.0, 17.5, 18.0, 18.5, 19.0, 19.5,
  20.0, 20.5, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5,
  25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0
];

// Z-Values corresponding to rows (Temp) and columns (Pressure)
// Source: ISO 8655-6 Annex A
const TABLE_Z_VALUES = [
  [1.0017, 1.0018, 1.0019, 1.0019, 1.0020, 1.0020, 1.0020], // 15.0
  [1.0018, 1.0019, 1.0019, 1.0020, 1.0020, 1.0020, 1.0021], // 15.5
  [1.0019, 1.0020, 1.0020, 1.0021, 1.0021, 1.0021, 1.0022], // 16.0
  [1.0020, 1.0020, 1.0021, 1.0021, 1.0022, 1.0022, 1.0022], // 16.5
  [1.0021, 1.0021, 1.0022, 1.0022, 1.0023, 1.0023, 1.0023], // 17.0
  [1.0022, 1.0022, 1.0023, 1.0023, 1.0024, 1.0024, 1.0024], // 17.5
  [1.0022, 1.0023, 1.0023, 1.0024, 1.0025, 1.0025, 1.0025], // 18.0
  [1.0023, 1.0024, 1.0024, 1.0025, 1.0025, 1.0026, 1.0026], // 18.5
  [1.0024, 1.0025, 1.0025, 1.0026, 1.0026, 1.0027, 1.0027], // 19.0
  [1.0025, 1.0026, 1.0026, 1.0027, 1.0027, 1.0028, 1.0028], // 19.5
  [1.0026, 1.0027, 1.0027, 1.0028, 1.0028, 1.0029, 1.0029], // 20.0
  [1.0027, 1.0028, 1.0028, 1.0029, 1.0029, 1.0030, 1.0030], // 20.5
  [1.0028, 1.0029, 1.0029, 1.0030, 1.0031, 1.0031, 1.0031], // 21.0
  [1.0030, 1.0030, 1.0031, 1.0031, 1.0032, 1.0032, 1.0032], // 21.5
  [1.0031, 1.0031, 1.0032, 1.0032, 1.0033, 1.0033, 1.0033], // 22.0
  [1.0032, 1.0032, 1.0033, 1.0033, 1.0034, 1.0034, 1.0034], // 22.5
  [1.0033, 1.0033, 1.0034, 1.0034, 1.0035, 1.0035, 1.0036], // 23.0
  [1.0034, 1.0035, 1.0035, 1.0036, 1.0036, 1.0036, 1.0037], // 23.5
  [1.0035, 1.0036, 1.0036, 1.0037, 1.0037, 1.0038, 1.0038], // 24.0
  [1.0037, 1.0037, 1.0038, 1.0038, 1.0039, 1.0039, 1.0039], // 24.5
  [1.0038, 1.0038, 1.0039, 1.0039, 1.0040, 1.0040, 1.0040], // 25.0
  [1.0039, 1.0040, 1.0040, 1.0041, 1.0041, 1.0041, 1.0042], // 25.5
  [1.0040, 1.0041, 1.0041, 1.0042, 1.0042, 1.0043, 1.0043], // 26.0
  [1.0042, 1.0042, 1.0043, 1.0043, 1.0044, 1.0044, 1.0044], // 26.5
  [1.0043, 1.0044, 1.0044, 1.0045, 1.0045, 1.0045, 1.0046], // 27.0
  [1.0045, 1.0045, 1.0046, 1.0046, 1.0047, 1.0047, 1.0047], // 27.5
  [1.0046, 1.0046, 1.0047, 1.0047, 1.0048, 1.0048, 1.0048], // 28.0
  [1.0047, 1.0048, 1.0048, 1.0049, 1.0049, 1.0050, 1.0050], // 28.5
  [1.0049, 1.0049, 1.0050, 1.0050, 1.0051, 1.0051, 1.0051], // 29.0
  [1.0050, 1.0051, 1.0051, 1.0052, 1.0052, 1.0052, 1.0053], // 29.5
  [1.0052, 1.0052, 1.0053, 1.0053, 1.0054, 1.0054, 1.0054], // 30.0
];

/**
 * Calculates Z-Factor using bilinear interpolation on the ISO 8655-6 table.
 * @param temp Temperature in °C (Range 15-30)
 * @param pressureKPa Pressure in kPa (Range 80-105)
 */
export const calculateZFactor = (temp: number, pressureKPa: number): number => {
  if (isNaN(temp) || isNaN(pressureKPa)) return DEFAULT_Z_FACTOR;

  // Input is now directly in kPa, no conversion needed.
  // The table ranges from 80 to 105 kPa.

  // Find Indices for Temperature
  let tIdx = -1;
  for (let i = 0; i < TABLE_TEMPS.length - 1; i++) {
    if (temp >= TABLE_TEMPS[i] && temp <= TABLE_TEMPS[i + 1]) {
      tIdx = i;
      break;
    }
  }
  
  // Handle Out of Bounds Temp (Clamp to nearest)
  if (temp < TABLE_TEMPS[0]) tIdx = 0;
  if (temp > TABLE_TEMPS[TABLE_TEMPS.length - 1]) tIdx = TABLE_TEMPS.length - 2;
  if (tIdx === -1) tIdx = temp < 20 ? 0 : TABLE_TEMPS.length - 2; // Fallback

  // Find Indices for Pressure
  let pIdx = -1;
  for (let i = 0; i < TABLE_PRESSURES_KPA.length - 1; i++) {
    if (pressureKPa >= TABLE_PRESSURES_KPA[i] && pressureKPa <= TABLE_PRESSURES_KPA[i + 1]) {
      pIdx = i;
      break;
    }
  }

  // Handle Out of Bounds Pressure (Clamp to nearest)
  if (pressureKPa < TABLE_PRESSURES_KPA[0]) pIdx = 0;
  if (pressureKPa > TABLE_PRESSURES_KPA[TABLE_PRESSURES_KPA.length - 1]) pIdx = TABLE_PRESSURES_KPA.length - 2;
  if (pIdx === -1) pIdx = pressureKPa < 100 ? 0 : TABLE_PRESSURES_KPA.length - 2; // Fallback

  // Grid points (x = pressure, y = temp)
  const x1 = TABLE_PRESSURES_KPA[pIdx];
  const x2 = TABLE_PRESSURES_KPA[pIdx + 1];
  const y1 = TABLE_TEMPS[tIdx];
  const y2 = TABLE_TEMPS[tIdx + 1];

  // Values at corners
  const Q11 = TABLE_Z_VALUES[tIdx][pIdx];     // Bottom-Left (Low T, Low P)
  const Q12 = TABLE_Z_VALUES[tIdx + 1][pIdx]; // Top-Left (High T, Low P)
  const Q21 = TABLE_Z_VALUES[tIdx][pIdx + 1]; // Bottom-Right (Low T, High P)
  const Q22 = TABLE_Z_VALUES[tIdx + 1][pIdx + 1]; // Top-Right (High T, High P)

  // Interpolation factors (0 to 1)
  // Clamp input values to grid range to avoid extrapolation errors if slightly out of bounds
  const x = Math.max(x1, Math.min(x2, pressureKPa));
  const y = Math.max(y1, Math.min(y2, temp));

  // Bilinear Interpolation Formula
  // R1 = Interpolate X at Y1
  const R1 = ((x2 - x) / (x2 - x1)) * Q11 + ((x - x1) / (x2 - x1)) * Q21;
  // R2 = Interpolate X at Y2
  const R2 = ((x2 - x) / (x2 - x1)) * Q12 + ((x - x1) / (x2 - x1)) * Q22;
  
  // P = Interpolate Y between R1 and R2
  const P = ((y2 - y) / (y2 - y1)) * R1 + ((y - y1) / (y2 - y1)) * R2;

  return Number(P.toFixed(5));
};
