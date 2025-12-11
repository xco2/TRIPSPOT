export interface LocationItem {
  id: string;
  name: string;
  city: string;
  type: 'spot' | 'food' | 'hotel' | 'other';
  context: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  sequence: string[]; // Array of LocationItem IDs
  totalDurationMinutes: number;
  advice: string;
}

export type ParsingStatus = 'idle' | 'parsing' | 'geocoding' | 'success' | 'error';
export type RoutingStatus = 'idle' | 'matrix_building' | 'calculating' | 'optimizing' | 'success' | 'error';

export interface AppSettings {
  amapKey: string;
  amapSecurityCode: string;
  llmApiKey: string;
  llmBaseUrl: string; // Optional custom base URL
  llmModel: string;
}

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
    onAMapLoaded?: () => void;
  }
}
