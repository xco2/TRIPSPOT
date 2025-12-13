import { LocationItem } from "../types";
import { getSettingsFromDB } from "../src/db";

// Helper to check AMap availability
const ensureAMap = () => {
  if (!window.AMap) {
    throw new Error("高德地图 JS API 未加载");
  }
};

// Global error handler for runtime errors (particularly for devtools conflicts)
const handleRuntimeError = (error: any) => {
  // Check if this is a devtools-related error
  if (error && typeof error === 'object' && error.message &&
      error.message.includes('devtools')) {
    console.warn('🛠️ [WARN] DevTools检测到运行时错误，已忽略:', error.message);
    return;
  }
  
  // Log other errors normally
  console.error('❌ [ERROR] 运行时错误:', error);
  throw error;
};

// Real Geocoding using AMap RESTful API
export const geocodeLocations = async (
  rawItems: Omit<LocationItem, 'lat' | 'lng'>[]
): Promise<LocationItem[]> => {
  console.log('🗺️ [DEBUG] 开始地理编码(RESTful API)...');
  console.log('📍 [DEBUG] 待编码地点数量:', rawItems.length);
  console.log('📋 [DEBUG] 待编码地点详情:', rawItems);
  
  const settings = await getSettingsFromDB();
  if (!settings.amapKey) {
    console.error('❌ [DEBUG] 高德API Key未配置');
    throw new Error("请先在设置中配置高德地图 API Key");
  }

  const results: LocationItem[] = [];

  if (rawItems.length === 0) {
    console.log('⚠️ [DEBUG] 没有地点需要编码');
    return [];
  }

  console.log('🌍 [DEBUG] 开始批量地理编码...');
  console.log('🔑 [DEBUG] API Key状态:', {
    hasKey: !!settings.amapKey,
    keyLength: settings.amapKey.length
  });

  // 批量调用地理编码API
  for (const [index, item] of rawItems.entries()) {
    try {
      const address = `${item.city}${item.name}`;
      const city = item.city;
      
      console.log(`🔍 [DEBUG] [${index + 1}/${rawItems.length}] 正在编码: ${item.name}`);
      console.log(`📍 [DEBUG] 地址: ${address}, 城市: ${city}`);
      
      // 构建请求URL
      const params = new URLSearchParams({
        key: settings.amapKey,
        address: address,
        city: city,
        output: 'JSON'
      });
      
      const url = `https://restapi.amap.com/v3/geocode/geo?${params}`;
      console.log(`📞 [DEBUG] 请求URL:`, url.replace(settings.amapKey, 'HIDDEN_KEY'));
      
      const response = await fetch(url);
      console.log(`📡 [DEBUG] [${index + 1}/${rawItems.length}] HTTP响应状态:`, response.status);
      
      try {
        if (!response.ok) {
          console.error(`❌ [DEBUG] [${index + 1}/${rawItems.length}] HTTP请求失败:`, response.status, response.statusText);
          continue;
        }
        
        const data = await response.json();
        console.log(`📄 [DEBUG] [${index + 1}/${rawItems.length}] API响应:`, data);
        
        if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
          const location = data.geocodes[0].location;
          const [lng, lat] = location.split(',').map(Number);
          
          console.log(`✅ [DEBUG] [${index + 1}/${rawItems.length}] 编码成功: ${item.name} -> (${lat}, ${lng})`);
          console.log(`🏷️ [DEBUG] [${index + 1}/${rawItems.length}] 详细地址:`, data.geocodes[0].formatted_address);
          
          results.push({
            ...item,
            lat: lat,
            lng: lng
          });
        } else {
          console.warn(`❌ [DEBUG] [${index + 1}/${rawItems.length}] 地理编码失败: ${item.name}`, {
            status: data.status,
            info: data.info,
            count: data.count
          });
        }
      } catch (jsonError) {
        console.error(`❌ [DEBUG] [${index + 1}/${rawItems.length}] JSON解析错误:`, jsonError);
        continue;
      }
      
      // 添加小延迟避免API频率限制
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ [DEBUG] [${index + 1}/${rawItems.length}] 编码异常: ${item.name}`, error);
    }
  }

  console.log('🎯 [DEBUG] 批量地理编码完成');
  console.log('📈 [DEBUG] 编码统计:', {
    总数: rawItems.length,
    成功: results.length,
    失败: rawItems.length - results.length,
    成功率: `${Math.round((results.length / rawItems.length) * 100)}%`
  });
  console.log('📍 [DEBUG] 最终结果:', results);
  
  return results;
};

// Calculate driving duration between two points using AMap.Driving
// Note: Doing this for N*N matrix on client side might hit rate limits.
// We will use a simplified approach: batch request if possible, or sequential.
export const getDrivingDuration = async (
  start: LocationItem,
  end: LocationItem
): Promise<number> => {
  console.log('🚗 [DEBUG] 开始计算驾车时长...');
  console.log(`📍 [DEBUG] 起点: ${start.name} (${start.lat}, ${start.lng})`);
  console.log(`📍 [DEBUG] 终点: ${end.name} (${end.lat}, ${end.lng})`);
  
  ensureAMap();
  
  return new Promise((resolve) => {
    window.AMap.plugin('AMap.Driving', () => {
      console.log('🚙 [DEBUG] 驾车导航插件已加载');
      const driving = new window.AMap.Driving({
        policy: window.AMap.DrivingPolicy.LEAST_TIME,
      });

      const p1 = new window.AMap.LngLat(start.lng, start.lat);
      const p2 = new window.AMap.LngLat(end.lng, end.lat);
      
      console.log('🗺️ [DEBUG] 正在查询驾车路线...');

      driving.search(p1, p2, (status: string, result: any) => {
        console.log(`🚗 [DEBUG] 驾车查询完成，状态: ${status}`);
        console.log('🚗 [DEBUG] 查询结果:', result);
        
        if (status === 'complete' && result.routes && result.routes.length) {
          const duration = result.routes[0].time; // Duration is in seconds
          const distance = result.routes[0].distance; // Distance is in meters
          console.log(`✅ [DEBUG] 驾车路线查询成功: ${duration}秒 (${Math.round(distance/1000)}km)`);
          resolve(duration);
        } else {
          console.warn(`⚠️ [DEBUG] 驾车路线查询失败，使用直线距离估算`);
          // Fallback to straight line distance estimate (approx 30km/h)
          const distance = window.AMap.GeometryUtil.distance(p1, p2); // meters
          const speedMps = 30 * 1000 / 3600; // ~8.3 m/s
          const estimatedDuration = distance / speedMps;
          console.log(`📏 [DEBUG] 直线距离: ${Math.round(distance)}m`);
          console.log(`⏱️ [DEBUG] 估算时长: ${Math.round(estimatedDuration)}秒`);
          resolve(estimatedDuration);
        }
      });
    });
  });
};
