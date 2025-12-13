import React, { useState, useEffect } from 'react';
import { LocationItem, ParsingStatus, RouteResult, RoutingStatus } from './types';
import InputSection from './components/InputSection';
import LocationList from './components/LocationList';
import MapContainer from './components/MapContainer';
import Button from './components/ui/Button';
import Login from './components/Login';
import Settings from './components/Settings';
import { extractLocationsFromText } from './services/openaiService';
import { geocodeLocations } from './services/mapService';
import { solveTSP } from './services/tspService';
import { generateOfflineHTML } from './utils/htmlGenerator';
import { getSettings, isUserLoggedIn } from './utils/storage';

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

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [showSettings, setShowSettings] = useState(false);
  
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [parsingStatus, setParsingStatus] = useState<ParsingStatus>('idle');
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>('idle');
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Auth State and global error handling
  useEffect(() => {
    // Setup global error handling
    setupGlobalErrorHandling();
    
    if (isUserLoggedIn()) {
      setView('main');
    }
  }, []);

  // Map Loading Logic - Depends on Settings
  useEffect(() => {
    if (view !== 'main') return;

    const settings = getSettings();
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
  }, [view]); // Reload logic if view changes to main, relies on settings being saved triggers reload in Settings component

  const handleParse = async (text: string) => {
    console.log('🚀 [DEBUG] 点击提取按钮 - 开始处理');
    console.log('📝 [DEBUG] 输入文本长度:', text.length);
    console.log('🗺️ [DEBUG] 地图加载状态:', mapLoaded);
    
    if (!mapLoaded) {
      const settings = getSettings();
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
      
      console.log('💾 [DEBUG] 步骤3: 更新UI状态');
      setLocations(validLocations);
      setSelectedIds(new Set(validLocations.map(l => l.id)));
      setRoute(null);
      setParsingStatus('success');
      
      console.log('✅ [DEBUG] 地点提取完成！', {
        总数: validLocations.length,
        已选中: validLocations.length
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
    if (route) setRoute(null);
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
      
      setRoute(result);
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
            
            <div className="mt-4 h-[calc(100vh-350px)]">
              <LocationList 
                locations={locations} 
                selectedIds={selectedIds} 
                onToggleSelect={toggleSelection}
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
               {!getSettings().amapKey ? (
                 <>
                  <p className="font-bold text-lg mb-2">欢迎使用旅点 TripSpot</p>
                  <p className="text-gray-500 mb-4">请先点击右上角「设置」配置高德地图 API Key</p>
                  <Button onClick={() => setShowSettings(true)}>去配置</Button>
                 </>
               ) : (
                 <>
                  <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mb-4"></div>
                  <p className="font-bold">正在连接地图服务...</p>
                 </>
               )}
             </div>
          ) : (
            <MapContainer 
              locations={locations} 
              selectedIds={selectedIds}
              routeSequence={route?.sequence || null}
              mapLoaded={mapLoaded}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
