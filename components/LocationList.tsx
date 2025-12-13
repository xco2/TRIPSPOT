import React from 'react';
import { LocationItem } from '../types';

interface LocationListProps {
  locations: LocationItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  routeSequence?: string[];
}

const LocationList: React.FC<LocationListProps> = ({ 
  locations, 
  selectedIds, 
  onToggleSelect,
  routeSequence 
}) => {
  if (locations.length === 0) return null;

  console.log('📋 [DEBUG] LocationList渲染:', {
    locations数量: locations.length,
    routeSequence: routeSequence,
    selectedIds数量: selectedIds.size
  });

  // If a route exists, sort display by route sequence, otherwise by added order
  const displayLocations = routeSequence
    ? routeSequence.map(id => locations.find(l => l.id === id)!).filter(Boolean)
    : locations;

  // Append items not in route if any, but avoid duplicates
  const routedSet = new Set(routeSequence || []);
  const remaining = locations.filter(l => !routedSet.has(l.id));
  
  // 确保最终显示列表中没有重复项
  const finalDisplay = [...displayLocations, ...remaining];
  const uniqueDisplay = finalDisplay.filter((loc, index, self) =>
    index === self.findIndex(l => l.id === loc.id)
  );

  console.log('📋 [DEBUG] 最终渲染列表:', {
    显示数量: uniqueDisplay.length,
    原始数量: locations.length,
    重复项: locations.length - uniqueDisplay.length
  });

  return (
    <div className="bg-white border border-black shadow-hard flex flex-col h-full">
      <div className="p-3 border-b border-black bg-muted flex justify-between items-center">
        <h2 className="font-bold">地点列表 ({locations.length})</h2>
        <span className="text-xs text-gray-500">勾选 ≥ 2 个以规划</span>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[400px]">
        {uniqueDisplay.map((loc, index) => {
          const isSelected = selectedIds.has(loc.id);
          const order = routeSequence ? routeSequence.indexOf(loc.id) + 1 : null;

          return (
            <div
              key={`${loc.id}-${index}`}
              onClick={() => onToggleSelect(loc.id)}
              className={`
                group relative border p-3 cursor-pointer transition-all
                ${isSelected
                  ? 'border-black bg-white shadow-hard-sm'
                  : 'border-gray-200 bg-gray-50 opacity-80 hover:opacity-100'}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  w-6 h-6 flex-shrink-0 flex items-center justify-center border text-xs font-bold
                  ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-300'}
                `}>
                  {order ? order : (isSelected ? '✓' : '')}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{loc.name}</h3>
                  <p className="text-xs text-gray-500">{loc.type} · {loc.city}</p>
                  <p className="text-xs mt-1 italic text-gray-600">"{loc.context}"</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationList;