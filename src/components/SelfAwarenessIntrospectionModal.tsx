import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Code2, Cpu, RefreshCw, Zap, CheckCircle2, AlertTriangle, FileText, BarChart3, X } from 'lucide-react';

interface IntrospectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (text: string) => void;
}

export function SelfAwarenessIntrospectionModal({ isOpen, onClose, onInsertToChat }: IntrospectionModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'codebase' | 'telemetry'>('overview');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>('server.ts');
  const [fileAnalysis, setFileAnalysis] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntrospection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/introspect/report?file=${encodeURIComponent(selectedFile)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        setFileAnalysis(data.report.codebase);
      } else {
        throw new Error(data.error || 'Failed to generate introspection report');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIntrospection();
    }
  }, [isOpen, selectedFile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-[#18181C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Self-Awareness & Operational Introspection</h2>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Self-Inspection Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">Codebase health analysis, telemetry synthesis, and self-optimization recommendations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={fetchIntrospection}
              disabled={loading}
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer"
              title="Refresh Introspection Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/10 bg-[#141418] text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Health & Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('codebase')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'codebase'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Codebase Introspection</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'telemetry'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Telemetry & Optimization</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold">Introspection Engine Warning</p>
                <p className="text-red-300/80">{error}</p>
              </div>
            </div>
          )}

          {loading && !report && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-xs text-slate-400">Introspecting code structure, memory, and telemetry parameters...</p>
            </div>
          )}

          {report && activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Overall System Status</span>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-bold text-white">{report.overallHealth}</span>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Active Capabilities</span>
                  <div className="flex items-center gap-2 mt-2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    <span className="text-lg font-bold text-white">{report.codebase.registeredCapabilitiesCount || 15} Registered</span>
                  </div>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Task Success Rate</span>
                  <div className="flex items-center gap-2 mt-2">
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                    <span className="text-lg font-bold text-white">{report.telemetry?.taskMetrics?.successRatePercentage || '100%'}</span>
                  </div>
                </div>
              </div>

              {/* Architecture Summary */}
              <div className="p-4 bg-[#16161A] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Architecture & Operational Boundaries</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {report.codebase.architecture}
                </p>
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Security Guardrails Active:</span>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside pl-1">
                    {report.codebase.securityGuardrails.map((g: string, i: number) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Inefficiencies & Self-Awareness Suggestions */}
              <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <span>Identified Inefficiencies & Self-Optimization Recommendations</span>
                  </div>
                  {onInsertToChat && (
                    <button
                      onClick={() => {
                        const summary = `Run self-optimization on identified codebase issues:\n${report.codebase.inefficienciesIdentified.join('\n')}`;
                        onInsertToChat(summary);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[11px] bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors cursor-pointer"
                    >
                      Optimize in Chat
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-300 font-medium">Current Architectural Observations:</p>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {report.codebase.inefficienciesIdentified.map((item: string, idx: number) => (
                      <li key={idx} className="text-purple-200">{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 text-xs pt-2 border-t border-purple-500/20">
                  <p className="text-slate-300 font-medium">Suggested Action Items:</p>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {report.codebase.suggestedOptimizations.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {report && activeTab === 'codebase' && (
            <div className="space-y-6">
              {/* File Selection */}
              <div className="flex items-center justify-between p-4 bg-[#16161A] border border-white/10 rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-300 font-medium">Select Source File to Inspect:</span>
                </div>
                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="server.ts">server.ts (Backend Engine)</option>
                  <option value="src/App.tsx">src/App.tsx (Frontend Interface)</option>
                  <option value="src/types.ts">src/types.ts (Data Schemas)</option>
                </select>
              </div>

              {/* Codebase File Analysis */}
              {fileAnalysis && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Total Lines</span>
                    <p className="text-lg font-bold text-white mt-1">{fileAnalysis.totalLines}</p>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Imports Count</span>
                    <p className="text-lg font-bold text-white mt-1">{fileAnalysis.importsCount}</p>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Functions / Handlers</span>
                    <p className="text-lg font-bold text-white mt-1">{fileAnalysis.functionCount}</p>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Complexity Score</span>
                    <p className="text-lg font-bold text-purple-300 mt-1">{fileAnalysis.healthScore}</p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#16161A] border border-white/10 rounded-xl space-y-2">
                <span className="text-xs font-semibold text-white">Refactoring & Optimization Suggestions:</span>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {fileAnalysis?.refactoringSuggestions?.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {report && activeTab === 'telemetry' && (
            <div className="space-y-6 text-xs">
              <div className="p-4 bg-[#16161A] border border-white/10 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">Capability Utilization Breakdown</span>
                  <span className="text-[11px] text-slate-400">Past {report.telemetry.timeframeHours} Hours</span>
                </div>

                <div className="space-y-2">
                  {Object.entries(report.telemetry.capabilityUtilization || {}).map(([tool, count]: any) => (
                    <div key={tool} className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-lg">
                      <span className="font-mono text-purple-300">{tool}</span>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-200 rounded text-[11px] font-semibold">{count} executions</span>
                    </div>
                  ))}
                  {Object.keys(report.telemetry.capabilityUtilization || {}).length === 0 && (
                    <p className="text-slate-500 italic">No capability executions recorded in this window.</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#16161A] border border-white/10 rounded-xl space-y-2">
                <span className="font-semibold text-white text-sm">Model Hierarchy & Fallbacks</span>
                <div className="flex items-center gap-2 pt-2">
                  {report.telemetry.activeModels?.map((m: string, idx: number) => (
                    <div key={m} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/40 border border-purple-500/30 rounded-lg text-purple-200">
                      <span className="text-[10px] font-bold text-purple-400">{idx + 1}.</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#18181C] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Self-Awareness Introspection Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
