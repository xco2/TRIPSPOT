import { AppSettings } from '../types';
import { AMAP_KEY, AMAP_SECURITY_CODE } from '../constants';

const SETTINGS_KEY = 'tripspot_settings';
const AUTH_KEY = 'tripspot_auth';

const DEFAULT_SETTINGS: AppSettings = {
  amapKey: AMAP_KEY,
  amapSecurityCode: AMAP_SECURITY_CODE,
  llmApiKey: '', // User must provide
  llmBaseUrl: '', 
  llmModel: 'gemini-2.5-flash',
};

export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const isUserLoggedIn = (): boolean => {
  return localStorage.getItem(AUTH_KEY) === 'true';
};

export const loginUser = () => {
  localStorage.setItem(AUTH_KEY, 'true');
};

export const logoutUser = () => {
  localStorage.removeItem(AUTH_KEY);
};
