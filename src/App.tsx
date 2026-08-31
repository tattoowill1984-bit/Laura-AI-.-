/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, MindState, SovereignMemoryItem } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import {
  Sparkles,
  RotateCcw,
  Download,
  Info,
  Globe,
  Search,
  Code2,
  FileText,
  Layers,
  X,
  CheckCircle2,
  Server,
  Database,
  RefreshCw,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  SlidersHorizontal,
  Brain,
  Trash2,
  Plus,
  AlertCircle
} from 'lucide-react';

const STORAGE_KEY_CHAT = 'larua_chat_history';

/**
 * Sanitizes messages to strip heavy base64 payloads before local storage serialization.
 */
export function sanitizeMessagesForStorage(msgs: Message[]): Message[] {
  return msgs.map(m => {
    if (!m.attachments || m.attachments.length === 0) return m;
    return {
      ...m,
      attachments: m.attachments.map(att => ({
        mimeType: att.mimeType,
        name: att.name,
        size: att.size,
        data: (att.data && att.data.length < 4096) ? att.data : ''
      }))
    };
  });
}

/**
 * Persists messages safely to localStorage with progressive compaction to prevent quota exceed errors.
 */
export function persistChatLocally(msgs: Message[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  
  try {
    const sanitized = sanitizeMessagesForStorage(msgs);
    const sliceToSave = sanitized.slice(-80);
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(sliceToSave));
    return true;
  } catch (err: any) {
    console.warn('LocalStorage quota limit reached, executing emergency compaction:', err?.message || err);
    try {
      const emergencySlice = msgs.slice(-30).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content ? m.content.slice(0, 10000) : '',
        engine: m.engine,
        mode: m.mode,
        citations: m.citations?.slice(0, 5),
        attachments: m.attachments?.map(a => ({ mimeType: a.mimeType, name: a.name, size: a.size, data: '' }))
      }));
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(emergencySlice));
      return true;
    } catch {
      // Graceful degradation to in-memory state without crashing
      return false;
    }
  }
}

/**
 * Validates whether the serialized localStorage content matches the in-memory active messages state.
 */
