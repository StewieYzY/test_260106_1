
import { GoogleGenAI, Type, GenerateContentParameters } from "@google/genai";
import { AgentRole } from "../types";

const MAX_RETRIES = 2; 
const BASE_DELAY = 10000; 

export class GeminiTradingService {
  private async callWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = (error?.message || String(error)).toLowerCase();
      
      // 捕获 400/404 等由于配置或权限导致的硬错误
      if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("invalid") || errorMsg.includes("400")) {
        console.error("Gemini API Hard Error:", errorMsg);
        
        if (errorMsg.includes("not found")) {
          throw new Error("MODEL_NOT_FOUND: 当前 API Key 无权访问该模型，请在设置中尝试更换。");
        }
        if (errorMsg.includes("mime type") || errorMsg.includes("unsupported")) {
          throw new Error("CONFIG_CONFLICT: 工具使用与响应格式冲突。请联系开发者检查 Grounding 配置。");
        }
        throw error;
      }

      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("resource_exhausted") || errorMsg.includes("too many requests");
      const isQuotaExhausted = errorMsg.includes("current quota") || errorMsg.includes("daily limit") || errorMsg.includes("daily_quota_exhausted");

      if (isQuotaExhausted) {
        throw new Error("DAILY_QUOTA_EXHAUSTED");
      }

      if (retries > 0) {
        const multiplier = isRateLimit ? 2 : 1.5;
        const delay = Math.pow(multiplier, MAX_RETRIES - retries + 1) * BASE_DELAY;
        console.warn(`[Retry] API 压力 (剩余 ${retries}): 延迟 ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private cleanAndParseJSON(text: string) {
    try {
      // 增强 JSON 提取逻辑，防止模型返回包含 Markdown 标记的代码块
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error("Result is not a valid JSON");
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error("无法解析 Agent 返回的结构化数据，请重试。");
    }
  }

  /**
   * 检索股票基础信息（Grounding 模式）
   * 注意：Grounding 模式下严禁使用 responseMimeType
   */
  async fetchStockInfo(symbol: string, apiKey: string): Promise<{ name: string; price: number }> {
    const ai = new GoogleGenAI({ apiKey });
    return this.callWithRetry(async () => {
      // 显式构建请求参数，确保没有 responseMimeType
      const params: GenerateContentParameters = {
        model: 'gemini-flash-latest', 
        contents: [{ 
          parts: [{ 
            text: `检索证券代码 "${symbol}" 的确切公司全称和【前一交易日的收盘价格】。请直接返回 JSON 格式，格式如下（不要包含 markdown 标记）: {"name": "...", "price": 0.0}` 
          }] 
        }],
        config: {
          tools: [{ googleSearch: {} }],
          // 绝对不要在这里添加 responseMimeType: "application/json"
          temperature: 0.0,
        },
      };

      const response = await ai.models.generateContent(params);
      const text = response.text || "";
      return this.cleanAndParseJSON(text || '{"name": "Unknown", "price": 100}');
    });
  }

  /**
   * 生成智能体响应
   */
  async generateAgentResponse(
    role: AgentRole,
    prompt: string,
    systemInstruction: string,
    useSearch: boolean = false,
    modelName: string = 'gemini-flash-latest',
    apiKey: string
  ): Promise<{ text: string; sources?: any[] }> {
    const ai = new GoogleGenAI({ apiKey });
    return this.callWithRetry(async () => {
      const isAnalysisRole = [
        AgentRole.FUNDAMENTAL_ANALYST, 
        AgentRole.SENTIMENT_ANALYST, 
        AgentRole.NEWS_POLICY_ANALYST, 
        AgentRole.TECHNICAL_ANALYST
      ].includes(role);
      
      const params: GenerateContentParameters = {
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: systemInstruction,
          temperature: isAnalysisRole ? 0.01 : 0.2,
        },
      };

      // 仅在需要搜索时注入工具，且此时同样不设置 mimeType
      if (useSearch) {
        params.config!.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent(params);
      const text = response.text || "Agent 响应为空。";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text, sources };
    });
  }
}

export const geminiService = new GeminiTradingService();
