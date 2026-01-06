
import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole } from "../types";

const MAX_RETRIES = 3; 
const BASE_DELAY = 10000; 

export class GeminiTradingService {
  private async callWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = (error?.message || String(error)).toLowerCase();
      
      // 400 或 Not Found 属于参数/配置错误，不应重试，直接抛出
      if (errorMsg.includes("400") || errorMsg.includes("not found") || errorMsg.includes("invalid")) {
        console.error("API 参数错误 (400/Not Found)，停止重试:", errorMsg);
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
        console.warn(`API 压力检测 (重试剩余 ${retries}): 正在等待 ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private cleanAndParseJSON(text: string) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("JSON 解析失败");
    } catch (e) {
      throw new Error("无法从响应中提取合法的 JSON 数据");
    }
  }

  /**
   * 检索股票基础信息
   * @param symbol 股票代码
   * @param apiKey 用户输入的 API Key
   */
  async fetchStockInfo(symbol: string, apiKey: string): Promise<{ name: string; price: number }> {
    const ai = new GoogleGenAI({ apiKey });
    return this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash', 
        contents: `检索证券代码 "${symbol}" 的确切公司全称和【前一交易日的收盘价格】。返回格式: {"name": "...", "price": 0.0}`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.NUMBER }
            },
            required: ["name", "price"]
          }
        },
      });
      return this.cleanAndParseJSON(response.text || '{"name": "Unknown", "price": 100}');
    });
  }

  /**
   * 生成智能体响应
   * @param apiKey 用户输入的 API Key
   */
  async generateAgentResponse(
    role: AgentRole,
    prompt: string,
    systemInstruction: string,
    useSearch: boolean = false,
    modelName: string = 'gemini-3-flash',
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
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          tools: useSearch ? [{ googleSearch: {} }] : undefined,
          temperature: isAnalysisRole ? 0.01 : 0.2,
        },
      });

      const text = response.text || "Agent 响应为空。";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text, sources };
    });
  }
}

export const geminiService = new GeminiTradingService();
