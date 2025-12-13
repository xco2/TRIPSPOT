import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { AppSettings } from '../types';
import { getSettingsFromDB, saveSettingsToDB } from '../src/db';
import { logoutUser } from '../utils/storage';

interface SettingsProps {
  onClose: () => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose, onLogout }) => {
  const [formData, setFormData] = useState<AppSettings>({
    amapKey: '',
    amapSecurityCode: '',
    llmApiKey: '',
    llmBaseUrl: '',
    llmModel: '',
  });

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSettingsFromDB();
      setFormData(settings);
    };
    loadSettings();
  }, []);

  const handleChange = (field: keyof AppSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await saveSettingsToDB(formData);
    alert('设置已保存，部分更改可能需要刷新页面生效。');
    onClose();
    // We could force a reload here if needed, but for now just close
    window.location.reload();
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-black shadow-hard w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-black flex justify-between items-center bg-muted">
          <h2 className="font-bold text-lg">系统设置</h2>
          <button onClick={onClose} className="text-2xl leading-none hover:text-gray-600">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Map Config */}
          <section className="space-y-3">
            <h3 className="font-bold border-b border-gray-200 pb-1">地图服务配置 (高德地图)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">高德地图 JS API Key</label>
                <input 
                  type="text" 
                  value={formData.amapKey}
                  onChange={(e) => handleChange('amapKey', e.target.value)}
                  className="w-full border border-black p-2 text-sm font-mono"
                  placeholder="请输入高德 Web 端 (JSAPI) Key"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">高德安全密钥 (Security Code)</label>
                <input 
                  type="text" 
                  value={formData.amapSecurityCode}
                  onChange={(e) => handleChange('amapSecurityCode', e.target.value)}
                  className="w-full border border-black p-2 text-sm font-mono"
                  placeholder="请输入对应的安全密钥"
                />
              </div>
            </div>
          </section>

          {/* LLM Config */}
          <section className="space-y-3">
            <h3 className="font-bold border-b border-gray-200 pb-1">LLM 配置 (Gemini)</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">API Key</label>
                <input 
                  type="password" 
                  value={formData.llmApiKey}
                  onChange={(e) => handleChange('llmApiKey', e.target.value)}
                  className="w-full border border-black p-2 text-sm font-mono"
                  placeholder="AI Studio API Key"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Model Name</label>
                <input 
                  type="text" 
                  value={formData.llmModel}
                  onChange={(e) => handleChange('llmModel', e.target.value)}
                  className="w-full border border-black p-2 text-sm font-mono"
                  placeholder="e.g., gemini-2.5-flash"
                />
              </div>
               <div>
                <label className="block text-xs font-bold mb-1">Base URL (可选)</label>
                <input 
                  type="text" 
                  value={formData.llmBaseUrl}
                  onChange={(e) => handleChange('llmBaseUrl', e.target.value)}
                  className="w-full border border-black p-2 text-sm font-mono"
                  placeholder="https://generativelanguage.googleapis.com"
                />
                <p className="text-[10px] text-gray-500 mt-1">仅在使用代理转发服务时修改此项</p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-black bg-gray-50 flex justify-between">
           <Button variant="ghost" onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
             退出登录
           </Button>
           <div className="flex gap-2">
             <Button variant="secondary" onClick={onClose}>取消</Button>
             <Button onClick={handleSave}>保存配置</Button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
