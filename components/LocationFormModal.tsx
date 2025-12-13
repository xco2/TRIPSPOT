import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { LocationItem } from '../types';

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<LocationItem, 'id' | 'lat' | 'lng'>) => void;
  initialData?: LocationItem; // 如果是编辑模式，传入此项
}

const LocationFormModal: React.FC<LocationFormModalProps> = ({ 
  isOpen, onClose, onSave, initialData 
}) => {
  const [formData, setFormData] = useState({
    name: '', city: '', type: 'spot' as 'spot' | 'food' | 'hotel' | 'other', context: ''
  });

  // 初始化数据
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        city: initialData.city,
        type: initialData.type,
        context: initialData.context
      });
    } else {
      setFormData({ name: '', city: '', type: 'spot' as 'spot' | 'food' | 'hotel' | 'other', context: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-black shadow-hard w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-black flex justify-between items-center bg-muted">
          <h2 className="font-bold">{initialData ? '编辑地点' : '手动添加地点'}</h2>
          <button onClick={onClose} className="text-xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1">地点名称</label>
            <input 
              className="w-full border border-black p-2 text-sm"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="例如：宽窄巷子"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold mb-1">城市</label>
                <input 
                  className="w-full border border-black p-2 text-sm"
                  value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                  placeholder="例如：成都"
                />
             </div>
             <div>
                <label className="block text-xs font-bold mb-1">类型</label>
                <select 
                  className="w-full border border-black p-2 text-sm bg-white"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="spot">景点 (Spot)</option>
                  <option value="food">美食 (Food)</option>
                  <option value="hotel">住宿 (Hotel)</option>
                  <option value="other">其他 (Other)</option>
                </select>
             </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">备注/描述</label>
            <textarea 
              className="w-full border border-black p-2 text-sm resize-none h-20"
              value={formData.context}
              onChange={e => setFormData({...formData, context: e.target.value})}
              placeholder="关于这个地点的备注..."
            />
          </div>
        </div>

        <div className="p-4 border-t border-black bg-gray-50 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => {
            onSave(formData);
            onClose();
          }}>保存</Button>
        </div>
      </div>
    </div>
  );
};

export default LocationFormModal;