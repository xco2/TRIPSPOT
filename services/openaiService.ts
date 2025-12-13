import OpenAI from "openai";
import { LocationItem } from "../types";
import { getSettings } from "../utils/storage";

// Helper to get client with dynamic settings
const getOpenAIClient = () => {
  const settings = getSettings();
  
  if (!settings.llmApiKey) {
    throw new Error("请先在设置中配置 LLM API Key");
  }

  const options: any = {
    apiKey: settings.llmApiKey,
    dangerouslyAllowBrowser: true, // 允许在浏览器中使用
  };

  // 支持自定义base URL (用于本地模型)
  if (settings.llmBaseUrl) {
    options.baseURL = settings.llmBaseUrl;
  }
  
  return new OpenAI(options);
};

// Extract locations from text using OpenAI-compatible API
export const extractLocationsFromText = async (text: string): Promise<Omit<LocationItem, 'lat' | 'lng'>[]> => {
  console.log('🔍 [DEBUG] 开始LLM地点提取...');
  console.log('📝 [DEBUG] 待解析文本:', text);
  
  const client = getOpenAIClient();
  const settings = getSettings();
  
  const prompt = `
    你是一个智能旅行助手。请从以下文本中提取具体的地点信息。
    对于每个地点，确定其名称、所在的城市、类型（景点 spot / 美食 food / 住宿 hotel / 其他 other）以及相关的上下文描述。
    不要编造坐标，坐标将由地图服务后续提供。
    
    请以JSON数组格式返回，每个地点对象包含以下字段：
    - name: 地点名称，例如 '都江堰景区'
    - city: 城市名称，例如 '成都'
    - type: 类型，枚举值 ['spot', 'food', 'hotel', 'other']
    - context: 原文中关于该地点的描述
    
    待解析文本: "${text}"
    
    请确保返回的是有效的JSON格式，不要包含其他文字。
  `;

  console.log('🤖 [DEBUG] LLM请求配置:', {
    model: settings.llmModel || 'gpt-3.5-turbo',
    baseURL: settings.llmBaseUrl || '默认',
    temperature: 0.1,
    response_format: 'json_object'
  });
  console.log('💬 [DEBUG] 发送给LLM的完整提示词:', prompt);

try {
    console.log('⏳ [DEBUG] 正在调用LLM API...');
    const startTime = Date.now();
    
    // 尝试方法1: 使用新的response_format格式
    let response;
    try {
      console.log('🔄 [DEBUG] 尝试方法1: 新版response_format格式');
      response = await client.chat.completions.create({
        model: settings.llmModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的地点提取助手，请严格按照要求的JSON格式返回结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
    } catch (error1: any) {
      console.warn('⚠️ [DEBUG] 新版格式失败，错误信息:', error1.message);
      
      // 如果是response_format相关的错误，尝试回退到通用格式
      if (error1.message?.includes('response_format') || error1.message?.includes('BadRequestError')) {
        console.log('🔄 [DEBUG] 尝试方法2: 通用格式（无response_format约束）');
        response = await client.chat.completions.create({
          model: settings.llmModel || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的地点提取助手，请严格按照要求的JSON格式返回结果，不要包含其他文字。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1
        });
      } else {
        // 如果不是response_format错误，直接抛出
        throw error1;
      }
    }

    const endTime = Date.now();
    console.log(`✅ [DEBUG] LLM API调用完成，耗时 ${endTime - startTime}ms`);
    
    const content = response.choices[0]?.message?.content || "[]";
    console.log('📄 [DEBUG] LLM原始回复内容:', content);
    console.log('📊 [DEBUG] LLM回复统计:', {
      choicesCount: response.choices?.length,
      firstChoice: response.choices[0]?.message?.role,
      contentLength: content?.length,
      finishReason: response.choices[0]?.finish_reason
    });
    
    let data: any;
    try {
      data = JSON.parse(content);
      console.log('🔄 [DEBUG] JSON解析成功:', data);
    } catch (parseError) {
      console.error('❌ [DEBUG] JSON解析失败:', parseError);
      console.log('📄 [DEBUG] 尝试解析的内容:', content);
      throw new Error('LLM返回的JSON格式无效');
    }
    
    // Handle both array and object responses
    const locationsArray = Array.isArray(data) ? data : (data.locations || data.data || []);
    console.log('📍 [DEBUG] 提取到的地点数量:', locationsArray.length);
    console.log('📋 [DEBUG] 提取到的地点详情:', locationsArray);
    
    // Add client-side IDs
    const result = locationsArray.map((item: any) => ({
      ...item,
      id: crypto.randomUUID()
    }));
    
    console.log('🏷️ [DEBUG] 添加ID后的地点列表:', result);
    console.log('✅ [DEBUG] LLM地点提取完成');
    
    return result;
  } catch (error: any) {
    console.error('❌ [DEBUG] OpenAI/LLM提取失败:', error);
    console.error('❌ [DEBUG] 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw new Error(`地点提取失败: ${error.message || "未知错误"}`);
  }
};

export const generateRouteAdvice = async (locations: LocationItem[], totalMinutes: number): Promise<string> => {
  console.log('🤖 [DEBUG] 开始生成AI行程建议...');
  console.log('📍 [DEBUG] 行程地点数量:', locations.length);
  console.log('⏱️ [DEBUG] 总时长:', `${Math.round(totalMinutes)}分钟`);
  
  const client = getOpenAIClient();
  const settings = getSettings();

  const locString = locations.map((l, index) =>
    `${index + 1}. ${l.name} (${l.type}) - ${l.context}`
  ).join('\n');
  
  console.log('📋 [DEBUG] 行程地点列表:', locString);

  const prompt = `
    你是一个专业的导游。以下是已经按最短路径规划好的行程顺序，总预估通勤时间为 ${Math.round(totalMinutes)} 分钟：
    ${locString}
    
    请用中文生成一段简短、连贯的行程建议。
    风格要求：极简、干练、实体感。例如："建议早上先去A，中午在B吃饭..."。
    字数控制在100字以内。
  `;

  console.log('💬 [DEBUG] AI建议提示词:', prompt);
  console.log('🔧 [DEBUG] AI模型配置:', {
    model: settings.llmModel || 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 200
  });

try {
    console.log('⏳ [DEBUG] 正在调用LLM生成建议...');
    const startTime = Date.now();
    
    // 直接使用通用格式，避免response_format兼容性问题
    const response = await client.chat.completions.create({
      model: settings.llmModel || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的旅行导游，擅长提供简洁实用的行程建议。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const endTime = Date.now();
    console.log(`✅ [DEBUG] AI建议生成完成，耗时 ${endTime - startTime}ms`);
    
    const advice = response.choices[0]?.message?.content || "暂无行程建议";
    console.log('💡 [DEBUG] AI生成的建议:', advice);
    
    return advice;
  } catch (error: any) {
    console.error('❌ [DEBUG] AI建议生成失败:', error);
    console.error('❌ [DEBUG] 错误详情:', {
      message: error.message,
      stack: error.stack
    });
    return "行程已生成，但建议加载失败。";
  }
};