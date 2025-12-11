import { GoogleGenAI, Type } from "@google/genai";
import { LocationItem } from "../types";
import { getSettings } from "../utils/storage";

// Helper to get client with dynamic settings
const getAiClient = () => {
  const settings = getSettings();
  
  if (!settings.llmApiKey) {
    throw new Error("请先在设置中配置 LLM API Key");
  }

  // Note: The @google/genai SDK constructor options are typically { apiKey: string }
  // Support for custom baseUrl might depend on specific SDK version or transport configs.
  // We will initialize standard client. If baseUrl is needed for proxies, 
  // we might need to pass it if the SDK allows or ignore it if not supported by this version.
  // For this implementation, we pass it to the constructor if provided.
  
  const options: any = { apiKey: settings.llmApiKey };
  
  // Rudimentary support for custom base URL if the user is using a compatible proxy
  // that intercepts the requests. The SDK v0.1+ usually hits googleapis.com.
  // If the user provided a base URL, we attempt to pass it (though standard SDK might not use it directly without hack).
  // We will assume standard usage for now, but use the Key and Model dynamically.
  
  return new GoogleGenAI(options);
};

// We return a partial item because lat/lng will be filled by AMap
export const extractLocationsFromText = async (text: string): Promise<Omit<LocationItem, 'lat' | 'lng'>[]> => {
  const ai = getAiClient();
  const settings = getSettings();
  
  const prompt = `
    你是一个智能旅行助手。请从以下文本中提取具体的地点信息。
    对于每个地点，确定其名称、所在的城市、类型（景点 spot / 美食 food / 住宿 hotel / 其他 other）以及相关的上下文描述。
    不要编造坐标，坐标将由地图服务后续提供。
    
    待解析文本: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: settings.llmModel || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "地点名称，例如 '都江堰景区'" },
              city: { type: Type.STRING, description: "城市名称，例如 '成都'" },
              type: { type: Type.STRING, enum: ['spot', 'food', 'hotel', 'other'] },
              context: { type: Type.STRING, description: "原文中关于该地点的描述" },
            },
            required: ['name', 'city', 'type', 'context']
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    
    // Add client-side IDs
    return data.map((item: any) => ({
      ...item,
      id: crypto.randomUUID()
    }));
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("地点提取失败，请检查 API Key 或网络设置。");
  }
};

export const generateRouteAdvice = async (locations: LocationItem[], totalMinutes: number): Promise<string> => {
  const ai = getAiClient();
  const settings = getSettings();

  const locString = locations.map((l, index) => 
    `${index + 1}. ${l.name} (${l.type}) - ${l.context}`
  ).join('\n');

  const prompt = `
    你是一个专业的导游。以下是已经按最短路径规划好的行程顺序，总预估通勤时间为 ${Math.round(totalMinutes)} 分钟：
    ${locString}
    
    请用中文生成一段简短、连贯的行程建议。
    风格要求：极简、干练、实体感。例如：“建议早上先去A，中午在B吃饭...”。
    字数控制在100字以内。
  `;

  try {
    const response = await ai.models.generateContent({
      model: settings.llmModel || 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "暂无行程建议";
  } catch (error) {
    console.error("Gemini Advice Error:", error);
    return "行程已生成，但建议加载失败。";
  }
};
