import { Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, User } from 'lucide-react';

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn('flex w-full mb-6', isUser ? 'justify-end' : 'justify-start')}>
      <div 
        className={cn(
          'max-w-[88%] sm:max-w-[80%] rounded-2xl p-5 text-sm relative transition-all shadow-sm',
          isUser 
            ? 'bg-purple-600 text-white rounded-br-sm' 
            : message.isError 
              ? 'bg-red-950/40 text-red-300 border border-red-500/30 rounded-bl-sm'
              : 'bg-[#18181B] border border-white/10 text-slate-200 rounded-bl-sm',
        )}
      >
        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/10">
          {isUser ? (
            <>
              <User className="w-3.5 h-3.5 text-purple-200" />
              <span className="text-xs font-semibold text-purple-100">You</span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-xs font-semibold text-purple-300">Larua AI</span>
            </>
          )}
        </div>

        {isUser ? (
           <div className="flex flex-col gap-3">
             <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.content}</p>
             {message.attachments && message.attachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mt-2">
                 {message.attachments.map((att, i) => (
                   att.mimeType.startsWith('image/') && (
                     <img key={i} src={`data:${att.mimeType};base64,${att.data}`} className="max-w-[220px] max-h-[220px] object-cover rounded-lg border border-white/20 shadow-md" alt="attachment" />
                   )
                 ))}
               </div>
             )}
           </div>
        ) : (
          <div className="markdown-body prose prose-sm max-w-none prose-invert prose-p:leading-relaxed prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-a:text-purple-400 hover:prose-a:text-purple-300 text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
