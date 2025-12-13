import Dexie, { Table } from 'dexie';
import { LocationItem, RouteResult, AppSettings } from '../types';

// 定义 Settings 在数据库中的存储结构
export interface SettingsEntity extends AppSettings {
  id: number; // 固定为 1，确保只有一份配置
}

export class TripSpotDB extends Dexie {
  locations!: Table<LocationItem, string>; // id is string (UUID)
  settings!: Table<SettingsEntity, number>;
  route!: Table<{ id: number; data: RouteResult }, number>; // 存一份当前的 route

  constructor() {
    super('TripSpotDB');
    this.version(1).stores({
      locations: 'id', // Primary key
      settings: 'id',
      route: 'id'
    });
  }
}

export const db = new TripSpotDB();

// 辅助函数：获取配置 (Async)
export const getSettingsFromDB = async (): Promise<AppSettings> => {
  const record = await db.settings.get(1);
  if (record) return record;
  
  // 默认值
  return {
    amapKey: '',
    amapSecurityCode: '',
    llmApiKey: '',
    llmBaseUrl: '',
    llmModel: 'gpt-3.5-turbo',
    id: 1
  } as SettingsEntity;
};

// 辅助函数：保存配置
export const saveSettingsToDB = async (settings: AppSettings) => {
  await db.settings.put({ ...settings, id: 1 });
};