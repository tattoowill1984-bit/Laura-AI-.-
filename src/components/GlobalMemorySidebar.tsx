import { useState, useMemo } from 'react';
import { 
  Brain, 
  Clipboard, 
  Sparkles, 
  X, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  ArrowRight, 
  RefreshCw, 
  Search, 
  Pin, 
  FileCode, 
  MessageSquare, 
  Bookmark, 
  Lightbulb,
  Sliders,
  Download
} from 'lucide-react';
import { MemoryTopic, MemoryInsight, ClipboardItem } from '../types';

interface GlobalMemorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'memory' | 'clipboard';
  onTabChange: (tab: 'memory' | 'clipboard') => void;
  // Memory props
  topics: MemoryTopic[];
  sessionSummary: string;
  keyInsights: string[];
  userDirectives: string[];
  pinnedInsights: MemoryInsight[];
  onAddPinnedInsight: (text: string) => void;
  onRemovePinnedInsight: (id: string) => void;
  isSynthesizing: boolean;
  onRefreshSynthesis: () => void;
  // Clipboard props
  clipboardItems: ClipboardItem[];
  onAddClipboardItem: (item: Omit<ClipboardItem, 'id' | 'createdAt'>) => void;
  onRemoveClipboardItem: (id: string) => void;
  onClearClipboard: () => void;
  onInsertToChat: (content: string) => void;
}

