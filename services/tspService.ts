import { LocationItem, RouteResult } from "../types";
import { generateRouteAdvice } from "./openaiService";
import { getDrivingDuration } from "./mapService";

// Simple Nearest Neighbor Algorithm using Real Driving Time
export const solveTSP = async (locations: LocationItem[]): Promise<RouteResult> => {
  console.log('🧮 [DEBUG] 开始TSP路线规划...');
  console.log('📍 [DEBUG] 参与规划的地点数量:', locations.length);
  console.log('📋 [DEBUG] 地点详情:', locations.map((l, i) => `${i+1}. ${l.name} (${l.lat}, ${l.lng})`).join('\n'));
  
  if (locations.length < 2) {
    console.log('⚠️ [DEBUG] 地点数量不足，返回提示信息');
    return {
      sequence: locations.map(l => l.id),
      totalDurationMinutes: 0,
      advice: "请选择更多地点以规划路线。"
    };
  }

  const unvisited = new Set(locations.map(l => l.id));
  const sequence: string[] = [];
  
  // Start with the first location in the list (User preference usually implies start)
  let currentId = locations[0].id;
  sequence.push(currentId);
  unvisited.delete(currentId);
  console.log('🎯 [DEBUG] 起始地点:', locations[0].name);
  
  let totalDurationSeconds = 0;
  let stepCount = 0;

  // We need to fetch durations.
  // To avoid N^2 API calls in this simple demo, we will use a Greedy approach:
  // At each step, calculate duration to all unvisited nodes and pick the smallest.
  // This requires (N-1) + (N-2) ... = N^2/2 calls.
  // For < 10 locations, this is manageable (e.g. 5 locs = 4+3+2+1 = 10 calls).
  
  while (unvisited.size > 0) {
    stepCount++;
    const currentLoc = locations.find(l => l.id === currentId)!;
    let nearestId = "";
    let minDuration = Infinity;

    console.log(`🔄 [DEBUG] 步骤 ${stepCount}: 当前在 ${currentLoc.name}, 剩余 ${unvisited.size} 个地点`);

    // Fetch duration to all remaining candidates
    // We execute these in parallel for speed
    const candidates = Array.from(unvisited).map(id => locations.find(l => l.id === id)!);
    console.log('📊 [DEBUG] 候选地点:', candidates.map(c => c.name).join(', '));
    
    // Promise.all to fetch durations
    console.log('⏳ [DEBUG] 正在并行查询驾车时长...');
    const durationPromises = candidates.map(async (candidate) => {
        const duration = await getDrivingDuration(currentLoc, candidate);
        return { id: candidate.id, duration };
    });

    const results = await Promise.all(durationPromises);
    console.log('📈 [DEBUG] 驾车时长查询结果:', results.map(r => ({
      地点: locations.find(l => l.id === r.id)?.name,
      时长: `${Math.round(r.duration/60)}分钟`
    })));

    for (const res of results) {
        if (res.duration < minDuration) {
            minDuration = res.duration;
            nearestId = res.id;
        }
    }

    if (nearestId) {
      const nearestLoc = locations.find(l => l.id === nearestId)!;
      console.log(`✅ [DEBUG] 选择下一个地点: ${nearestLoc.name} (${Math.round(minDuration/60)}分钟)`);
      sequence.push(nearestId);
      unvisited.delete(nearestId);
      totalDurationSeconds += minDuration;
      currentId = nearestId;
    } else {
      console.warn('❌ [DEBUG] 未找到下一个地点，停止规划');
      break;
    }
  }

  const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
  console.log('📊 [DEBUG] TSP规划完成统计:', {
    总步骤: stepCount,
    总时长: `${totalDurationMinutes}分钟`,
    路线序列: sequence.map((id, i) => `${i+1}. ${locations.find(l => l.id === id)?.name}`).join(' -> ')
  });

  // Get AI advice based on this sequence
  const orderedLocations = sequence.map(id => locations.find(l => l.id === id)!);
  console.log('🤖 [DEBUG] 正在生成AI行程建议...');
  const advice = await generateRouteAdvice(orderedLocations, totalDurationMinutes);
  console.log('💡 [DEBUG] AI建议生成完成:', advice);

  return {
    sequence,
    totalDurationMinutes,
    advice
  };
};