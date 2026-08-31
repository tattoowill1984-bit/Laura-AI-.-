import { useState } from 'react';
import { Message } from '../types';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  User,
  Copy,
  Check,
  FileText,
  FileCode,
  Globe,
  ExternalLink,
  Cpu,
  Image as ImageIcon
} from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={cn('flex w-full mb-6 group', isUser ? 'justify-end' : 'justify-start')}>
      <div 
        className={cn(
          'max-w-[90%] sm:max-w-[82%] rounded-2xl p-5 text-sm relative transition-all shadow-sm',
          isUser 
            ? 'bg-purple-600 text-white rounded-br-sm' 
            : message.isError 
              ? 'bg-red-950/40 text-red-300 border border-red-500/30 rounded-bl-sm'
              : 'bg-[#18181B] border border-white/10 text-slate-200 rounded-bl-sm',
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            {isUser ? (
              <>
                <User className="w-3.5 h-3.5 text-purple-200" />
                <span className="text-xs font-semibold text-purple-100">You</span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-purple-300">Larua</span>
                {message.engine && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-slate-400">
                    {message.engine}
                  </span>
                )}
                {message.mode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    {message.mode}
                  </span>
                )}
              </>
            )}
          </div>

          {message.content && (
            <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-white/10 rounded transition-colors text-xs text-slate-300 hover:text-white cursor-pointer"
                title="Copy text"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Failover Notice */}
        {message.engineFailover && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
            <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Engine Failover: <span className="font-mono">{message.engineFailover.from}</span> → <span className="font-mono">{message.engineFailover.to}</span>
            </span>
          </div>
        )}

        {isUser ? (
           <div className="flex flex-col gap-3">
             <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
             {message.attachments && message.attachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mt-2">
                 {message.attachments.map((att, i) => (
                   att.mimeType.startsWith('image/') && att.data ? (
                     <img key={i} src={`data:${att.mimeType};base64,${att.data}`} className="max-w-[220px] max-h-[220px] object-cover rounded-lg border border-white/20 shadow-md" alt="attachment" />
                   ) : att.mimeType.startsWith('image/') ? (
                     <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs text-purple-200">
                       <ImageIcon className="w-4 h-4 text-pink-300 shrink-0" />
                       <span className="truncate max-w-[180px] font-medium text-white">{att.name || 'Image Attachment'}</span>
                     </div>
                   ) : (
                     <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/20 rounded-lg text-xs text-purple-200">
                       {att.mimeType.includes('code') || att.mimeType.includes('json') || (att.name && att.name.match(/\.(ts|tsx|js|jsx|py|json|html|css)$/i)) ? (
                         <FileCode className="w-4 h-4 text-blue-300 shrink-0" />
                       ) : (
                         <FileText className="w-4 h-4 text-purple-300 shrink-0" />
                       )}
                       <span className="truncate max-w-[180px] font-medium text-white">{att.name || `Document (${att.mimeType})`}</span>
                     </div>
                   )
                 ))}
               </div>
             )}
           </div>
        ) : (
          <div className="space-y-3">
            <div className="markdown-body prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-a:text-purple-400 hover:prose-a:text-purple-300 text-slate-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Google Search Grounding Citations */}
            {message.citations && message.citations.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Google Grounded Sources</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {message.citations.map((cite, idx) => (
                    <a
                      key={idx}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                      <span className="truncate max-w-[180px]">{cite.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
