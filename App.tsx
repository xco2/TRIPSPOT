import React, { useState, useEffect } from 'react';
import { LocationItem, ParsingStatus, RouteResult, RoutingStatus } from './types';
import { useLiveQuery } from 'dexie-react-hooks';
import InputSection from './components/InputSection';
import LocationList from './components/LocationList';
import MapContainer from './components/MapContainer';
import Button from './components/ui/Button';
import Login from './components/Login';
import Settings from './components/Settings';
import LocationFormModal from './components/LocationFormModal';
import { extractLocationsFromText } from './services/openaiService';
import { geocodeLocations } from './services/mapService';
import { solveTSP } from './services/tspService';
import { generateOfflineHTML } from './utils/htmlGenerator';
import { db, saveSettingsToDB, getSettingsFromDB } from './src/db';
import { isUserLoggedIn } from './utils/storage';

// Global error handler for devtools and runtime errors
const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error && typeof error === 'object' && error.message &&
        error.message.includes('devtools')) {
      console.warn('🛠️ [WARN] 检测到DevTools相关错误，已忽略:', error.message);
      event.preventDefault(); // Prevent default error handling
      return;
    }
    console.error('❌ [ERROR] 未处理的Promise拒绝:', error);
  });

  // Handle general runtime errors
  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error && typeof error === 'object' && error.message &&
        error.message.includes('devtools')) {
      console.warn('🛠️ [WARN] 检测到DevTools运行时错误，已忽略:', error.message);
      event.preventDefault();
      return;
    }
    console.error('❌ [ERROR] 运行时错误:', error);
  });
};

type ViewState = 'login' | 'main';

