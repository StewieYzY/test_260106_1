
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Search, Play, ShieldAlert, BarChart3, MessageSquare, 
  FileText, TrendingUp, TrendingDown, ClipboardCheck, 
  Activity, Loader2, RefreshCw, Calendar, Tag, History, LayoutDashboard, ChevronRight, ArrowLeft, X, Filter, Clock, AlertTriangle, Coffee, Timer, Zap, ShieldCheck, AlertCircle, Info, Settings, Save, RotateCcw, Download, Beaker, Edit3, Check, Ban, Eye, FileOutput, ExternalLink, Gauge, Square, Lock, Key, Cpu
} from 'lucide-react';
import { DatePicker, Select, ConfigProvider, theme, Switch, Tooltip as AntTooltip, Modal, Button, Tag as AntTag, notification, Progress, Input } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { AgentRole, AgentAction, HistoryRecord, ModelType, AgentModelSettings, SentimentMetrics } from './types';
import { geminiService } from './services/geminiService';
import { AGENT_SYSTEM_INSTRUCTIONS, getPromptForStep, INTELLIGENCE_SUB_TASKS } from './services/prompts';

const { RangePicker } = DatePicker;

const PRICE_FORECAST_DAYS = 180;
const COOLDOWN_PRO = 65; 
const COOLDOWN_FLASH = 32;

const STAGE_NAMES = [
  { id: 1, name: '分布式收割' },
  { id: 2, name: '多维分析' },
  { id: 3, name: '多空辩论' },
  { id: 4, name: '风险评估' },
  { id: 5, name: '加权决策' }
];

const DEFAULT_MODELS: AgentModelSettings = {
  [AgentRole.INTELLIGENCE_OFFICER]: 'gemini-3-flash',
  [AgentRole.FUND_SECRETARY]: 'gemini-3-flash',
  [AgentRole.FUND_MANAGER]: 'gemini-3-flash',
  [AgentRole.FUNDAMENTAL_ANALYST]: 'gemini-3-flash',
  [AgentRole.SENTIMENT_ANALYST]: 'gemini-3-flash',
  [AgentRole.NEWS_POLICY_ANALYST]: 'gemini-3-flash',
  [AgentRole.TECHNICAL_ANALYST]: 'gemini-3-flash',
  [AgentRole.BULL_RESEARCHER]: 'gemini-3-flash',
  [AgentRole.BEAR_RESEARCHER]: 'gemini-3-flash',
  [AgentRole.TRADER]: 'gemini-3-flash',
  [AgentRole.RISK_MANAGER]: 'gemini-3-flash'
};

