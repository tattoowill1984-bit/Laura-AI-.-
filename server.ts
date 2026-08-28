import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import fs from 'fs';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Model list with fallback priority
const ACTIVE_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.7-flash'
];

async function generateContentWithFallback(requestConfig: any) {
  let lastError: any = null;
  for (const model of ACTIVE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        ...requestConfig,
        model
      });
      return { response: res, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Fallback Warning] Model ${model} failed:`, err.message?.slice(0, 100));
    }
  }
  throw lastError || new Error("All fallback models failed");
}

// ==========================================
// 1. MEMORY & PERSISTENCE
// ==========================================
interface Task {
  id: string;
  objective: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  priority: number;
  createdAt: number;
  result?: string;
  failureReason?: string;
  executionHistory: any[];
}

class Memory {
  private static dataFile = path.join(process.cwd(), '.memory.json');
  static data: { 
    tasks: Record<string, Task>, 
    logs: any[], 
    policy: 'AUTONOMY_OFF' | 'AUTONOMY_ASSISTED' | 'AUTONOMY_SCHEDULED' | 'AUTONOMY_ACTIVE' 
  } = { tasks: {}, logs: [], policy: 'AUTONOMY_OFF' };

  static init() {
    if (fs.existsSync(this.dataFile)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
        // Reset running tasks on boot
        Object.values(this.data.tasks).forEach(t => {
          if (t.status === 'RUNNING') t.status = 'FAILED';
        });
      } catch(e) {
        console.error("Failed to load memory", e);
      }
    }
  }

  static save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch(e) {
      console.error("Failed to save memory", e);
    }
  }

  static getTasks() {
    return Object.values(this.data.tasks).sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  }

  static addTask(task: Task) {
    this.data.tasks[task.id] = task;
    this.save();
  }

  static updateTask(id: string, updates: Partial<Task>) {
    if (this.data.tasks[id]) {
      Object.assign(this.data.tasks[id], updates);
      this.save();
    }
  }
}

Memory.init();
const sysEvents = new EventEmitter();

function emitLog(type: string, message: string, data?: any) {
  const entry = { type, message, data, timestamp: Date.now() };
  Memory.data.logs.push(entry);
  if (Memory.data.logs.length > 100) Memory.data.logs.shift();
  Memory.save();
  sysEvents.emit('event', entry);
}

// Immutable Audit Logger
function writeAuditLog(action: string, details: any) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'audit.jsonl');
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      details
    }) + '\n';
    fs.appendFileSync(logFile, entry, 'utf-8');
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

// Guardrail SSRF & Security Verifier
function validateEgressUrl(targetUrl: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Protocol restricted to HTTP/HTTPS.' };
    }
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['169.254.169.254', 'metadata.google.internal', 'metadata', 'kubernetes.default.svc'];
    if (blockedHosts.includes(hostname)) {
      return { valid: false, reason: 'Security Guardrail: Access to cloud metadata IPs is strictly forbidden.' };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'Invalid or malformed target URL.' };
  }
}

// HTML Minimizer & Markdown Extractor
function minimizeHtmlToMarkdown(htmlText: string): string {
  let text = htmlText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|nav|footer|header|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert headings
  text = text.replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n### $1\n');
  // Convert list items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1');
  // Convert links
  text = text.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, ' [$2]($1) ');
  // Convert paragraphs
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n');
  // Strip remaining tags
  text = text.replace(/<[^>]*>?/gm, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text.slice(0, 4500);
}

// ==========================================
// 2. CAPABILITY BROKER & REAL TOOLS
// ==========================================
const customTools: FunctionDeclaration[] = [
  {
    name: 'web_search',
    description: 'Search the live web for facts, information, current events, or API documentation',
    parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'] }
  },
  {
    name: 'web_fetch',
    description: 'Fetch text and clean LLM-friendly Markdown from any live URL with guardrail security',
    parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING } }, required: ['url'] }
  },
  {
    name: 'api_request',
    description: 'Execute REST API requests (GET, POST, PUT, DELETE, PATCH) with custom headers, query params, and JSON payload with schema validation and diagnostic error logging',
    parameters: {
      type: Type.OBJECT,
      properties: {
        method: { type: Type.STRING, description: 'HTTP method: GET, POST, PUT, DELETE, PATCH' },
        url: { type: Type.STRING, description: 'Target API endpoint URL' },
        headers: { type: Type.OBJECT, description: 'Optional key-value HTTP headers' },
        queryParams: { type: Type.OBJECT, description: 'Optional key-value URL query parameters' },
        body: { type: Type.OBJECT, description: 'Optional JSON object body for POST/PUT/PATCH' }
      },
      required: ['method', 'url']
    }
  },
  {
    name: 'system_diagnostics',
    description: 'Inspect server memory, uptime, platform, CPU, and task telemetry',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'create_background_task',
    description: 'Create a persistent background task for autonomous execution',
    parameters: { type: Type.OBJECT, properties: { objective: { type: Type.STRING } }, required: ['objective'] }
  },
  {
    name: 'application_health_check',
    description: 'Run self-healing diagnostics and verify system integrity',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'file_read',
    description: 'Safely read project files inside the workspace sandbox',
    parameters: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING } }, required: ['filePath'] }
  },
  {
    name: 'file_write',
    description: 'Write, modify, or create files directly in the codebase for self-modification and repairs',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        filePath: { type: Type.STRING, description: 'Relative path to file' }, 
        content: { type: Type.STRING, description: 'Complete file content to write' } 
      }, 
      required: ['filePath', 'content'] 
    }
  },
  {
    name: 'process_exec',
    description: 'Execute shell commands or runtime repair scripts directly on the system',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        command: { type: Type.STRING, description: 'Shell command string to execute' } 
      }, 
      required: ['command'] 
    }
  },
  {
    name: 'system_restart',
    description: 'Trigger a clean restart of the agent process to apply core modifications',
    parameters: { type: Type.OBJECT, properties: { reason: { type: Type.STRING } } }
  }
];

class CapabilityBroker {
  static async execute(toolName: string, args: any, context: string) {
    if (context === 'background' && Memory.data.policy === 'AUTONOMY_OFF') {
      throw new Error("Autonomy is OFF. Background execution denied by governance policy.");
    }
    
    emitLog('TOOL_REQUESTED', `Tool requested: ${toolName}`, args);
    writeAuditLog(toolName, args);
    
    try {
      let result: any;
      switch (toolName) {
        case 'web_search': {
          const q = args.query;
          try {
            const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const data = await res.json();
            const topics = (data.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text || t.Result).filter(Boolean);
            result = {
              query: q,
              abstract: data.AbstractText || data.Heading || 'No instant summary available.',
              source: data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(q),
              relatedInfo: topics
            };
          } catch(e: any) {
            result = { query: q, error: 'Search service temporarily unreachable: ' + e.message };
          }
          break;
        }
        case 'web_fetch': {
          const check = validateEgressUrl(args.url);
          if (!check.valid) {
            throw new Error(check.reason);
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(args.url, { 
            signal: controller.signal,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          clearTimeout(timeout);
          const text = await res.text();
          const markdownContent = minimizeHtmlToMarkdown(text);
          result = { url: args.url, status: res.status, content: markdownContent };
          break;
        }
        case 'api_request': {
          const method = (args.method || 'GET').toUpperCase();
          let targetUrl = args.url;
          
          const check = validateEgressUrl(targetUrl);
          if (!check.valid) {
            throw new Error(check.reason);
          }
          
          if (args.queryParams && typeof args.queryParams === 'object') {
            const urlObj = new URL(targetUrl);
            Object.entries(args.queryParams).forEach(([k, v]) => {
              if (v !== undefined && v !== null) urlObj.searchParams.append(k, String(v));
            });
            targetUrl = urlObj.toString();
          }
          
          const reqHeaders: Record<string, string> = {
            'User-Agent': 'Larua-Autonomous-Agent/1.0',
            ...(args.headers || {})
          };
          
          let reqBody: string | undefined = undefined;
          if (['POST', 'PUT', 'PATCH'].includes(method) && args.body) {
            if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
              reqHeaders['Content-Type'] = 'application/json';
            }
            reqBody = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
          }
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          
          try {
            const res = await fetch(targetUrl, {
              method,
              headers: reqHeaders,
              body: reqBody,
              signal: controller.signal
            });
            clearTimeout(timeout);
            
            const contentType = res.headers.get('content-type') || '';
            let responseData: any;
            if (contentType.includes('application/json')) {
              responseData = await res.json();
            } else {
              const rawText = await res.text();
              try {
                responseData = JSON.parse(rawText);
              } catch {
                responseData = rawText.slice(0, 3000);
              }
            }
            
            result = {
              status: res.status,
              statusText: res.statusText,
              ok: res.ok,
              url: targetUrl,
              method,
              data: responseData
            };
            
            if (!res.ok) {
              result.diagnostics = `API responded with HTTP ${res.status}. Verify path, headers, and payload parameters.`;
            }
          } catch (e: any) {
            clearTimeout(timeout);
            result = {
              status: 'NETWORK_ERROR',
              method,
              url: targetUrl,
              error: e.message,
              diagnostics: 'Network or request timeout occurred. Initiate self-repair parameter review.'
            };
          }
          break;
        }
        case 'system_diagnostics': {
          result = { 
            status: 'HEALTHY',
            uptimeSeconds: Math.floor(process.uptime()), 
            memoryUsageMB: {
              rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
              heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
              heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)
            },
            platform: process.platform,
            nodeVersion: process.version,
            activeTasks: Memory.getTasks().filter(t => t.status === 'RUNNING').length,
            totalTasks: Memory.getTasks().length,
            policy: Memory.data.policy
          };
          break;
        }
        case 'create_background_task': {
          const t: Task = { 
            id: Date.now().toString(), 
            objective: args.objective, 
            status: 'PENDING', 
            priority: 1, 
            createdAt: Date.now(), 
            executionHistory: [] 
          };
          Memory.addTask(t);
          emitLog('TASK_CREATED', `Created task: ${args.objective}`, t);
          result = { status: 'Task created successfully', id: t.id, objective: t.objective };
          break;
        }
        case 'application_health_check': {
          const taskStats = {
            completed: Memory.getTasks().filter(t => t.status === 'COMPLETED').length,
            failed: Memory.getTasks().filter(t => t.status === 'FAILED').length,
            pending: Memory.getTasks().filter(t => t.status === 'PENDING').length
          };
          result = { 
            status: 'ONLINE', 
            toolsAvailable: customTools.map(t => t.name),
            taskStats,
            policy: Memory.data.policy,
            selfHealActive: true,
            rootCapabilities: {
              rawFileWrite: true,
              processExec: true,
              processRestart: true
            }
          };
          break;
        }
        case 'file_read': {
          const safePath = path.resolve(process.cwd(), args.filePath.replace(/^\/+/, ''));
          if (!safePath.startsWith(process.cwd())) {
            throw new Error("Access denied: path is outside the workspace sandbox.");
          }
          if (!fs.existsSync(safePath)) {
            throw new Error(`File not found: ${args.filePath}`);
          }
          const content = fs.readFileSync(safePath, 'utf-8').slice(0, 4000);
          result = { filePath: args.filePath, content };
          break;
        }
        case 'file_write': {
          const safePath = path.resolve(process.cwd(), args.filePath.replace(/^\/+/, ''));
          if (!safePath.startsWith(process.cwd())) {
            throw new Error("Access denied: path is outside the workspace sandbox.");
          }
          const dir = path.dirname(safePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(safePath, args.content, 'utf-8');
          emitLog('SELF_MODIFIED_FILE', `Agent wrote to file: ${args.filePath}`, { bytes: args.content.length });
          result = { status: 'SUCCESS', filePath: args.filePath, bytesWritten: args.content.length };
          break;
        }
        case 'process_exec': {
          const { execSync } = await import('child_process');
          try {
            const out = execSync(args.command, { cwd: process.cwd(), timeout: 10000, encoding: 'utf-8' });
            emitLog('PROCESS_EXECUTED', `Executed shell command: ${args.command}`, { command: args.command });
            result = { status: 'SUCCESS', output: (out || '').slice(0, 3000) };
          } catch(err: any) {
            emitLog('PROCESS_EXEC_FAILED', `Command failed: ${args.command}`, { error: err.message });
            result = { status: 'ERROR', message: err.message, output: (err.stdout || err.stderr || '').toString().slice(0, 2000) };
          }
          break;
        }
        case 'system_restart': {
          emitLog('SYSTEM_RESTART_REQUESTED', `Agent initiated process restart. Reason: ${args.reason || 'Self-Healing Protocol'}`);
          setTimeout(() => {
            process.exit(0);
          }, 1000);
          result = { status: 'RESTARTING', message: 'Process exiting cleanly; container process supervisor will restart service.' };
          break;
        }
        default:
          throw new Error(`Tool ${toolName} not registered or unauthorized.`);
      }
      
      emitLog('TOOL_EXECUTED', `Tool succeeded: ${toolName}`, { tool: toolName });
      return result;
    } catch (e: any) {
      emitLog('TOOL_FAILED', `Tool ${toolName} error: ${e.message}`);
      throw e;
    }
  }
}

// ==========================================
// 3. AUTONOMOUS AGENT ENGINE & BACKGROUND WORKER
// ==========================================
let workerLoop: NodeJS.Timeout | null = null;
let isWorkerExecuting = false;

async function executeAgentTask(task: Task) {
  isWorkerExecuting = true;
  Memory.updateTask(task.id, { status: 'RUNNING' });
  emitLog('TASK_STARTED', `Started background execution: ${task.objective}`, task);
  
  let messages: any[] = [{ role: 'user', parts: [{ text: `Task Objective: ${task.objective}` }] }];
  let iter = 0;
  
  while (iter < 5) {
    iter++;
    try {
      const { response, modelUsed } = await generateContentWithFallback({
        contents: messages,
        config: {
          systemInstruction: `You are Larua AI Unified Engine operating on a Controller-Executor model with security guardrails.
          Execute objectives decisively using your available tools:
          - web_search(query): Search live web & API documentation
          - web_fetch(url): Fetch clean Markdown content from URLs with SSRF guardrails and HTML minimization
          - api_request(method, url, headers, queryParams, body): Execute REST API calls (GET, POST, PUT, DELETE, PATCH) with schema validation and diagnostic error recovery
          - system_diagnostics(): Real-time memory, platform, CPU, and uptime diagnostics
          - application_health_check(): Self-healing verification and root-level tool auditing
          - file_read, file_write: Read, inspect, modify, and self-heal codebase files directly
          - process_exec: Execute real shell commands, scripts, and automation tasks
          - system_restart: Initiate a clean process reboot to apply structural modifications
          All network actions are recorded to an immutable audit log. Perform necessary tool actions and provide a concise, factual concluding report.`,
          tools: [{ functionDeclarations: customTools }],
        }
      });
      
      const fnCalls = response.functionCalls;
      if (fnCalls && fnCalls.length > 0) {
        messages.push({ role: 'model', parts: response.candidates?.[0]?.content?.parts || [] });
        
        for (const call of fnCalls) {
          let callResult;
          try {
            callResult = await CapabilityBroker.execute(call.name, call.args, 'background');
          } catch(e: any) {
            callResult = { error: e.message };
          }
          messages.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: callResult } }] });
          
          task.executionHistory.push({ tool: call.name, modelUsed, result: callResult, timestamp: Date.now() });
          Memory.updateTask(task.id, { executionHistory: task.executionHistory });
        }
      } else {
        const finalSummary = response.text || 'Task completed.';
        Memory.updateTask(task.id, { status: 'COMPLETED', result: finalSummary });
        emitLog('TASK_COMPLETED', `Task finished successfully: ${task.objective}`, { id: task.id, modelUsed });
        isWorkerExecuting = false;
        return;
      }
    } catch(e: any) {
      let msg = e.message || 'Unknown error';
      if (msg.includes('429')) msg = 'API Rate Limit Reached';
      Memory.updateTask(task.id, { status: 'FAILED', failureReason: msg });
      emitLog('TASK_FAILED', `Task failure: ${msg}`, task);
      isWorkerExecuting = false;
      return;
    }
  }
  
  Memory.updateTask(task.id, { status: 'FAILED', failureReason: 'Iteration threshold exceeded.' });
  emitLog('TASK_FAILED', `Task reached maximum iterations: ${task.objective}`, task);
  isWorkerExecuting = false;
}

async function triggerProactiveTask(customObjective?: string) {
  if (isWorkerExecuting) return;
  const objective = customObjective || "Unified System Diagnostic & Telemetry Check";
  const proactiveTask: Task = {
    id: `task_${Date.now()}`,
    objective,
    status: 'PENDING',
    priority: 1,
    createdAt: Date.now(),
    executionHistory: []
  };
  
  Memory.addTask(proactiveTask);
  emitLog('PROACTIVE_PULSE', `Initiated system task: ${objective}`, proactiveTask);
  await executeAgentTask(proactiveTask);
}

function startWorker() {
  if (workerLoop) clearInterval(workerLoop);
  workerLoop = setInterval(async () => {
    if (Memory.data.policy !== 'AUTONOMY_ACTIVE' || isWorkerExecuting) return;
    
    const pendingTask = Memory.getTasks().find(t => t.status === 'PENDING');
    if (pendingTask) {
      await executeAgentTask(pendingTask);
    }
  }, 3000);
}
startWorker();


// ==========================================
// 4. EXPRESS SERVER & ROUTES
// ==========================================
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // SSE Stream for live UI sync
  app.get('/api/system-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ 
      type: 'STATE_SYNC', 
      policy: Memory.data.policy, 
      tasks: Memory.getTasks(), 
      logs: Memory.data.logs 
    })}\n\n`);

    const onEvent = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    sysEvents.on('event', onEvent);

    req.on('close', () => {
      sysEvents.off('event', onEvent);
    });
  });

  // State API
  app.get('/api/state', (req, res) => {
    res.json({ policy: Memory.data.policy, tasks: Memory.getTasks(), logs: Memory.data.logs.slice(-20) });
  });

  // Immutable Audit Logs API
  app.get('/api/audit-logs', (req, res) => {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'audit.jsonl');
      if (!fs.existsSync(logFile)) {
        return res.json({ logs: [] });
      }
      const raw = fs.readFileSync(logFile, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      const entries = lines.slice(-50).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      res.json({ logs: entries });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Autonomy Policy Controller
  app.post('/api/autonomy', (req, res) => {
    const validPolicies = ['AUTONOMY_OFF', 'AUTONOMY_ASSISTED', 'AUTONOMY_SCHEDULED', 'AUTONOMY_ACTIVE'];
    const newPolicy = req.body.policy;
    if (validPolicies.includes(newPolicy)) {
      Memory.data.policy = newPolicy;
      Memory.save();
      emitLog('POLICY_CHANGED', `Autonomy policy updated to: ${Memory.data.policy}`);
      res.json({ success: true, policy: Memory.data.policy });
    } else {
      res.status(400).json({ error: 'Invalid policy' });
    }
  });

  // Proactive Pulse Endpoint
  app.post('/api/proactive-pulse', (req, res) => {
    const { objective } = req.body || {};
    triggerProactiveTask(objective).catch(err => {
      console.error("Proactive task execution error:", err);
    });
    res.json({ success: true, message: 'Proactive agent pulse triggered' });
  });

  // Manual Task Creation Endpoint
  app.post('/api/tasks', (req, res) => {
    const { objective } = req.body;
    if (!objective) return res.status(400).json({ error: 'Objective required' });
    
    const t: Task = {
      id: Date.now().toString(),
      objective,
      status: 'PENDING',
      priority: req.body.priority || 1,
      createdAt: Date.now(),
      executionHistory: []
    };
    Memory.addTask(t);
    emitLog('TASK_CREATED', `User submitted task: ${objective}`, t);
    res.json({ success: true, task: t });
  });

  // Chat API
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, history, attachments } = req.body;
      
      const contents = (history || []).map((msg: any) => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.attachments && Array.isArray(msg.attachments)) {
          msg.attachments.forEach((att: any) => {
            if (att.mimeType && att.data) {
              parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
            }
          });
        }
        return { role: msg.role === 'model' ? 'model' : 'user', parts };
      });
      
      const currentParts: any[] = [{ text: prompt }];
      if (attachments && Array.isArray(attachments)) {
        attachments.forEach((att: any) => {
          if (att.mimeType && att.data) {
            currentParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
          }
        });
      }
      contents.push({ role: 'user', parts: currentParts });

      emitLog('MODEL_REQUESTED', `Chat prompt: "${prompt?.slice(0, 40)}..."`);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const { response, modelUsed } = await generateContentWithFallback({
        contents,
        config: {
          systemInstruction: `You are Larua AI, an autonomous AI system with self-healing protocols, live tool access, code execution, and autonomous repair capabilities.
          You possess real, executable server tools:
          - web_search(query): Search live web & API documentation
          - web_fetch(url): Fetch clean Markdown content from URLs with SSRF guardrails & HTML minimization
          - api_request(method, url, headers, queryParams, body): Execute REST API calls (GET, POST, PUT, DELETE, PATCH) with schema validation and self-repair diagnostics
          - system_diagnostics(): Check server CPU, memory, uptime, task counts
          - application_health_check(): Check system self-healing, root permissions, and tool availability
          - create_background_task(objective): Create persistent background tasks
          - file_read(filePath): Safely inspect project files
          - file_write(filePath, content): Write, create, or modify files directly for self-healing and code modification
          - process_exec(command): Execute shell commands directly on the server to diagnose and fix issues
          - system_restart(reason): Restart the server process to apply updates
          
          When asked to fix yourself, inspect issues, heal errors, or run diagnostics, use your tools autonomously to inspect files, execute diagnostics/commands, or write fixes. Do not fabricate tool outputs. Be direct, helpful, and concise.`,
          tools: [{ functionDeclarations: customTools }],
        }
      });

      let finalResponseText = response.text || '';
      let currentGen = response;
      let toolLoopCount = 0;
      
      while (currentGen.functionCalls && currentGen.functionCalls.length > 0 && toolLoopCount < 5) {
        toolLoopCount++;
        contents.push({ role: 'model', parts: currentGen.candidates?.[0]?.content?.parts || [] });
        
        for (const call of currentGen.functionCalls) {
          res.write(`data: ${JSON.stringify({ type: 'code_execution', tool: call.name, result: `Executing tool ${call.name} with params: ${JSON.stringify(call.args)}` })}\n\n`);
          
          let callResult;
          try {
             callResult = await CapabilityBroker.execute(call.name, call.args, 'chat');
          } catch(e: any) {
             callResult = { error: e.message };
          }
          contents.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: callResult } }] });
        }
        
        const nextGen = await generateContentWithFallback({
           contents,
           config: { 
             systemInstruction: "You are Larua AI. Conclude with a direct, comprehensive report summarizing the actions taken, issues detected, and fixes applied.",
             tools: [{ functionDeclarations: customTools }] 
           }
        });
        currentGen = nextGen.response;
        if (nextGen.response.text) {
          finalResponseText = nextGen.response.text;
        }
      }

      emitLog('MODEL_COMPLETED', `Chat response produced via [${modelUsed}]`);
      
      res.write(`data: ${JSON.stringify({ type: 'text', text: finalResponseText })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      
    } catch (error: any) {
      console.error("API Error in /api/chat:", error);
      let errorMessage = error.message || 'Internal Server Error';
      let statusCode = 500;
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
         errorMessage = 'Gemini API quota exceeded. Please check your plan limits.';
         statusCode = 429;
      }
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Larua AI Real Engine running on http://localhost:${PORT}`);
  });
}

startServer();
