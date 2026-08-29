/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, MemoryTopic, MemoryInsight, ClipboardItem } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { GlobalMemorySidebar } from './components/GlobalMemorySidebar';
import { SelfAwarenessIntrospectionModal } from './components/SelfAwarenessIntrospectionModal';
import { Sparkles, Globe, Cpu, Terminal, HelpCircle, RotateCcw, Brain, Clipboard, Activity } from 'lucide-react';

const STORAGE_KEY_CHAT = 'larua_chat_history';
const STORAGE_KEY_PINNED = 'larua_pinned_insights';
const STORAGE_KEY_CLIPBOARD = 'larua_clipboard_items';
const STORAGE_KEY_TOPICS = 'larua_synthesized_topics';

export default function App() {
  // 1. Messages state
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

  // 2. Sidebar & Tab & Introspection state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'memory' | 'clipboard'>('memory');
  const [isIntrospectionOpen, setIsIntrospectionOpen] = useState(false);

  // 3. Global Memory & Synthesis state
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [topics, setTopics] = useState<MemoryTopic[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TOPICS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load topics', e);
    }
    return [];
  });
  const [keyInsights, setKeyInsights] = useState<string[]>([]);
  const [userDirectives, setUserDirectives] = useState<string[]>([]);
  const [pinnedInsights, setPinnedInsights] = useState<MemoryInsight[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PINNED);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load pinned insights', e);
    }
    return [];
  });
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // 4. Clipboard state
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIPBOARD);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load clipboard items', e);
    }
    return [
      {
        id: 'welcome-clip-1',
        title: 'Larua Agent Architecture',
        content: 'Larua AI combines Google Gemini reasoning with real server tools for autonomous diagnostics, file editing, and live web exploration.',
        type: 'note',
        createdAt: Date.now(),
      }
    ];
  });
  const [insertedText, setInsertedText] = useState<string | null>(null);

  // 5. Processing & stream state
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save chat history', e);
    }
  }, [messages]);

  // Persist pinned insights
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(pinnedInsights));
    } catch (e) {
      console.error('Failed to save pinned insights', e);
    }
  }, [pinnedInsights]);

  // Persist clipboard items
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLIPBOARD, JSON.stringify(clipboardItems));
    } catch (e) {
      console.error('Failed to save clipboard items', e);
    }
  }, [clipboardItems]);

  // Persist topics
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));
    } catch (e) {
      console.error('Failed to save topics', e);
    }
  }, [topics]);

  // Real-time Memory Synthesizer
  const synthesizeMemory = useCallback(async (currentMessages: Message[]) => {
    if (currentMessages.length === 0) {
      setTopics([]);
      setSessionSummary('');
      setKeyInsights([]);
      setUserDirectives([]);
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/synthesize-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: currentMessages }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.summary) setSessionSummary(data.summary);
        if (Array.isArray(data.topics) && data.topics.length > 0) {
          setTopics(data.topics.map((t: any, i: number) => ({
            id: `topic-${Date.now()}-${i}`,
            title: t.title || 'Topic',
            category: t.category || 'Topic',
            summary: t.summary || '',
            relevance: t.relevance || 'medium',
            updatedAt: Date.now(),
          })));
        }
        if (Array.isArray(data.keyInsights)) setKeyInsights(data.keyInsights);
        if (Array.isArray(data.userDirectives)) setUserDirectives(data.userDirectives);
      }
    } catch (e) {
      console.error('Failed to synthesize memory:', e);
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  // Initial synthesis on load if messages exist
  useEffect(() => {
    if (messages.length > 0 && topics.length === 0) {
      synthesizeMemory(messages);
    }
  }, []);

  // Pinned insight handlers
  const handleAddPinnedInsight = (text: string) => {
    const newInsight: MemoryInsight = {
      id: crypto.randomUUID(),
      text,
      source: 'user_pinned',
      createdAt: Date.now(),
    };
    setPinnedInsights((prev) => [newInsight, ...prev]);
  };

  const handleRemovePinnedInsight = (id: string) => {
    setPinnedInsights((prev) => prev.filter((i) => i.id !== id));
  };

  // Clipboard handlers
  const handleAddClipboardItem = (item: Omit<ClipboardItem, 'id' | 'createdAt'>) => {
    const newItem: ClipboardItem = {
      id: crypto.randomUUID(),
      ...item,
      createdAt: Date.now(),
    };
    setClipboardItems((prev) => [newItem, ...prev]);
  };

  const handleRemoveClipboardItem = (id: string) => {
    setClipboardItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearClipboard = () => {
    if (window.confirm('Clear all items from clipboard?')) {
      setClipboardItems([]);
    }
  };

  const handleInsertToChat = (content: string) => {
    setInsertedText(content);
  };

  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (window.confirm('Clear conversation history?')) {
      setMessages([]);
      setTopics([]);
      setSessionSummary('');
      setKeyInsights([]);
      setUserDirectives([]);
      try {
        localStorage.removeItem(STORAGE_KEY_CHAT);
        localStorage.removeItem(STORAGE_KEY_TOPICS);
      } catch (e) {
        console.error('Failed to clear localStorage', e);
      }
    }
  };

  const handleSendMessage = async (content: string, attachments?: { mimeType: string; data: string }[]) => {
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
      // Include pinned user rules into contextual prompt payload if present
      const directivesContext = pinnedInsights.map(p => `- ${p.text}`).join('\n');
      const contextualPrompt = directivesContext 
        ? `[USER DIRECTIVES & MEMORY]:\n${directivesContext}\n\n[USER MESSAGE]:\n${content}`
        : content;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: contextualPrompt,
          history: messages,
          attachments 
        }),
      });

      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
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

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          // Keep incomplete line trailing in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.substring(6).trim();
              if (dataStr === '[DONE]') {
                 setIsLoading(false);
                 setIsProcessing(false);
                 break;
              }
              
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                
                if (data.type === 'text') {
                  fullBotResponse += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: fullBotResponse }
                        : msg
                    )
                  );
                } else if (data.type === 'code_execution') {
                  setIsProcessing(true);
                  setTimeout(() => setIsProcessing(false), 2000);
                  
                  const execResult = `\n\n> ⚙️ **Internal Execution:**\n> \`\`\`\n> ${data.result}\n> \`\`\`\n\n`;
                  fullBotResponse += execResult;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: fullBotResponse }
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
                console.error("Error parsing stream chunk:", e);
              }
            }
          }
        }
      }

      // Flush remaining line in buffer if present
      if (buffer.trim().startsWith('data: ')) {
        const dataStr = buffer.trim().substring(6).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'text') {
              fullBotResponse += data.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, content: fullBotResponse }
                    : msg
                )
              );
            }
          } catch {}
        }
      }

      // Trigger automatic memory synthesis update on completion
      const completedConversation = [...updatedHistory, { id: botMessageId, role: 'model' as const, content: fullBotResponse }];
      synthesizeMemory(completedConversation);

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
      icon: HelpCircle,
      title: "General Knowledge & Research",
      prompt: "What are the latest developments in artificial intelligence and autonomous systems?"
    },
    {
      icon: Globe,
      title: "Live Web & API Requests",
      prompt: "Search the web for recent quantum computing milestones and summarize the findings."
    },
    {
      icon: Cpu,
      title: "System Diagnostics & Health",
      prompt: "Run a full system diagnostic and report current memory, uptime, and operational health."
    },
    {
      icon: Terminal,
      title: "Code & Automation",
      prompt: "Write a high-performance TypeScript utility for processing streaming real-time data."
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-[#09090B] font-sans text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 border-b border-white/10 px-4 sm:px-8 flex items-center justify-between bg-[#121215] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Larua AI</h1>
            <p className="text-[11px] text-slate-400">Autonomous Reasoning & Tool Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Introspection / Self-Awareness Button */}
          <button
            onClick={() => setIsIntrospectionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/40 text-purple-200 hover:text-white transition-all cursor-pointer font-medium"
            title="Open Self-Awareness & Introspection Report"
          >
            <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="hidden sm:inline">Self-Awareness</span>
          </button>

          {/* Global Memory Button */}
          <button
            onClick={() => {
              setSidebarTab('memory');
              setIsSidebarOpen(!isSidebarOpen || sidebarTab !== 'memory');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-xs font-medium ${
              isSidebarOpen && sidebarTab === 'memory'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Open Global Memory synthesis"
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Memory</span>
            {topics.length > 0 && (
              <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded-full text-[10px]">
                {topics.length}
              </span>
            )}
          </button>

          {/* Clipboard Button */}
          <button
            onClick={() => {
              setSidebarTab('clipboard');
              setIsSidebarOpen(!isSidebarOpen || sidebarTab !== 'clipboard');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-xs font-medium ${
              isSidebarOpen && sidebarTab === 'clipboard'
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Open Clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Clipboard</span>
            {clipboardItems.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-[10px]">
                {clipboardItems.length}
              </span>
            )}
          </button>

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              title="Start a new conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[11px] font-medium hidden sm:inline">Ready</span>
          </div>
        </div>
      </header>

      {/* Main Area with dynamic layout when sidebar is open */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Interface */}
        <main className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-300 ${
          isSidebarOpen ? 'lg:mr-[420px]' : ''
        }`}>
          {/* Messages View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col max-w-4xl w-full mx-auto">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto my-auto py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center mb-5 text-purple-400 shadow-inner">
                  <Sparkles className="w-7 h-7" />
                </div>

                <h2 className="text-2xl font-medium text-white mb-2 tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                  Ask any question, explore ideas, run web queries, or execute system tasks. Larua synthesizes your topics in Global Memory and saves your snippets to Clipboard.
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
                    onSaveToClipboard={(title, content, type) => {
                      handleAddClipboardItem({ title, content, type });
                      setSidebarTab('clipboard');
                      setIsSidebarOpen(true);
                    }}
                  />
                ))}

                {isProcessing && (
                  <div className="flex w-full mb-4 justify-start">
                    <div className="bg-purple-950/40 text-purple-300 text-xs py-2 px-4 border border-purple-500/30 rounded-xl flex items-center animate-pulse gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Processing internally with tools...</span>
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
              insertedText={insertedText}
              onClearInsertedText={() => setInsertedText(null)}
            />
          </div>
        </main>

        {/* Global Memory & Clipboard Sidebar */}
        <GlobalMemorySidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          topics={topics}
          sessionSummary={sessionSummary}
          keyInsights={keyInsights}
          userDirectives={userDirectives}
          pinnedInsights={pinnedInsights}
          onAddPinnedInsight={handleAddPinnedInsight}
          onRemovePinnedInsight={handleRemovePinnedInsight}
          isSynthesizing={isSynthesizing}
          onRefreshSynthesis={() => synthesizeMemory(messages)}
          clipboardItems={clipboardItems}
          onAddClipboardItem={handleAddClipboardItem}
          onRemoveClipboardItem={handleRemoveClipboardItem}
          onClearClipboard={handleClearClipboard}
          onInsertToChat={handleInsertToChat}
        />
      </div>

      {/* Introspection / Self-Awareness Modal */}
      <SelfAwarenessIntrospectionModal
        isOpen={isIntrospectionOpen}
        onClose={() => setIsIntrospectionOpen(false)}
        onInsertToChat={(text) => handleInsertToChat(text)}
      />

      {/* Footer */}
      <footer className="flex-none h-8 border-t border-white/5 bg-[#0D0D10] flex items-center justify-between px-6 text-[11px] text-slate-500 z-10">
        <span>Larua AI • Unified Memory & Clipboard Engine</span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-slate-500">
            {topics.length} Memory Topics • {clipboardItems.length} Clippings
          </span>
          <div className="flex items-center gap-1.5 text-purple-400">
            <Brain className="w-3 h-3" />
            <span className="text-[10px]">Memory Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