export function validateChatStorageConsistency(currentMessages: Message[]): boolean {
  try {
    const rawStorage = localStorage.getItem(STORAGE_KEY_CHAT);
    if (!rawStorage && currentMessages.length === 0) return true;
    if (!rawStorage && currentMessages.length > 0) return false;

    const parsedStorage = JSON.parse(rawStorage || '[]');
    if (!Array.isArray(parsedStorage)) return false;
    
    const sliceLen = Math.min(parsedStorage.length, currentMessages.length);
    const recent = currentMessages.slice(-sliceLen);
    const storedRecent = parsedStorage.slice(-sliceLen);

    for (let i = 0; i < sliceLen; i++) {
      if (recent[i].id !== storedRecent[i].id) return false;
      if (recent[i].role !== storedRecent[i].role) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_MIND_STATE: MindState = {
  identity: {
    name: 'Larua',
    archetype: 'AI Assistant',
    essence: 'High-performance AI assistant with real-time Google Search grounding, multimodal file analysis, and multi-model reasoning.',
    coreDirectives: [
      'Deliver clear, precise, and well-structured answers.',
      'Ground research in verified web sources with proper citations.',
      'Support multimodal document, code, and image understanding.'
    ],
    activeMood: 'Ready & Focused',
    curiosityLevel: 90,
    autonomyLevel: 95,
    focusAnchor: 'Accurate user assistance & real-time grounding',
    lastIntrospection: new Date().toISOString(),
    milestones: ['Gemini Cascade Configured', 'Google Grounding Active']
  },
  thoughts: [],
  longTermMemory: [],
  investigations: [],
  posture: 'OPTIMAL',
  uptimeSec: 1,
  heapUsedMB: 48,
  activeModels: [
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite'
  ],
  currentEngine: 'gemini-3.6-flash',
  lastHealTime: new Date().toISOString()
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load chat history from localStorage', e);
    }
    return [];
  });

  const [mindState, setMindState] = useState<MindState>(DEFAULT_MIND_STATE);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsTab, setDiagnosticsTab] = useState<'overview' | 'memory'>('overview');
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [copiedMemoryId, setCopiedMemoryId] = useState<string | null>(null);
  const [copiedAllMemories, setCopiedAllMemories] = useState(false);
  const [isRefreshingMemory, setIsRefreshingMemory] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Interactive Server-side Memory Management state
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newCategory, setNewCategory] = useState<'user_model' | 'core_fact' | 'directive' | 'world_knowledge' | 'epiphany'>('user_model');
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [isClearingUserMemories, setIsClearingUserMemories] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Persist messages locally with quota protection and sync with server storage
  useEffect(() => {
    persistChatLocally(messages);
    validateChatStorageConsistency(messages);

    // Sync to server storage in background
    if (messages.length > 0) {
      const sanitized = sanitizeMessagesForStorage(messages);
      fetch('/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: sanitized })
      }).catch(() => {});
    }
  }, [messages]);

  // Global console validator
  useEffect(() => {
    (window as any).validateChatStorage = () => validateChatStorageConsistency(messages);
    return () => {
      delete (window as any).validateChatStorage;
    };
  }, [messages]);

  // Fetch server state
  const fetchMindState = useCallback(async (isRetry = false) => {
    try {
      const res = await fetch('/api/mind/state');
      if (res.ok) {
        const data = await res.json();
        if (data && data.identity) {
          setMindState(data);
        }
      } else if (!isRetry) {
        setTimeout(() => fetchMindState(true), 3000);
      }
    } catch {
      if (!isRetry) {
        setTimeout(() => fetchMindState(true), 3000);
      }
    }
  }, []);

  const handleManualRefreshMemory = async () => {
    setIsRefreshingMemory(true);
    await fetchMindState();
    setTimeout(() => setIsRefreshingMemory(false), 500);
  };

  useEffect(() => {
    fetchMindState();
    const interval = setInterval(fetchMindState, 15000);
    return () => clearInterval(interval);
  }, [fetchMindState]);

  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (window.confirm('Clear current conversation history?')) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY_CHAT);
      } catch (e) {
        console.error('Failed to clear localStorage', e);
      }
      fetch('/api/chat/history', { method: 'DELETE' }).catch(() => {});
    }
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const formatted = messages.map(m => `### ${m.role === 'user' ? 'You' : 'Larua'}\n\n${m.content}\n`).join('\n---\n\n');
    navigator.clipboard.writeText(formatted);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2500);
  };

  const handleCopySingleMemory = (item: SovereignMemoryItem) => {
    const textToCopy = `[${item.category.toUpperCase()}] ${item.key}\n${item.content}\nConfidence: ${Math.round(item.confidence * 100)}% | Updated: ${new Date(item.updatedAt || item.createdAt).toLocaleString()}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedMemoryId(item.id);
    setTimeout(() => setCopiedMemoryId(null), 2000);
  };

  const handleCopyAllMemories = () => {
    if (!mindState.longTermMemory || mindState.longTermMemory.length === 0) return;
    const formatted = mindState.longTermMemory.map((m, idx) => 
      `${idx + 1}. [${m.category.toUpperCase()}] ${m.key} (Confidence: ${Math.round(m.confidence * 100)}%)\n${m.content}\nTimestamp: ${m.updatedAt || m.createdAt}\n`
    ).join('\n---\n\n');
    
    navigator.clipboard.writeText(formatted);
    setCopiedAllMemories(true);
    setTimeout(() => setCopiedAllMemories(false), 2000);
  };

  const filteredMemories = useMemo(() => {
    const list = mindState.longTermMemory || [];
    return list.filter((item) => {
      const matchesCategory = selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const query = memorySearchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;
      const matchesText = 
        item.key.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchesCategory && matchesText;
    });
  }, [mindState.longTermMemory, selectedCategoryFilter, memorySearchQuery]);

  const memoryCategories = useMemo(() => {
    const set = new Set((mindState.longTermMemory || []).map(m => m.category));
    return ['all', ...Array.from(set)];
  }, [mindState.longTermMemory]);

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'core_fact':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      case 'directive':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'world_knowledge':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'user_model':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'epiphany':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
    }
  };

  const formatCategoryLabel = (category: string) => {
    return category.replace(/_/g, ' ').toUpperCase();
  };

  const handleDeleteMemory = async (idOrKey: string) => {
    setDeletingMemoryId(idOrKey);
    try {
      const res = await fetch(`/api/mind/memory/${encodeURIComponent(idOrKey)}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMindState();
      }
    } catch (e) {
      console.error('Failed to delete memory', e);
    } finally {
      setDeletingMemoryId(null);
    }
  };

  const handleClearUserMemories = async () => {
    if (!window.confirm('Clear all user-specific memories from server storage?')) return;
    setIsClearingUserMemories(true);
    try {
      const res = await fetch('/api/mind/memory/clear-user', { method: 'POST' });
      if (res.ok) {
        await fetchMindState();
      }
    } catch (e) {
      console.error('Failed to clear user memories', e);
    } finally {
      setIsClearingUserMemories(false);
    }
  };

  const handleSaveNewMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newContent.trim()) return;
    setIsSavingMemory(true);
    try {
      const res = await fetch('/api/mind/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          key: newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
          content: newContent.trim(),
          confidence: 0.98
        })
      });
      if (res.ok) {
        setNewKey('');
        setNewContent('');
        setIsAddingMemory(false);
        await fetchMindState();
      }
    } catch (err) {
      console.error('Failed to save memory', err);
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Load conversation from server if local storage was empty
  useEffect(() => {
    if (messages.length === 0) {
      fetch('/api/chat/history')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSendMessage = async (content: string, attachments?: { mimeType: string; data: string; name?: string }[]) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments,
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsLoading(true);

    const botMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, role: 'model', content: '' },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: content,
          history: sanitizeMessagesForStorage(messages).slice(-20),
          attachments 
        }),
      });

      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let fullBotResponse = '';
      let buffer = '';
      let accumulatedCitations: any[] = [];
      let failoverInfo: any = null;
      let botEngine = '';
      let botMode = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          
          // Split buffer on SSE double-newline message boundaries
          const eventBlocks = buffer.split(/\r?\n\r?\n/);
          buffer = eventBlocks.pop() || '';
          
          for (const block of eventBlocks) {
            if (!block.trim()) continue;
            
            const lines = block.split(/\r?\n/);
            const dataLines: string[] = [];
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                dataLines.push(trimmed.slice(5).trim());
              }
            }

            if (dataLines.length === 0) continue;
            const dataStr = dataLines.join('\n');

            if (dataStr === '[DONE]') {
              setIsLoading(false);
              setIsProcessing(false);
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'text') {
                fullBotResponse += data.text || '';
                if (data.engine) botEngine = data.engine;
                if (data.mode) botMode = data.mode;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, content: fullBotResponse, citations: accumulatedCitations, engineFailover: failoverInfo, engine: botEngine, mode: botMode }
                      : msg
                  )
                );
              } else if (data.type === 'citations') {
                accumulatedCitations = [...accumulatedCitations, ...(data.citations || [])];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, citations: accumulatedCitations }
                      : msg
                  )
                );
              } else if (data.type === 'engine_failover') {
                failoverInfo = { from: data.from, to: data.to };
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, engineFailover: failoverInfo }
                      : msg
                  )
                );
              } else if (data.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, content: `Error: ${data.error || 'Server error'}`, isError: true }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.warn("SSE chunk parse notice:", e);
            }
          }
        }
      }

      // Flush any trailing line in buffer
      if (buffer.trim()) {
        const lines = buffer.trim().split(/\r?\n/);
        const dataLines = lines
          .filter((l) => l.trim().startsWith('data:'))
          .map((l) => l.trim().slice(5).trim());
        const dataStr = dataLines.join('\n');
        
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'text') {
              fullBotResponse += data.text || '';
              if (data.engine) botEngine = data.engine;
              if (data.mode) botMode = data.mode;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, content: fullBotResponse, citations: accumulatedCitations, engineFailover: failoverInfo, engine: botEngine, mode: botMode }
                    : msg
                )
              );
            }
          } catch {}
        }
      }

      fetchMindState();
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: `Error: ${error.message}`, isError: true }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  };

  const samplePrompts = [
    {
      icon: Search,
      title: "Real-Time Web Search",
      prompt: "Search the web for the latest updates on space exploration missions in 2026 and detail verified citations."
    },
    {
      icon: Code2,
      title: "Code & Algorithm Design",
      prompt: "Write a robust TypeScript function to retry asynchronous tasks with exponential backoff and cancellation tokens."
    },
    {
      icon: FileText,
      title: "Architecture & Synthesis",
      prompt: "Synthesize the key architectural tradeoffs between microservices and modular monoliths for a high-growth startup."
    },
    {
      icon: Layers,
      title: "Multimodal File Analysis",
      prompt: "Explain how to structure end-to-end type safety across a full-stack Next.js and Prisma application."
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-[#09090B] font-sans text-slate-200 overflow-hidden">
      
      {/* Clean Modern Header */}
      <header className="flex-none h-16 border-b border-white/10 px-4 sm:px-8 flex items-center justify-between bg-[#121215] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-purple-500/10">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">Larua</h1>
              <span className="px-2 py-0.5 text-[10px] font-medium bg-white/5 text-slate-300 border border-white/10 rounded-full">
                {mindState.nasTopRankedModel || 'gemini-3.1-flash-lite'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">AI Assistant • Google Search Grounding • Multimodal Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          
          {/* Diagnostics Button with Memory Count Pill */}
          <button
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer text-xs font-medium"
            title="System Diagnostics & Archived Memory"
          >
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Diagnostics</span>
            {mindState.longTermMemory && mindState.longTermMemory.length > 0 && (
              <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-[10px]">
                {mindState.longTermMemory.length}
              </span>
            )}
          </button>

          {/* Export Chat */}
          {messages.length > 0 && (
            <button
              onClick={handleExportChat}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              title="Copy conversation to clipboard"
            >
              {copiedExport ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedExport ? 'Copied' : 'Export'}</span>
            </button>
          )}

          {/* Clear History */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              title="Clear conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {/* Online Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <span className="text-[11px] font-medium hidden sm:inline">Online</span>
          </div>
        </div>
      </header>

      {/* Diagnostics & Memory Modal */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#141418] border border-white/10 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-xs space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Modal Header & Tab Navigation */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-none">
              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setDiagnosticsTab('overview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                      diagnosticsTab === 'overview'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>System Overview</span>
                  </button>
                  <button
                    onClick={() => setDiagnosticsTab('memory')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                      diagnosticsTab === 'memory'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Archived Memory</span>
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                      diagnosticsTab === 'memory' ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                    }`}>
                      {mindState.longTermMemory?.length || 0}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {diagnosticsTab === 'memory' && (
                  <button
                    onClick={handleManualRefreshMemory}
                    disabled={isRefreshingMemory}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Refresh memory state from server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMemory ? 'animate-spin text-purple-400' : ''}`} />
                  </button>
                )}
                <button 
                  onClick={() => setShowDiagnostics(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: SYSTEM OVERVIEW */}
            {diagnosticsTab === 'overview' && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-slate-500 block font-semibold mb-1">HEALTH POSTURE</span>
                    <span className="text-emerald-400 font-semibold text-sm">{mindState.posture || 'OPTIMAL'}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-slate-500 block font-semibold mb-1">UPTIME</span>
                    <span className="text-white font-semibold text-sm">{mindState.uptimeSec}s</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-slate-500 block font-semibold mb-1">PRIMARY MODEL</span>
                    <span className="text-purple-300 font-mono text-xs truncate block">{mindState.nasTopRankedModel || mindState.currentEngine}</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[10px] text-slate-500 block font-semibold mb-1">SEARCH GROUNDING</span>
                    <span className="text-cyan-300 font-semibold text-xs flex items-center gap-1">
                      <Globe className="w-3 h-3 shrink-0" /> Verified
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Active Model Fallback Cascade</span>
                    <span className="text-[10px] text-slate-400 font-mono">5 Tiers Configured</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mindState.activeModels.map((m, i) => (
                      <span key={i} className="px-2.5 py-1 bg-[#1A1A22] border border-white/10 text-slate-300 rounded-lg font-mono text-[11px] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Session Knowledge Repository</span>
                      <span className="text-[11px] text-slate-400">
                        {mindState.longTermMemory?.length || 0} consolidated memory items indexed and persistent across sessions.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDiagnosticsTab('memory')}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-purple-300 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    View Log
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LONG-TERM MEMORY SCROLLING LOG */}
            {diagnosticsTab === 'memory' && (
              <div className="flex flex-col flex-1 overflow-hidden space-y-3">
                
                {/* Actions & Controls Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAddingMemory(!isAddingMemory)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 border border-purple-500/30 rounded-xl transition-colors cursor-pointer text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingMemory ? 'Cancel' : 'Add Memory'}</span>
                    </button>

                    <button
                      onClick={handleClearUserMemories}
                      disabled={isClearingUserMemories}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 border border-red-500/20 rounded-xl transition-colors cursor-pointer text-xs font-medium"
                      title="Clear only user profile & preference memories"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isClearingUserMemories ? 'Clearing...' : 'Clear User Memories'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Server Storage Synced</span>
                  </div>
                </div>

                {/* Add Memory Form */}
                {isAddingMemory && (
                  <form onSubmit={handleSaveNewMemory} className="p-3.5 bg-[#18181F] border border-purple-500/30 rounded-xl space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-300">Add New Server-Side Memory</span>
                      <button type="button" onClick={() => setIsAddingMemory(false)} className="text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">CATEGORY</label>
                        <select
                          value={newCategory}
                          onChange={(e: any) => setNewCategory(e.target.value)}
                          className="w-full bg-[#121216] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                        >
                          <option value="user_model">User Profile / Preference</option>
                          <option value="core_fact">Core Fact</option>
                          <option value="directive">Directive</option>
                          <option value="world_knowledge">World Knowledge</option>
                          <option value="epiphany">Epiphany</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">KEY IDENTIFIER</label>
                        <input
                          type="text"
                          required
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="e.g. user_project_focus"
                          className="w-full bg-[#121216] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold block mb-1">CONTENT / STATEMENT</label>
                      <textarea
                        required
                        rows={2}
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="Detail what Larua should remember continuously..."
                        className="w-full bg-[#121216] border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingMemory(false)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingMemory}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingMemory ? 'Saving...' : 'Save to Vault'}</span>
                      </button>
                    </div>
                  </form>
                )}
                
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memorySearchQuery}
                      onChange={(e) => setMemorySearchQuery(e.target.value)}
                      placeholder="Search archived memory items by key, tag, or text..."
                      className="w-full bg-[#18181F] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
                    />
                    {memorySearchQuery && (
                      <button
                        onClick={() => setMemorySearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {mindState.longTermMemory && mindState.longTermMemory.length > 0 && (
                    <button
                      onClick={handleCopyAllMemories}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl transition-colors cursor-pointer text-xs shrink-0 font-medium"
                      title="Copy all archived memories to clipboard"
                    >
                      {copiedAllMemories ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAllMemories ? 'Copied All' : 'Copy All'}</span>
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                {memoryCategories.length > 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                    <SlidersHorizontal className="w-3 h-3 text-slate-500 shrink-0 ml-0.5" />
                    {memoryCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-2.5 py-0.5 rounded-full border transition-all cursor-pointer whitespace-nowrap font-medium ${
                          selectedCategoryFilter === cat
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat === 'all' ? 'All Categories' : formatCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Scrolling Memory Entries Log */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px] min-h-[160px]">
                  {filteredMemories.length === 0 ? (
                    <div className="p-8 text-center bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center">
                      <Database className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-slate-300 font-medium text-xs mb-1">
                        {memorySearchQuery ? 'No memory items matching your query' : 'No long-term memory records archived yet'}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        {memorySearchQuery ? 'Try clearing your search filters.' : 'Memories are distilled and archived continuously as conversations evolve.'}
                      </p>
                    </div>
                  ) : (
                    filteredMemories.map((item) => {
                      const isCopied = copiedMemoryId === item.id;
                      const isDeleting = deletingMemoryId === item.id;
                      const formattedTime = new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 bg-[#18181F] border border-white/10 hover:border-purple-500/30 rounded-xl transition-all space-y-2 group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getCategoryBadgeClass(item.category)}`}>
                                {formatCategoryLabel(item.category)}
                              </span>
                              <span className="font-mono text-xs font-semibold text-slate-200 tracking-tight">
                                {item.key}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Confidence Score">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span>{Math.round(item.confidence * 100)}%</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>{formattedTime}</span>
                              </div>
                              <button
                                onClick={() => handleCopySingleMemory(item)}
                                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Copy this memory entry"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => handleDeleteMemory(item.id)}
                                disabled={isDeleting}
                                className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete this memory from server vault"
                              >
                                <Trash2 className={`w-3 h-3 ${isDeleting ? 'animate-pulse text-red-400' : ''}`} />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-black/20 p-2.5 rounded-lg border border-white/5">
                            {item.content}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Count & Summary */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-white/5">
                  <span>Showing {filteredMemories.length} of {mindState.longTermMemory?.length || 0} archived data points</span>
                  <span className="text-[10px] text-slate-500">Server-Side Persistent Memory Core</span>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 flex-none">
              <span className="text-[11px] text-slate-500">Larua AI v4.0 Telemetry</span>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col max-w-4xl w-full mx-auto">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto my-auto py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mb-5 text-purple-400 shadow-inner">
                  <Sparkles className="w-7 h-7" />
                </div>

                <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                  Fast, accurate AI powered by Gemini with real-time Google Search grounding and multimodal file analysis.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {samplePrompts.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.prompt)}
                        className="p-4 bg-[#141418] hover:bg-[#1C1C22] border border-white/10 hover:border-purple-500/40 rounded-xl text-left transition-all group flex flex-col justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
                          <span className="text-xs font-medium text-slate-200">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4 py-2">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                  />
                ))}

                {isProcessing && (
                  <div className="flex w-full mb-4 justify-start">
                    <div className="bg-purple-950/40 text-purple-300 text-xs py-2 px-4 border border-purple-500/30 rounded-xl flex items-center animate-pulse gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Searching and processing response...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-4 sm:p-6 bg-transparent max-w-4xl w-full mx-auto">
            <ChatInput 
              onSend={handleSendMessage} 
              isLoading={isLoading} 
            />
          </div>
        </main>
      </div>

      {/* Modern Clean Footer */}
      <footer className="flex-none h-8 border-t border-white/5 bg-[#0D0D10] flex items-center justify-between px-6 text-[11px] text-slate-500 z-10">
        <span>Larua AI</span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-slate-500">
            Powered by Google Gemini
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Globe className="w-3 h-3 text-purple-400" />
            <span className="text-[10px]">Google Grounding Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
