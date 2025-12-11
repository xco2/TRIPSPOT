import { LocationItem, RouteResult } from "../types";
import { generateRouteAdvice } from "./geminiService";
import { getDrivingDuration } from "./mapService";

// Simple Nearest Neighbor Algorithm using Real Driving Time
export const solveTSP = async (locations: LocationItem[]): Promise<RouteResult> => {
  if (locations.length < 2) {
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
  
  let totalDurationSeconds = 0;

  // We need to fetch durations. 
  // To avoid N^2 API calls in this simple demo, we will use a Greedy approach:
  // At each step, calculate duration to all unvisited nodes and pick the smallest.
  // This requires (N-1) + (N-2) ... = N^2/2 calls.
  // For < 10 locations, this is manageable (e.g. 5 locs = 4+3+2+1 = 10 calls).
  
  while (unvisited.size > 0) {
    const currentLoc = locations.find(l => l.id === currentId)!;
    let nearestId = "";
    let minDuration = Infinity;

    // Fetch duration to all remaining candidates
    // We execute these in parallel for speed
    const candidates = Array.from(unvisited).map(id => locations.find(l => l.id === id)!);
    
    // Promise.all to fetch durations
    const durationPromises = candidates.map(async (candidate) => {
        const duration = await getDrivingDuration(currentLoc, candidate);
        return { id: candidate.id, duration };
    });

    const results = await Promise.all(durationPromises);

    for (const res of results) {
        if (res.duration < minDuration) {
            minDuration = res.duration;
            nearestId = res.id;
        }
    }

    if (nearestId) {
      sequence.push(nearestId);
      unvisited.delete(nearestId);
      totalDurationSeconds += minDuration;
      currentId = nearestId;
    } else {
      break;
    }
  }

  const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

  // Get AI advice based on this sequence
  const orderedLocations = sequence.map(id => locations.find(l => l.id === id)!);
  const advice = await generateRouteAdvice(orderedLocations, totalDurationMinutes);

  return {
    sequence,
    totalDurationMinutes,
    advice
  };
};