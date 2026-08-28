import { useState, useRef } from 'react';
import { Paperclip, X, ArrowUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatInputProps {
  onSend: (message: string, attachments?: {mimeType: string, data: string}[]) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{file: File, base64: string, mimeType: string, preview: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      onSend(
        input, 
        attachments.length > 0 ? attachments.map(a => ({ mimeType: a.mimeType, data: a.base64 })) : undefined
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
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        setAttachments(prev => [...prev, {
          file,
          mimeType: file.type,
          base64: base64Data,
          preview: result
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
          <div className="flex flex-wrap gap-2 p-3 border-b border-white/10">
            {attachments.map((att, i) => (
              <div key={i} className="relative group rounded-lg border border-purple-500/30 overflow-hidden bg-black/40">
                {att.mimeType.startsWith('image/') ? (
                  <img src={att.preview} alt="preview" className="h-14 w-14 object-cover opacity-90" />
                ) : (
                  <div className="h-14 w-14 flex items-center justify-center text-[10px] text-purple-300 break-all p-1 text-center font-mono">
                    {att.file.name.slice(0, 12)}
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={() => removeAttachment(i)} 
                  className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or request any task..."
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
              accept="image/*" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              disabled={isLoading}
              title="Attach image or file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className={cn(
                "p-2 rounded-lg flex items-center justify-center transition-all",
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