export function GlobalMemorySidebar({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  topics,
  sessionSummary,
  keyInsights,
  userDirectives,
  pinnedInsights,
  onAddPinnedInsight,
  onRemovePinnedInsight,
  isSynthesizing,
  onRefreshSynthesis,
  clipboardItems,
  onAddClipboardItem,
  onRemoveClipboardItem,
  onClearClipboard,
  onInsertToChat,
}: GlobalMemorySidebarProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New pinned note form
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // New clipboard snippet form
  const [isAddingSnippet, setIsAddingSnippet] = useState(false);
  const [newSnippetTitle, setNewSnippetTitle] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [newSnippetType, setNewSnippetType] = useState<'code' | 'snippet' | 'prompt' | 'note'>('snippet');

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddPinnedInsight(newNoteText.trim());
    setNewNoteText('');
    setIsAddingNote(false);
  };

  const handleSaveSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnippetTitle.trim() || !newSnippetContent.trim()) return;
    onAddClipboardItem({
      title: newSnippetTitle.trim(),
      content: newSnippetContent.trim(),
      type: newSnippetType,
    });
    setNewSnippetTitle('');
    setNewSnippetContent('');
    setIsAddingSnippet(false);
  };

  const handleExportClipboard = () => {
    if (clipboardItems.length === 0) return;
    const content = clipboardItems.map(item => (
      `### ${item.title} (${item.type})\n*Saved on ${new Date(item.createdAt).toLocaleString()}*\n\n\`\`\`\n${item.content}\n\`\`\`\n`
    )).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `larua-clipboard-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.summary.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [topics, searchQuery]);

  const filteredClipboard = useMemo(() => {
    if (!searchQuery.trim()) return clipboardItems;
    const q = searchQuery.toLowerCase();
    return clipboardItems.filter(i => 
      i.title.toLowerCase().includes(q) || 
      i.content.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  }, [clipboardItems, searchQuery]);

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] bg-[#121215] border-l border-white/10 flex flex-col shadow-2xl transition-all duration-300 animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#16161B]">
        <div className="flex items-center gap-2">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => { onTabChange('memory'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'memory'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Global Memory</span>
              {topics.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                  {topics.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { onTabChange('clipboard'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'clipboard'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Clipboard</span>
              {clipboardItems.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">
                  {clipboardItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-white/5 bg-[#141418] flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'memory' ? 'Search synthesized topics...' : 'Search clipboard snippets...'}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {activeTab === 'memory' ? (
          <button
            onClick={onRefreshSynthesis}
            disabled={isSynthesizing}
            className="p-1.5 text-slate-400 hover:text-purple-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Re-synthesize memory from dialogue"
          >
            <RefreshCw className={`w-4 h-4 ${isSynthesizing ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        ) : (
          <button
            onClick={handleExportClipboard}
            disabled={clipboardItems.length === 0}
            className="p-1.5 text-slate-400 hover:text-purple-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Export clipboard to Markdown"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'memory' ? (
          /* ================= GLOBAL MEMORY VIEW ================= */
          <div className="space-y-4">
            {/* Executive Synthesis Summary */}
            <div className="p-3.5 bg-gradient-to-br from-purple-950/30 to-indigo-950/20 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1.5 text-purple-300">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Session Synthesis</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {sessionSummary || "Larua continuously analyzes your chat stream, distilling high-level topics, user preferences, and actionable context."}
              </p>
            </div>

            {/* Pinned User Directives / Custom Notes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Pin className="w-3.5 h-3.5 text-purple-400" />
                  <span>Pinned Instructions & Context</span>
                </div>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Rule</span>
                </button>
              </div>

              {isAddingNote && (
                <form onSubmit={handleSaveNote} className="mb-3 p-3 bg-black/40 border border-purple-500/30 rounded-xl space-y-2">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="e.g. Always respond in bullet points; Focus on TypeScript and performance..."
                    rows={2}
                    className="w-full text-xs p-2 bg-transparent border border-white/10 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newNoteText.trim()}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] rounded-lg disabled:opacity-50"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {pinnedInsights.length === 0 && userDirectives.length === 0 ? (
                <div className="p-3 bg-white/5 border border-dashed border-white/10 rounded-xl text-center">
                  <p className="text-[11px] text-slate-400">
                    No custom pinned rules yet. Pin directives so Larua maintains your specific preferences.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pinnedInsights.map((insight) => (
                    <div key={insight.id} className="group p-2.5 bg-[#18181D] border border-white/10 rounded-xl flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Bookmark className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                        <span className="text-xs text-slate-200">{insight.text}</span>
                      </div>
                      <button
                        onClick={() => onRemovePinnedInsight(insight.id)}
                        className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove pinned item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {userDirectives.map((dir, idx) => (
                    <div key={idx} className="p-2.5 bg-[#18181D] border border-white/5 rounded-xl flex items-start gap-2">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-slate-300">{dir}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Synthesized Topics Feed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  <span>Synthesized Topics & Concepts</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {filteredTopics.length} topics
                </span>
              </div>

              {filteredTopics.length === 0 ? (
                <div className="p-6 bg-white/5 border border-white/5 rounded-xl text-center space-y-2">
                  <Brain className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No synthesized topics yet. Start asking questions or discussing projects to build global memory.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-3 bg-[#18181E] border border-white/10 hover:border-purple-500/40 rounded-xl transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-100">{topic.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wider ${
                          topic.category === 'Technical' ? 'bg-blue-900/40 text-blue-300 border border-blue-500/30' :
                          topic.category === 'Directive' ? 'bg-purple-900/40 text-purple-300 border border-purple-500/30' :
                          topic.category === 'Insight' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30' :
                          'bg-white/10 text-slate-300'
                        }`}>
                          {topic.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {topic.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Key Technical Insights */}
            {keyInsights.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-300">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>Synthesized Insights & Takeaways</span>
                </div>
                <div className="space-y-1.5">
                  {keyInsights.map((insight, idx) => (
                    <div key={idx} className="p-2.5 bg-[#18181D] border border-white/5 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= CLIPBOARD VIEW ================= */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Saved Snippets & Notes</span>
              <div className="flex items-center gap-2">
                {clipboardItems.length > 0 && (
                  <button
                    onClick={onClearClipboard}
                    className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setIsAddingSnippet(!isAddingSnippet)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 bg-purple-950/40 border border-purple-500/30 rounded-lg"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Snippet</span>
                </button>
              </div>
            </div>

            {isAddingSnippet && (
              <form onSubmit={handleSaveSnippet} className="p-3.5 bg-black/40 border border-purple-500/40 rounded-xl space-y-2.5">
                <input
                  type="text"
                  value={newSnippetTitle}
                  onChange={(e) => setNewSnippetTitle(e.target.value)}
                  placeholder="Snippet Title..."
                  className="w-full text-xs p-2 bg-transparent border border-white/10 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60"
                  autoFocus
                />
                
                <textarea
                  value={newSnippetContent}
                  onChange={(e) => setNewSnippetContent(e.target.value)}
                  placeholder="Paste snippet, code, or prompt here..."
                  rows={4}
                  className="w-full text-xs p-2 bg-transparent border border-white/10 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 font-mono resize-y"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {(['snippet', 'code', 'prompt', 'note'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewSnippetType(t)}
                        className={`text-[10px] px-2 py-0.5 rounded capitalize ${
                          newSnippetType === t ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSnippet(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newSnippetTitle.trim() || !newSnippetContent.trim()}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] rounded-lg disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            )}

            {filteredClipboard.length === 0 ? (
              <div className="p-8 bg-white/5 border border-white/5 rounded-xl text-center space-y-2">
                <Clipboard className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Your clipboard is empty. Save code blocks or messages directly from the chat, or click "Add Snippet" above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClipboard.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#18181E] border border-white/10 rounded-xl space-y-2 group hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {item.type === 'code' ? <FileCode className="w-3.5 h-3.5 text-blue-400" /> :
                         item.type === 'prompt' ? <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> :
                         item.type === 'note' ? <Bookmark className="w-3.5 h-3.5 text-amber-400" /> :
                         <Clipboard className="w-3.5 h-3.5 text-purple-400" />}
                        <span className="text-xs font-semibold text-slate-100">{item.title}</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-white/5 text-slate-400 rounded">
                        {item.type}
                      </span>
                    </div>

                    <pre className="text-xs font-mono p-2.5 bg-black/50 border border-white/5 rounded-lg overflow-x-auto text-slate-300 max-h-36 whitespace-pre-wrap">
                      {item.content}
                    </pre>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs text-slate-400">
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(item.id, item.content)}
                          className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 hover:text-white rounded-md text-[11px] transition-colors"
                          title="Copy to system clipboard"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onInsertToChat(item.content)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 rounded-md text-[11px] transition-colors"
                          title="Insert into chat prompt"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>Insert</span>
                        </button>

                        <button
                          onClick={() => onRemoveClipboardItem(item.id)}
                          className="p-1 hover:text-red-400 text-slate-500 rounded transition-colors"
                          title="Delete snippet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