const AsyncMapLoad: React.FC<{ onShowSettings: () => void }> = ({ onShowSettings }) => {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getSettingsFromDB().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <>
        <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mb-4"></div>
        <p className="font-bold">正在连接地图服务...</p>
      </>
    );
  }

  return !settings.amapKey ? (
    <>
      <p className="font-bold text-lg mb-2">欢迎使用旅点 TripSpot</p>
      <p className="text-gray-500 mb-4">请先点击右上角「设置」配置高德地图 API Key</p>
      <Button onClick={onShowSettings}>去配置</Button>
    </>
  ) : (
    <>
      <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mb-4"></div>
      <p className="font-bold">正在连接地图服务...</p>
    </>
  );
};

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [showSettings, setShowSettings] = useState(false);
  
  // 使用 useLiveQuery 自动同步 DB 数据
  const locations = useLiveQuery(() => db.locations.toArray()) || [];
  const routeData = useLiveQuery(() => db.route.get(1));
  const route = routeData?.data || null;
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clickedLocationId, setClickedLocationId] = useState<string | null>(null);
  const [showLocationLabels, setShowLocationLabels] = useState(true);
  const [parsingStatus, setParsingStatus] = useState<ParsingStatus>('idle');
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>('idle');
  const [mapLoaded, setMapLoaded] = useState(false);

  // 控制 Modal 的状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | undefined>(undefined);

  // Initialize Auth State and global error handling
  useEffect(() => {
    // Setup global error handling
    setupGlobalErrorHandling();
    
    if (isUserLoggedIn()) {
      setView('main');
    }
  }, []);

  // Map Loading Logic - 需要异步获取 setting
  useEffect(() => {
    if (view !== 'main') return;

    const initMap = async () => {
      const settings = await getSettingsFromDB();
      if (!settings.amapKey) {
        // If no key is configured, we can't load the map. 
        // User needs to go to settings.
        return;
      }

      // Check if config exists, if not set it
      if (!window._AMapSecurityConfig) {
         console.log('🔧 [DEBUG] 检查高德地图安全配置:', {
           hasSecurityCode: !!settings.amapSecurityCode,
           securityCodeLength: settings.amapSecurityCode?.length || 0,
           hasAmapKey: !!settings.amapKey
         });
         
         // 只有在有安全密钥的情况下才配置，否则不设置
         if (settings.amapSecurityCode && settings.amapSecurityCode.trim()) {
           console.log('🔧 [DEBUG] 设置高德地图安全配置');
           window._AMapSecurityConfig = {
             securityJsCode: settings.amapSecurityCode,
           };
         } else {
           console.log('🔧 [DEBUG] 无安全密钥，跳过安全配置');
         }
      }
      
      // 1. If AMap is already available
      if (window.AMap) {
        setMapLoaded(true);
        return;
      }

      // 2. Define Callback for Async Loading
      window.onAMapLoaded = () => {
        setTimeout(() => {
          setMapLoaded(true);
        }, 100);
      };

      // 3. Prevent duplicate script injection
      const scriptId = 'amap-js-api';
      const existingScript = document.getElementById(scriptId);
      
      if (existingScript) {
        const interval = setInterval(() => {
          if (window.AMap) {
            setMapLoaded(true);
            clearInterval(interval);
          }
        }, 500);
        return () => clearInterval(interval);
      }

      // 4. Inject Script with Callback using Key from Settings
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${settings.amapKey}&callback=onAMapLoaded`;
      script.async = true;
      script.onerror = () => {
        alert("高德地图加载失败，请在设置中检查 API Key");
      };
      document.body.appendChild(script);

      return () => {
        window.onAMapLoaded = undefined;
      };
    };
    initMap();
  }, [view]); // Reload logic if view changes to main, relies on settings being saved triggers reload in Settings component

  // 处理手动添加/保存
  const handleSaveLocation = async (data: Omit<LocationItem, 'id' | 'lat' | 'lng'>) => {
    if (editingLocation) {
      // 编辑模式
      await db.locations.update(editingLocation.id, {
        ...data,
        // 如果改了城市/名字，可能需要重新获取坐标，这里简化处理，假设用户手动改的不重置坐标
        // 或者是为了严谨，这里可以置空 lat/lng 让用户重新点击"提取" (逻辑会复杂)
        // 简单方案：保留原坐标。
      });
    } else {
      // 新增模式 - 自动进行地理编码
      const newLocationId = crypto.randomUUID();
      await db.locations.add({
        id: newLocationId,
        ...data,
        lat: 0,
        lng: 0
      });
      
      // 自动触发地理编码
      try {
        console.log('🗺️ [DEBUG] 开始自动地理编码手动添加的地点:', data.name);
        const geocodedLocations = await geocodeLocations([{ ...data, id: newLocationId }]);
        if (geocodedLocations.length > 0) {
          const geocoded = geocodedLocations[0];
          await db.locations.update(newLocationId, {
            lat: geocoded.lat,
            lng: geocoded.lng
          });
          console.log('✅ [DEBUG] 自动地理编码成功:', geocoded);
        } else {
          console.warn('⚠️ [DEBUG] 自动地理编码失败，地点可能没有坐标');
        }
      } catch (geocodeError) {
        console.error('❌ [DEBUG] 自动地理编码失败:', geocodeError);
        // 不阻断用户添加，只记录错误
      }
    }
    setEditingLocation(undefined);
  };

  // 处理删除
  const handleDeleteLocation = async (id: string) => {
    if (confirm('确定删除这个地点吗？')) {
      await db.locations.delete(id);
      // 如果删除了地点，建议清除路线
      await db.route.clear();
    }
  };

  // 导出功能 (JSON)
  const handleExportJSON = async () => {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      locations: await db.locations.toArray(),
      route: (await db.route.get(1))?.data || null
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripspot_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // 导入功能
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.locations) {
          await db.transaction('rw', db.locations, db.route, async () => {
            await db.locations.clear();
            await db.locations.bulkAdd(json.locations);
            await db.route.clear();
            if (json.route) {
               await db.route.put({ id: 1, data: json.route });
            }
          });
          alert('行程加载成功！');
        }
      } catch (err) {
        alert('文件格式错误');
      }
    };
    reader.readAsText(file);
  };

  const handleParse = async (text: string) => {
    console.log('🚀 [DEBUG] 点击提取按钮 - 开始处理');
    console.log('📝 [DEBUG] 输入文本长度:', text.length);
    console.log('🗺️ [DEBUG] 地图加载状态:', mapLoaded);
    
    if (!mapLoaded) {
      const settings = await getSettingsFromDB();
      if (!settings.amapKey) {
         console.warn('⚠️ [DEBUG] 高德地图API Key未配置');
         alert("请先点击右上角设置，配置高德地图 API Key");
         setShowSettings(true);
         return;
      }
      console.log('⏳ [DEBUG] 地图服务正在初始化');
      alert("地图服务正在初始化，请稍等...");
      return;
    }

    console.log('✅ [DEBUG] 开始地点提取流程');
    setParsingStatus('parsing');
    
    try {
      console.log('🔍 [DEBUG] 步骤1: 开始LLM地点提取');
      // 1. LLM Extract (OpenAI-compatible)
      const rawLocations = await extractLocationsFromText(text);
      console.log('📊 [DEBUG] LLM提取结果:', rawLocations);
      
      console.log('🗺️ [DEBUG] 步骤2: 开始地理编码');
      setParsingStatus('geocoding');
      // 2. Real Geocoding via AMap
      const validLocations = await geocodeLocations(rawLocations);
      console.log('📍 [DEBUG] 地理编码结果:', validLocations);
      
      console.log('💾 [DEBUG] 步骤3: 保存到数据库');
      
      // 获取现有地点
      const existingLocations = await db.locations.toArray();
      console.log('📋 [DEBUG] 现有地点数量:', existingLocations.length);
      
      // 检查重复，地点名称完全一致的才跳过
      const existingNames = new Set(existingLocations.map(l => l.name));
      const newLocations = validLocations.filter(loc => !existingNames.has(loc.name));
      const skippedLocations = validLocations.filter(loc => existingNames.has(loc.name));
      
      console.log('🆕 [DEBUG] 新增地点数量:', newLocations.length);
      console.log('⏭️ [DEBUG] 跳过重复地点:', skippedLocations.length, skippedLocations.map(l => l.name));
      
      if (newLocations.length > 0) {
        // 合并新地点
        await db.locations.bulkAdd(newLocations);
        // 更新选中状态
        const allSelectedIds = new Set([...selectedIds, ...newLocations.map(l => l.id)]);
        setSelectedIds(allSelectedIds);
      }
      
      // 清除现有路线（因为地点变更了）
      await db.route.clear();
      setParsingStatus('success');
      
      console.log('✅ [DEBUG] 地点提取完成！', {
        原有: existingLocations.length,
        新增: newLocations.length,
        跳过: skippedLocations.length,
        总数: existingLocations.length + newLocations.length,
        已选中: selectedIds.size + newLocations.length
      });
    } catch (error: any) {
      console.error('❌ [DEBUG] 地点提取失败:', error);
      setParsingStatus('error');
      alert(`提取失败: ${error.message || "未知错误"}`);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    if (route) {
      db.route.clear(); // 清除路线
    }
  };

  const handleMarkerClick = (id: string) => {
    setClickedLocationId(id);
  };

  const handleRoutePlanning = async () => {
    console.log('🛣️ [DEBUG] 点击路线规划按钮');
    console.log('🗺️ [DEBUG] 地图加载状态:', mapLoaded);
    console.log('📍 [DEBUG] 选中地点数量:', selectedIds.size);
    console.log('📋 [DEBUG] 所有地点:', locations.map(l => `${l.name} (${selectedIds.has(l.id) ? '已选' : '未选'})`).join(', '));
    
    if (!mapLoaded) {
       console.warn('⚠️ [DEBUG] 地图服务未就绪');
       alert("地图服务未就绪，请检查 API Key 配置");
       return;
    }
    if (selectedIds.size < 2) {
      console.warn('⚠️ [DEBUG] 选中地点不足');
      alert("请至少选择2个地点进行路线规划。");
      return;
    }
    
    console.log('🧮 [DEBUG] 开始路线规划流程');
    setRoutingStatus('calculating');
    
    const activeLocations = locations.filter(l => selectedIds.has(l.id));
    console.log('📍 [DEBUG] 参与规划的地点:', activeLocations.map((l, i) => `${i+1}. ${l.name}`).join(' -> '));
    
    try {
      console.log('⏳ [DEBUG] 正在执行TSP算法...');
      const startTime = Date.now();
      
      const result = await solveTSP(activeLocations);
      
      const endTime = Date.now();
      console.log(`✅ [DEBUG] TSP规划完成，耗时 ${endTime - startTime}ms`);
      console.log('📊 [DEBUG] TSP结果:', result);
      
      // 保存路线到数据库
      await db.route.put({ id: 1, data: result });
      setRoutingStatus('success');
      
      console.log('🎉 [DEBUG] 路线规划完成！', {
        路线长度: result.sequence.length,
        总时长: `${result.totalDurationMinutes}分钟`,
        建议: result.advice
      });
    } catch (error: any) {
      console.error('❌ [DEBUG] 路线规划失败:', error);
      setRoutingStatus('error');
      alert("路线计算失败，请稍后重试。");
    }
  };

  const handleExport = () => {
    if (!route || locations.length === 0) return;
    
    const htmlContent = generateOfflineHTML(locations, route);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip_plan_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (view === 'login') {
    return <Login onLoginSuccess={() => setView('main')} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Settings Modal */}
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          onLogout={() => {
            setShowSettings(false);
            setView('login');
          }}
        />
      )}

      {/* Header */}
      <header className="h-16 border-b border-black flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black"></div>
          <h1 className="text-xl font-bold tracking-tighter">旅点 TRIPSPOT</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-xs text-gray-400 font-mono hidden sm:block">v1.5 家庭版</div>
           <div className="flex items-center gap-2">
             <button
              onClick={() => setShowLocationLabels(!showLocationLabels)}
              className="group flex items-center gap-2 focus:outline-none cursor-pointer"
            >
              <span className={`text-sm font-bold select-none transition-colors duration-300 ${showLocationLabels ? 'text-black' : 'text-gray-400'}`}>
                地点标签
              </span>
              
              {/* 开关容器 */}
              <div 
                className={`
                  relative w-12 h-6 border-2 border-black transition-colors duration-300
                  ${showLocationLabels ? 'bg-black' : 'bg-white'}
                `}
                // 这里保留一点硬阴影，增加立体感，但不做位移动画以免干扰开关的流畅度
                style={{ boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)' }} 
              >
                {/* 滑块 (Knob) */}
                <div 
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 border-2
                    transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${showLocationLabels 
                      ? 'translate-x-6 bg-white border-white' // 激活：向右平移 + 变白
                      : 'translate-x-0 bg-black border-black' // 未激活：原点 + 变黑
                    }
                  `}
                />
              </div>
            </button>
           </div>
           <Button variant="ghost" onClick={() => setShowSettings(true)} className="px-2">
             ⚙️ 设置
           </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Controls & List */}
        <div className="w-[400px] border-r border-black flex flex-col bg-white overflow-hidden shrink-0">
          <div className="p-4 overflow-y-auto flex-1">
            <InputSection 
              onParse={handleParse} 
              isLoading={parsingStatus === 'parsing' || parsingStatus === 'geocoding'} 
              mapLoaded={mapLoaded}
            />
            {parsingStatus === 'geocoding' && (
              <div className="text-center text-xs text-gray-500 mb-2">正在通过高德 API 获取精准坐标...</div>
            )}
            
            {/* 在 LocationList 上方增加按钮 */}
            <div className="flex gap-2 mb-2">
               <Button onClick={() => { setEditingLocation(undefined); setIsModalOpen(true); }} className="flex-1">
                 + 手动添加
               </Button>
               {/* 隐藏的文件输入框用于导入 */}
               <input type="file" id="importJson" className="hidden" accept=".json" onChange={handleImportJSON} />
               <Button variant="secondary" onClick={() => document.getElementById('importJson')?.click()}>
                  📂 载入
               </Button>
               <Button variant="secondary" onClick={handleExportJSON}>
                  💾 保存
               </Button>
            </div>
            
            <div className="mt-4 h-[calc(100vh-350px)]">
              <LocationList
                locations={locations}
                selectedIds={selectedIds}
                clickedLocationId={clickedLocationId}
                onToggleSelect={toggleSelection}
                onDelete={handleDeleteLocation}
                onEdit={(loc) => { setEditingLocation(loc); setIsModalOpen(true); }}
                routeSequence={route?.sequence}
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 border-t border-black bg-white space-y-3">
             {route && (
               <div className="bg-muted p-3 border border-black text-sm mb-2">
                 <p className="font-bold mb-1">AI 导游建议:</p>
                 <p className="italic text-gray-600 line-clamp-3 leading-snug">{route.advice}</p>
                 <div className="mt-2 text-xs font-bold text-right">
                    总耗时: 约 {route.totalDurationMinutes} 分钟
                 </div>
               </div>
             )}

            <div className="flex gap-2">
              <Button 
                fullWidth 
                onClick={handleRoutePlanning}
                disabled={!mapLoaded || selectedIds.size < 2 || routingStatus === 'calculating'}
              >
                {!mapLoaded ? '等待地图 / 未配置 Key' : routingStatus === 'calculating' ? '计算最优路线中...' : '⚡️ 智能规划路线'}
              </Button>
              <Button 
                variant="secondary"
                onClick={handleExport}
                disabled={!route}
                title="导出离线 HTML"
              >
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* Right Area: Map */}
        <div className="flex-1 bg-gray-100 p-4">
          {!mapLoaded ? (
             <div className="w-full h-full flex flex-col items-center justify-center border border-black bg-white">
               {/* 需要异步获取设置 */}
               <AsyncMapLoad onShowSettings={() => setShowSettings(true)} />
             </div>
          ) : (
            <MapContainer
              locations={locations}
              selectedIds={selectedIds}
              clickedLocationId={clickedLocationId}
              showLocationLabels={showLocationLabels}
              onMarkerClick={handleMarkerClick}
              routeSequence={route?.sequence || null}
              mapLoaded={mapLoaded}
            />
          )}
        </div>
      </div>

      <LocationFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLocation}
        initialData={editingLocation}
      />
    </div>
  );
}

export default App;