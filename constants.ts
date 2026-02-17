
import { PipetteType } from './types';

export const INITIAL_MEASUREMENTS_FIXED = Array(10).fill('');
export const INITIAL_MEASUREMENTS_VAR = Array(10).fill('');

export const DEFAULT_Z_FACTOR = 1.0029; 

// Logo "2S" a doppia linea (Base64 di un SVG pulito)
export const LOGO_BASE64 = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgdmlld0JveD0iMCAwIDUwMCA1MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xMDAgMTUwQzEwMCA4My43MjU4IDE1My43MjYgMzAgMjIwIDMwQzI4Ni4yNzQgMzAgMzQwIDgzLjcyNTggMzQwIDE1MEMzNDAgMTkxLjU0NyAzMTguOTA5IDIyOC4xNjQgMjg2IDIzOUwyMjAgMjU2TDEwMCAzODBWNDcwSDQwMCIgc3Ryb2tlPSIjNEMxRDk1IiBzdHJva2Utd2lkdGg9IjE2IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE0MCAxNTBDMTQwIDEwNS44MTcgMTc1LjgxNyA3MCAyMjAgNzBDMjY0LjE4MyA3MCAzMDAgMTA1LjgxNyAzMDAgMTUwQzMwMCAxNzUuMTU4IDI4OC4wNTkgMTk3LjU0OCAyNjkgMjA1TDIyMCAyMTlMMTQwIDI5NVY0MzBINDQwIiBzdHJva2U9IiM0QzFEOTUiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNNDAwIDMwMEM0NDAgMzAwIDQ3MCAzMzAgNDcwIDM3MEM0NzAgNDEwIDQ0MCA0NDAgNDAwIDQ0MEMzNjAgNDQwIDMzMCA0MTAgMzMwIDM3MEMzMzAgMzMwIDM2MCAzMDAgNDAwIDMwMFoiIHN0cm9rZT0iIzRDMUQ5NSIgc3Ryb2tlLXdpZHRoPSIxNiIvPgo8L3N2Zz4=";

/**
 * Calculates the Z-factor (conversion factor from mass to volume) 
 * for water based on temperature (°C) and air pressure (hPa).
 */
export const calculateZFactor = (temperature: number, pressureHpa: number): number => {
  const pressureKpa = pressureHpa * 0.1;
  // Simplified approximation formula for Z-factor (µl/mg)
  // Ref: ISO 8655-6
  const densityWater = 999.85 + (0.067 * temperature) - (0.009 * Math.pow(temperature, 2)) + (0.0001 * Math.pow(temperature, 3));
  const densityAir = (0.0012 * pressureKpa) / 101.325 * (273.15 + 20) / (273.15 + temperature);
  const densityWeights = 8000; // Standard stainless steel density in kg/m3

  const z = (1 / (densityWater / 1000)) * (1 / (1 - (densityAir / (densityWeights / 1000))));
  return isNaN(z) ? 1.0029 : z;
};

/**
 * ISO 8655-2 standard maximum permissible errors for single-channel piston pipettes.
 */
export const ISO_TOLERANCES_DATA = [
  { vol: 1, sys: 0.05, rand: 0.05 },
  { vol: 2, sys: 0.08, rand: 0.04 },
  { vol: 5, sys: 0.125, rand: 0.075 },
  { vol: 10, sys: 0.12, rand: 0.08 },
  { vol: 20, sys: 0.2, rand: 0.1 },
  { vol: 50, sys: 0.5, rand: 0.2 },
  { vol: 100, sys: 0.8, rand: 0.3 },
  { vol: 200, sys: 1.6, rand: 0.6 },
  { vol: 500, sys: 4.0, rand: 1.5 },
  { vol: 1000, sys: 8.0, rand: 3.0 },
  { vol: 2000, sys: 16.0, rand: 6.0 },
  { vol: 5000, sys: 40.0, rand: 15.0 },
  { vol: 10000, sys: 80.0, rand: 30.0 },
];

export const PIPETTE_PRESETS = [
  { manufacturer: 'Gilson', model: 'Pipetman P2', nominalVolume: '2', unit: 'ul' },
  { manufacturer: 'Gilson', model: 'Pipetman P10', nominalVolume: '10', unit: 'ul' },
  { manufacturer: 'Gilson', model: 'Pipetman P20', nominalVolume: '20', unit: 'ul' },
  { manufacturer: 'Gilson', model: 'Pipetman P100', nominalVolume: '100', unit: 'ul' },
  { manufacturer: 'Gilson', model: 'Pipetman P200', nominalVolume: '200', unit: 'ul' },
  { manufacturer: 'Gilson', model: 'Pipetman P1000', nominalVolume: '1000', unit: 'ul' },
];
