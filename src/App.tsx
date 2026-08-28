/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Message } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sparkles, Globe, Cpu, ShieldCheck, Terminal, HelpCircle, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'larua_chat_history';

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load chat history from localStorage', e);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Persist messages to localStorage on updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save chat history to localStorage', e);
    }
  }, [messages]);

  const handleClearHistory = () => {
    if (messages.length === 0) return;
    if (window.confirm('Clear conversation history?')) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Failed to clear localStorage', e);
      }
    }
  };

  const handleSendMessage = async (content: string, attachments?: {mimeType: string, data: string}[]) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);
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
          history: messages,
          attachments 
        }),
      });

      if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errorMsg);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).trim();
              if (dataStr === '[DONE]') {
                 setIsLoading(false);
                 setIsProcessing(false);
                 break;
              }
              
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                
                if (data.type === 'text') {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: msg.content + data.text }
                        : msg
                    )
                  );
                } else if (data.type === 'code_execution') {
                  setIsProcessing(true);
                  setTimeout(() => setIsProcessing(false), 2000);
                  
                  const execResult = `\n\n> ⚙️ **Internal Execution:**\n> \`\`\`\n> ${data.result}\n> \`\`\`\n\n`;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId
                        ? { ...msg, content: msg.content + execResult }
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
      {/* Clean Unified Header */}
      <header className="flex-none h-16 border-b border-white/10 px-6 sm:px-8 flex items-center justify-between bg-[#121215] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Larua AI</h1>
            <p className="text-[11px] text-slate-400">Unified Intelligent Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              title="Start a new conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[11px] font-medium">Ready</span>
          </div>
        </div>
      </header>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col relative overflow-hidden max-w-4xl w-full mx-auto">
        {/* Messages View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto my-auto py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center mb-5 text-purple-400 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-medium text-white mb-2 tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                Ask any question, explore ideas, run web queries, or execute system tasks. Everything processes together as one unified system.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {samplePrompts.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="p-4 bg-[#141418] hover:bg-[#1C1C22] border border-white/10 hover:border-purple-500/40 rounded-xl text-left transition-all group flex flex-col justify-between"
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
                <ChatMessage key={message.id} message={message} />
              ))}

              {isProcessing && (
                <div className="flex w-full mb-4 justify-start">
                  <div className="bg-purple-950/40 text-purple-300 text-xs py-2 px-4 border border-purple-500/30 rounded-xl flex items-center animate-pulse gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Processing internally...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-6 bg-transparent">
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
        </div>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="flex-none h-8 border-t border-white/5 bg-[#0D0D10] flex items-center justify-between px-6 text-[11px] text-slate-500">
        <span>Larua AI • Unified Intelligent System</span>
        <div className="flex items-center gap-1.5 text-emerald-500">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px]">Secure & Unified</span>
        </div>
      </footer>
    </div>
  );
}
