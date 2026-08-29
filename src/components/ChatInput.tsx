import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, ArrowUp, Mic, MicOff, FileText, FileCode } from 'lucide-react';
import { cn } from '../lib/utils';
import { MessageAttachment } from '../types';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInputProps {
  onSend: (message: string, attachments?: MessageAttachment[]) => void;
  isLoading: boolean;
  insertedText?: string | null;
  onClearInsertedText?: () => void;
}

interface AttachmentFile {
  file: File;
  name: string;
  mimeType: string;
  base64: string;
  size: number;
  preview?: string;
}

function getEffectiveMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'txt': case 'log': return 'text/plain';
    case 'md': case 'markdown': return 'text/markdown';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'xml': return 'text/xml';
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'js': case 'jsx': return 'text/javascript';
    case 'ts': case 'tsx': return 'text/plain';
    case 'py': return 'text/x-python';
    case 'c': case 'cpp': case 'h': case 'cs': case 'java': case 'rs': case 'go': case 'sh': return 'text/plain';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'doc': case 'docx': return 'application/msword';
    default: return file.type || 'text/plain';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatInput({ onSend, isLoading, insertedText, onClearInsertedText }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>('');

  useEffect(() => {
    if (insertedText) {
      setInput((prev) => (prev ? `${prev}\n\n${insertedText}` : insertedText));
      textareaRef.current?.focus();
      if (onClearInsertedText) onClearInsertedText();
    }
  }, [insertedText, onClearInsertedText]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    setSpeechError(null);
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setSpeechError('Voice input is not supported in this browser. Try Chrome or Edge.');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      baseInputRef.current = input;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const prefix = baseInputRef.current;
        const separator = prefix && !prefix.endsWith(' ') ? ' ' : '';
        setInput(prefix ? `${prefix}${separator}${transcript}` : transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied. Please allow microphone permissions.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setSpeechError('Could not start voice recognition.');
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }

    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSend(
        input, 
        attachments.length > 0 
          ? attachments.map(a => ({ mimeType: a.mimeType, data: a.base64, name: a.name, size: a.size })) 
          : undefined
      );
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const mimeType = getEffectiveMimeType(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result ? result.split(',')[1] || '' : '';
        setAttachments(prev => [...prev, {
          file,
          name: file.name,
          mimeType,
          base64: base64Data,
          size: file.size,
          preview: mimeType.startsWith('image/') ? result : undefined
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <form 
        onSubmit={handleSubmit}
        className="relative flex flex-col w-full bg-[#18181B] border border-white/10 rounded-xl transition-all focus-within:border-purple-500/60 shadow-lg"
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-white/10 bg-black/30">
            {attachments.map((att, i) => (
              <div key={i} className="relative group rounded-lg border border-purple-500/30 overflow-hidden bg-[#121215] flex items-center pr-2 pl-1.5 py-1 gap-2 max-w-[200px]">
                {att.mimeType.startsWith('image/') ? (
                  <img src={att.preview} alt="preview" className="h-9 w-9 object-cover rounded" />
                ) : att.mimeType.includes('code') || att.mimeType.includes('json') || att.name.match(/\.(ts|tsx|js|jsx|py|json|html|css)$/i) ? (
                  <div className="h-9 w-9 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                )}
                
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs text-white font-medium truncate" title={att.name}>{att.name}</span>
                  <span className="text-[10px] text-slate-400">{formatFileSize(att.size)}</span>
                </div>

                <button 
                  type="button" 
                  onClick={() => removeAttachment(i)} 
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {speechError && (
          <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-300 text-xs flex items-center justify-between">
            <span>{speechError}</span>
            <button type="button" onClick={() => setSpeechError(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isListening && (
          <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-semibold">Listening for speech... Speak now.</span>
          </div>
        )}

        <div className="flex items-center px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Ask anything or request any task..."}
            className="w-full max-h-36 min-h-[44px] py-2 px-2 bg-transparent border-none focus:outline-none resize-none overflow-y-auto text-slate-100 text-sm placeholder:text-slate-500"
            rows={1}
            disabled={isLoading}
          />
          
          <div className="flex items-center gap-1.5 ml-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              multiple 
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                isListening
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              title={isListening ? "Stop voice input" : "Voice input (Speech to text)"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 text-red-400 animate-bounce" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              disabled={isLoading}
              title="Attach documents, code, images, or files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className={cn(
                "p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                (input.trim() || attachments.length > 0) && !isLoading 
                  ? "bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]" 
                  : "bg-white/5 text-slate-600 cursor-not-allowed"
              )}
              title="Send message"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