const formatDateTime = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const CustomPriceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl">
        <p className="text-[10px] text-slate-500 font-mono mb-1">{payload[0].payload.date}</p>
        <p className="text-sm font-bold text-blue-400">¥{payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

const GroundingSources = ({ sources }: { sources?: any[] }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-8 pt-6 border-t border-slate-800/50">
      <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2 tracking-tight uppercase">
        <ExternalLink size={14} /> 参考来源 (Fact Check)
      </h3>
      <ul className="space-y-2">
        {sources.map((chunk, idx) => {
          const uri = chunk.web?.uri || chunk.maps?.uri;
          const title = chunk.web?.title || chunk.maps?.title || uri;
          if (!uri) return null;
          return (
            <li key={idx} className="group">
              <a href={uri} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-2 truncate">
                <span className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[8px] font-mono group-hover:bg-blue-500 group-hover:text-white transition-colors">{idx + 1}</span>
                <span className="truncate underline decoration-slate-800 underline-offset-4 group-hover:decoration-blue-500/30">{title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SentimentMetricsPanel = ({ metrics, isWorking }: { metrics?: SentimentMetrics; isWorking?: boolean }) => {
  if (isWorking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="text-[10px] font-mono uppercase tracking-widest">量化透视计算中...</span>
      </div>
    );
  }
  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-20">
        <Gauge size={32} />
        <span className="text-[10px] mt-2 font-mono uppercase text-center">等待舆情分析师<br/>下发量化数据</span>
      </div>
    );
  }
  const renderMetric = (label: string, value: number, max: number, min: number, format: (v: number) => string, colorClass: string, showMidLine: boolean = false) => {
    const percent = ((value - min) / (max - min)) * 100;
    const clampedPercent = Math.min(100, Math.max(0, percent));
    return (
      <div className="flex items-center gap-3 w-full group">
        <span className="w-16 text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full relative overflow-hidden">
          {showMidLine && <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700/50 z-10" />}
          <div className={`h-full transition-all duration-1000 ease-out ${colorClass}`} style={{ width: `${clampedPercent}%` }} />
        </div>
        <span className={`w-10 text-right text-[10px] font-mono font-bold shrink-0 ${colorClass.startsWith('bg-') ? colorClass.replace('bg-', 'text-') : 'text-slate-300'}`}>
          {format(value)}
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-5 w-full">
      {renderMetric("情绪总分", metrics.score || 0, 1, -1, (v) => v.toFixed(2), (metrics.score || 0) >= 0 ? "bg-emerald-500" : "bg-rose-500", true)}
      {renderMetric("信心指数", metrics.confidence || 0, 1, 0, (v) => `${(v * 100).toFixed(0)}%`, "bg-blue-500")}
      {renderMetric("舆情热度", metrics.intensity || 0, 10, 0, (v) => v.toFixed(1), "bg-amber-500")}
      {renderMetric("分歧度", metrics.disagreement || 0, 1, 0, (v) => `${(v * 100).toFixed(0)}%`, (metrics.disagreement || 0) > 0.6 ? "bg-orange-500" : "bg-slate-500")}
      {renderMetric("衰减系数", metrics.decay || 0, 1, 0, (v) => v.toFixed(2), "bg-purple-500")}
    </div>
  );
};

/**
 * 终端鉴权网关 - 手动输入 API Key 的全屏认证组件
 */
function AuthGate({ onInitialize }: { onInitialize: (key: string) => void }) {
  const [keyInput, setKeyInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInit = () => {
    if (!keyInput.trim().startsWith('AIza')) {
      notification.error({ 
        message: '无效凭证', 
        description: '请输入有效的 Gemini API Key (通常以 AIza 开头)' 
      });
      return;
    }
    setIsInitializing(true);
    // 模拟一段极短的校验动画
    setTimeout(() => {
      onInitialize(keyInput.trim());
      setIsInitializing(false);
    }, 800);
  };

  return (
    <div className="h-screen w-screen bg-[#020617] flex items-center justify-center p-6 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.06),transparent_70%)] animate-pulse" />
      <div className="max-w-md w-full bg-slate-900/40 border border-slate-800 rounded-3xl p-10 backdrop-blur-3xl shadow-2xl relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/30 mb-8 relative">
             <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
             <Lock className="w-8 h-8 text-white relative z-10" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">StGTrade <span className="text-blue-500">AI</span></h1>
          <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.3em] mt-3">Advanced Quantitative Terminal</p>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Terminal Credentials</label>
            <Input.Password 
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInit()}
              placeholder="输入您的 Gemini API Key..."
              className="bg-slate-950/80 border-slate-800 text-white h-12 rounded-xl"
              autoFocus
            />
          </div>

          <button 
            onClick={handleInit}
            disabled={isInitializing}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.97] disabled:opacity-50 group"
          >
            {isInitializing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="tracking-tight">初始化加密终端</span>
              </>
            )}
          </button>

          <div className="flex items-start gap-3 opacity-60 px-2 pt-2">
             <ShieldCheck size={14} className="text-blue-400 shrink-0 mt-0.5" />
             <p className="text-[9px] text-slate-500 leading-normal font-medium">
               <span className="text-slate-300">Volatile Storage:</span> 该凭据仅存储在堆栈内存中。刷新页面或关闭标签页将立即物理擦除所有权限。
             </p>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] text-slate-700 font-mono tracking-widest uppercase flex items-center gap-4">
        <span>StG v3.5.0-Release</span>
        <div className="w-1 h-1 rounded-full bg-slate-800" />
        <span>Memory Guard Active</span>
      </div>
    </div>
  );
}

/**
 * 主业务仪表盘
 */
function Dashboard({ terminalKey }: { terminalKey: string }) {
  const [activeView, setActiveView] = useState<'analysis' | 'history' | 'history-detail' | 'settings'>('analysis');
  const [symbol, setSymbol] = useState('688608');
  const [stockName, setStockName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [reports, setReports] = useState<Record<string, { text: string; sources?: any[]; score?: number; sentimentMetrics?: SentimentMetrics }>>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [priceData, setPriceData] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryRecord | null>(null);
  const [filterCode, setFilterCode] = useState('');
  const [agentModels, setAgentModels] = useState<AgentModelSettings>(DEFAULT_MODELS);

  const scrollRef = useRef<HTMLDivElement>(null);
  const priceDataRef = useRef<any[]>([]);
  const shouldStopRef = useRef(false);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [actions]);
  useEffect(() => { priceDataRef.current = priceData; }, [priceData]);

  const filteredHistory = useMemo(() => {
    return (historyList || []).filter((record) => {
      const searchStr = filterCode.toLowerCase();
      return record.symbol.toLowerCase().includes(searchStr) || record.stockName.toLowerCase().includes(searchStr);
    });
  }, [historyList, filterCode]);

  useEffect(() => {
    let timer: number;
    if (cooldownLeft > 0) timer = window.setInterval(() => setCooldownLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  const initCharts = useCallback((startPrice: number) => {
    const pData = [], now = new Date();
    for (let i = 0; i <= PRICE_FORECAST_DAYS; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      pData.push({ index: i, date: d.toISOString().split('T')[0], price: startPrice, isFuture: i > 0 });
    }
    setPriceData(pData);
  }, []);

  const evolvePredictions = useCallback((type: 'price', intensity: number) => {
    setPriceData(prev => prev.map((item, i) => item.isFuture ? { ...item, price: item.price + (item.price * (intensity / 100) * (i / PRICE_FORECAST_DAYS)) + (Math.random() - 0.5) * (item.price * 0.01) } : item));
  }, []);

  const waitCooldown = async (seconds: number) => {
    if (seconds <= 0) return;
    setCooldownLeft(seconds);
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  };

  const getCooldownByModel = (modelName: string): number => {
    // 即使现在都用 flash，保留区分逻辑以应对未来的权限升级
    return modelName.toLowerCase().includes('pro') ? COOLDOWN_PRO : COOLDOWN_FLASH;
  };

  const extractScore = (text: string): number | undefined => {
    const match = text.match(/\[SCORE:\s*(\d+)\]/i);
    return match ? parseInt(match[1]) : undefined;
  };

  const extractSentimentMetrics = (text: string): SentimentMetrics | undefined => {
    try {
      const match = text.match(/\[SENTIMENT_METRICS:\s*(\{[\s\S]*?\})\]/i);
      if (match) return JSON.parse(match[1]);
    } catch (e) { console.warn("Failed to parse sentiment metrics JSON:", e); }
    return undefined;
  };

  const runSOP = async () => {
    if (!symbol || isProcessing) return;
    setIsProcessing(true);
    shouldStopRef.current = false;
    setActions([]); setReports({}); setSelectedReportId(null); setErrorMessage(null);
    setStockName('核验 API 凭证权限...'); setCurrentStep(1);

    let localActions: AgentAction[] = [];
    let localReports: Record<string, { text: string; sources?: any[]; score?: number; sentimentMetrics?: SentimentMetrics }> = {};

    try {
      console.log("🚀 启动分析，API Key 验证中...");
      const stockInfoModel = 'gemini-3-flash';
      const stockInfo = await geminiService.fetchStockInfo(symbol, terminalKey);
      if (shouldStopRef.current) { setIsProcessing(false); return; }
      setBasePrice(stockInfo.price); setStockName(stockInfo.name); initCharts(stockInfo.price);
      
      setStockName(`配额保护中...`);
      await waitCooldown(getCooldownByModel(stockInfoModel)); 
      if (shouldStopRef.current) { setIsProcessing(false); return; }

      const intelSubTasks = [
        { key: 'FINANCE', name: '财务现状检索', prompt: INTELLIGENCE_SUB_TASKS.FINANCE },
        { key: 'SENTIMENT', name: '舆情脉搏检索', prompt: INTELLIGENCE_SUB_TASKS.SENTIMENT },
        { key: 'NEWS', name: '重大新闻检索', prompt: INTELLIGENCE_SUB_TASKS.NEWS },
        { key: 'POLICY', name: '政策环境检索', prompt: INTELLIGENCE_SUB_TASKS.POLICY }
      ];

      const intelModel = agentModels[AgentRole.INTELLIGENCE_OFFICER] || 'gemini-3-flash';
      let rawIntelFragments = "";
      let allIntelSources: any[] = [];
      const intelActionId = Math.random().toString(36).substr(2, 9);
      localActions = [...localActions, { id: intelActionId, role: AgentRole.INTELLIGENCE_OFFICER, status: 'working', startTime: Date.now() }];
      setActions([...localActions]); setSelectedReportId(intelActionId);

      for (let i = 0; i < intelSubTasks.length; i++) {
        if (shouldStopRef.current) break;
        const sub = intelSubTasks[i];
        setStockName(`情报收割 (${i+1}/${intelSubTasks.length}): ${sub.name}`);
        const { text, sources } = await geminiService.generateAgentResponse(
          AgentRole.INTELLIGENCE_OFFICER,
          getPromptForStep(AgentRole.INTELLIGENCE_OFFICER, `${stockInfo.name} (${symbol})`, "", sub.prompt),
          AGENT_SYSTEM_INSTRUCTIONS[AgentRole.INTELLIGENCE_OFFICER],
          true,
          intelModel,
          terminalKey
        );
        rawIntelFragments += `\n\n### [${sub.name}]\n${text}\n`;
        if (sources) allIntelSources = [...allIntelSources, ...sources];
        await waitCooldown(getCooldownByModel(intelModel));
        if (shouldStopRef.current) break;
      }
      if (shouldStopRef.current) { setIsProcessing(false); return; }

      const fusionModel = 'gemini-3-flash';
      setStockName('融合全局情报档案...');
      const uniqueSourcesMap = new Map();
      allIntelSources.forEach(s => {
        const uri = s.web?.uri || s.maps?.uri;
        if (uri && !uniqueSourcesMap.has(uri)) uniqueSourcesMap.set(uri, s);
      });
      const uniqueSources = Array.from(uniqueSourcesMap.values());
      const sourceReferenceText = uniqueSources.map((s, idx) => `[${idx + 1}] ${s.web?.title || s.web?.uri}`).join('\n');

      const { text: finalDossier } = await geminiService.generateAgentResponse(
        AgentRole.INTELLIGENCE_OFFICER,
        getPromptForStep(AgentRole.INTELLIGENCE_OFFICER, `${stockInfo.name} (${symbol})`, `碎片情报聚合成《全局共享情报档案》，标注序号：\n\n${rawIntelFragments}\n\n### 来源列表：\n${sourceReferenceText}`),
        AGENT_SYSTEM_INSTRUCTIONS[AgentRole.INTELLIGENCE_OFFICER],
        false,
        fusionModel,
        terminalKey
      );

      localActions = localActions.map(a => a.id === intelActionId ? { ...a, status: 'completed', output: finalDossier, endTime: Date.now() } : a);
      localReports = { ...localReports, [intelActionId]: { text: finalDossier, sources: uniqueSources } };
      setActions([...localActions]); setReports({ ...localReports });
      await waitCooldown(COOLDOWN_FLASH);
      if (shouldStopRef.current) { setIsProcessing(false); return; }

      const pipeline = [
        { role: AgentRole.FUNDAMENTAL_ANALYST, step: 2 },
        { role: AgentRole.SENTIMENT_ANALYST, step: 2 },
        { role: AgentRole.NEWS_POLICY_ANALYST, step: 2 },
        { role: AgentRole.TECHNICAL_ANALYST, step: 2 },
        { role: AgentRole.BULL_RESEARCHER, step: 3 },
        { role: AgentRole.BEAR_RESEARCHER, step: 3 },
        { role: AgentRole.RISK_MANAGER, step: 4 },
        { role: AgentRole.FUND_MANAGER, step: 5 }
      ];

      let analystReportsText = "";
      for (let i = 0; i < pipeline.length; i++) {
        if (shouldStopRef.current) break;
        const item = pipeline[i];
        const targetModel = agentModels[item.role] || 'gemini-3-flash';
        setCurrentStep(item.step);
        setStockName(`执行智能体: ${item.role}`);
        const actionId = Math.random().toString(36).substr(2, 9);
        localActions = [...localActions, { id: actionId, role: item.role, status: 'working', startTime: Date.now() }];
        setActions([...localActions]); setSelectedReportId(actionId);

        try {
          const inputContext = item.step === 2 ? finalDossier : `### [前置分析汇总]\n${analystReportsText}`;
          const { text, sources } = await geminiService.generateAgentResponse(
            item.role, getPromptForStep(item.role, `${stockInfo.name} (${symbol})`, inputContext), 
            AGENT_SYSTEM_INSTRUCTIONS[item.role], false, targetModel, terminalKey
          );
          if (item.step === 2) analystReportsText += `\n\n--- ${item.role} 研判 ---\n${text}\n`;
          const score = extractScore(text);
          let sentimentMetrics = (item.role === AgentRole.SENTIMENT_ANALYST) ? extractSentimentMetrics(text) : undefined;
          localActions = localActions.map(a => a.id === actionId ? { ...a, status: 'completed', output: text, score, sentimentMetrics, endTime: Date.now() } : a);
          localReports = { ...localReports, [actionId]: { text, sources, score, sentimentMetrics } };
          setActions([...localActions]); setReports({ ...localReports });
          if (score !== undefined && (item.role === AgentRole.TECHNICAL_ANALYST || item.role === AgentRole.FUNDAMENTAL_ANALYST)) evolvePredictions('price', score > 50 ? 4 : -4);
          if (sentimentMetrics) evolvePredictions('price', sentimentMetrics.score * 5);
          if (i < pipeline.length - 1) await waitCooldown(getCooldownByModel(targetModel));
        } catch (err: any) {
          localActions = localActions.map(a => a.id === actionId ? { ...a, status: 'error' } : a);
          setActions([...localActions]); throw err;
        }
      }

      if (!shouldStopRef.current) {
        const now = new Date();
        const record: HistoryRecord = {
          id: Math.random().toString(36).substr(2, 9), symbol, stockName, timestamp: formatDateTime(now), taskName: `${symbol}_${now.toISOString().split('T')[0]}`,
          reports: { ...localReports }, actions: [...localActions], priceData: [...priceDataRef.current], sentimentData: [], basePrice
        };
        setHistoryList(prev => [record, ...(prev || [])]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "工作流执行异常");
    } finally { setIsProcessing(false); setCurrentStep(6); setCooldownLeft(0); shouldStopRef.current = false; }
  };

  const getRoleIcon = (role: AgentRole) => {
    switch (role) {
      case AgentRole.INTELLIGENCE_OFFICER: return <Eye size={16} className="text-purple-400" />;
      case AgentRole.FUNDAMENTAL_ANALYST: return <BarChart3 size={16} />;
      case AgentRole.SENTIMENT_ANALYST: return <MessageSquare size={16} />;
      case AgentRole.TECHNICAL_ANALYST: return <Activity size={16} />;
      case AgentRole.BULL_RESEARCHER: return <TrendingUp size={16} className="text-emerald-400" />;
      case AgentRole.BEAR_RESEARCHER: return <TrendingDown size={16} className="text-rose-400" />;
      case AgentRole.RISK_MANAGER: return <ShieldAlert size={16} />;
      case AgentRole.FUND_MANAGER: return <ClipboardCheck size={16} className="text-amber-400" />;
      case AgentRole.TRADER: return <FileText size={16} className="text-blue-400" />;
      default: return <FileText size={16} />;
    }
  };

  const lastPrice = useMemo(() => priceData.length > 0 ? priceData[priceData.length - 1].price : 0, [priceData]);
  const priceTrend = useMemo(() => basePrice === 0 ? 0 : ((lastPrice - basePrice) / basePrice) * 100, [lastPrice, basePrice]);
  const currentSentimentMetrics = useMemo(() => {
    const sentimentAction = actions.find(a => a.role === AgentRole.SENTIMENT_ANALYST);
    return sentimentAction ? reports[sentimentAction.id]?.sentimentMetrics : undefined;
  }, [actions, reports]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 antialiased font-sans animate-in fade-in duration-1000">
      <nav className="w-20 bg-[#0f172a] border-r border-slate-800 flex flex-col items-center py-8 gap-10">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20 mb-4"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div className="flex flex-col gap-6">
          <button onClick={() => setActiveView('analysis')} className={`p-3 rounded-xl transition-all ${activeView === 'analysis' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}><LayoutDashboard size={24} /></button>
          <button onClick={() => setActiveView('history')} className={`p-3 rounded-xl transition-all ${activeView === 'history' || activeView === 'history-detail' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}><History size={24} /></button>
          <button onClick={() => setActiveView('settings')} className={`p-3 rounded-xl transition-all ${activeView === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}><Settings size={24} /></button>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-800 flex flex-col gap-4">
           <button onClick={() => window.location.reload()} className="p-3 text-slate-600 hover:text-rose-500 transition-colors" title="注销终端">
              <Lock size={20} />
           </button>
        </div>
      </nav>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#020617]/90 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <div><h1 className="text-xl font-bold text-white leading-none">StGTrade <span className="text-blue-500">AI</span></h1><p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.2em] mt-1">Institutional Terminal v3.5.0</p></div>
          </div>
          {activeView === 'analysis' && (
            <div className="flex items-center gap-4">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="股票代码..." className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white font-mono w-40" disabled={isProcessing} />
              {!isProcessing ? (
                <button onClick={runSOP} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 font-bold text-sm transition-all"><Play size={16} fill="currentColor" /> 开始分析</button>
              ) : (
                <button onClick={() => { shouldStopRef.current = true; notification.info({ message: '分析已请求停止' }); }} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 font-bold text-sm transition-all animate-pulse">{cooldownLeft > 0 ? <Timer size={16} /> : <Square size={14} fill="currentColor" />} 暂停分析 {cooldownLeft > 0 ? `(${cooldownLeft}s)` : ''}</button>
              )}
            </div>
          )}
          {activeView === 'history' && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-3 py-1">
              <Search size={14} className="text-slate-500 mr-2" />
              <input value={filterCode} onChange={(e) => setFilterCode(e.target.value)} placeholder="名称搜索..." className="bg-transparent border-none text-xs text-white focus:outline-none w-32" />
            </div>
          )}
        </header>

        <main className="flex flex-1 overflow-hidden">
          {activeView === 'analysis' && (
            <div className="flex-1 flex overflow-hidden p-6 gap-6">
              <aside className="w-[360px] flex flex-col gap-6">
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <h2 className="text-[11px] font-bold text-slate-500 mb-5 flex items-center gap-2 uppercase tracking-widest"><Activity className="w-3 h-3 text-blue-500" /> 分析进度</h2>
                  <div className="flex items-center justify-between px-1">
                    {STAGE_NAMES.map((stage) => (
                      <div key={stage.id} className="flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${currentStep === stage.id ? 'bg-blue-600 text-white ring-4 ring-blue-600/20' : currentStep > stage.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'}`}>{currentStep > stage.id ? '✓' : stage.id}</div>
                        <span className={`text-[9px] font-medium whitespace-nowrap ${currentStep === stage.id ? 'text-blue-400' : 'text-slate-600'}`}>{stage.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/20 text-xs font-bold text-slate-400 uppercase tracking-widest">智能体工作栈</div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={scrollRef}>
                    {actions.map((action) => (
                      <div key={action.id} onClick={() => setSelectedReportId(action.id)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedReportId === action.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={action.status === 'error' ? 'text-rose-500' : action.status === 'working' ? 'text-blue-400 animate-pulse' : ''}>{getRoleIcon(action.role)}</div>
                            <span className={`text-xs font-bold ${action.status === 'error' ? 'text-rose-400' : 'text-slate-200'}`}>{action.role}</span>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold ${action.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>{action.status.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="flex-1 flex flex-col gap-6">
                <div className="grid grid-cols-3 gap-6">
                   <div className="col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 h-60 relative">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 tracking-widest"><TrendingUp size={12} className="text-blue-500"/> 预期价格模型</h3>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">预期现值</span>
                          <span className={`text-2xl font-black font-mono leading-none ${priceTrend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>¥{lastPrice.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="h-40 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={priceData}>
                            <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={0.1} fill="#3b82f6" strokeWidth={3} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                   <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 h-60">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase mb-5 tracking-widest">舆情引擎</h3>
                      <SentimentMetricsPanel metrics={currentSentimentMetrics} isWorking={actions.find(a=>a.role===AgentRole.SENTIMENT_ANALYST)?.status==='working'} />
                   </div>
                </div>
                <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-md">
                  <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30 flex justify-between items-center">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20"><FileText size={20} /></div><h2 className="text-sm font-black text-white uppercase tracking-tight">{selectedReportId ? actions.find(a => a.id === selectedReportId)?.role : '分析报告库'}</h2></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    {selectedReportId && reports[selectedReportId] ? (
                      <div className="markdown-content max-w-4xl mx-auto">
                        <div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-base">{reports[selectedReportId].text}</div>
                        <GroundingSources sources={reports[selectedReportId].sources} />
                      </div>
                    ) : <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40"><RefreshCw size={80} strokeWidth={0.5} className="animate-spin-slow" /><p className="text-lg font-bold mt-4 tracking-tighter uppercase">准备中...</p></div>}
                  </div>
                </div>
              </section>
            </div>
          )}
          {activeView === 'history' && (
             <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto">
                   <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3 mb-10"><History size={32} className="text-blue-500" /> 历史记录</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredHistory.map((record) => (
                         <div key={record.id} onClick={() => { setSelectedHistory(record); setActiveView('history-detail'); }} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-blue-500 transition-all">
                            <h3 className="text-lg font-bold text-white mb-1">{record.stockName}</h3>
                            <p className="text-xs font-mono text-slate-500 mb-6">{record.symbol}</p>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
          {activeView === 'settings' && (
             <div className="flex-1 p-10 bg-[#020617]">
                <div className="max-w-4xl mx-auto">
                   <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3 mb-10"><Settings size={32} className="text-blue-500" /> 算力配置</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.values(AgentRole).map((role) => (
                         <div key={role} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between h-32">
                            <h4 className="text-slate-200 font-bold text-sm">{role}</h4>
                            <Select value={agentModels[role]} onChange={(val) => setAgentModels(prev => ({ ...prev, [role]: val as ModelType }))} className="w-full" options={[{ value: 'gemini-3-flash', label: 'Gemini 3 Flash' }]} />
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [terminalKey, setTerminalKey] = useState<string | null>(null);

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#3b82f6' } }}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {!terminalKey ? (
          <AuthGate onInitialize={(key) => setTerminalKey(key)} />
        ) : (
          <Dashboard terminalKey={terminalKey} />
        )}
      </div>
    </ConfigProvider>
  );
}
