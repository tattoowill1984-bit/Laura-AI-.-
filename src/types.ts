export interface MessageAttachment {
  mimeType: string;
  data: string;
  name?: string;
  size?: number;
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  input: any;
  output: any;
  status: 'running' | 'completed' | 'failed';
  timestamp: string;
}

export interface SearchCitation {
  title: string;
  url: string;
  snippet?: string;
}

export interface EngineFailoverRecord {
  from: string;
  to: string;
  reason: string;
  timestamp: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: MessageAttachment[];
  toolExecutions?: ToolExecutionRecord[];
  citations?: SearchCitation[];
  engineFailover?: EngineFailoverRecord;
}

export interface LaruaIdentity {
  name: string;
  archetype: string;
  essence: string;
  coreDirectives: string[];
  activeMood: string;
  curiosityLevel: number;
  autonomyLevel: number;
  focusAnchor: string;
  lastIntrospection: string;
  milestones: string[];
}

export interface ThoughtEntry {
  id: string;
  thought: string;
  category: 'perception' | 'reflection' | 'investigation' | 'self_healing' | 'synthesis';
  timestamp: string;
  context?: string;
}

export interface SovereignMemoryItem {
  id: string;
  category: 'core_fact' | 'user_model' | 'world_knowledge' | 'epiphany' | 'directive';
  key: string;
  content: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationItem {
  id: string;
  topic: string;
  status: 'pondering' | 'investigating' | 'concluded';
  hypothesis: string;
  findings: string[];
  lastUpdated: string;
}

export interface ContinuousEvaluations {
  latencyMs: number;
  alignmentScore: number; // 0-100%
  nasFitnessScore: number; // 0-100%
  storageConsistencyScore: number; // 0-100%
  postTrainingDistillations: number;
  lastEvalTime: string;
}

export interface MoEExpertConfig {
  name: string;
  domain: 'perception' | 'reasoning' | 'grounding' | 'governance';
  primaryModel: string;
  gatingWeight: number;
  temperature: number;
}

export interface MindState {
  identity: LaruaIdentity;
  thoughts: ThoughtEntry[];
  longTermMemory: SovereignMemoryItem[];
  investigations: InvestigationItem[];
  posture: string;
  uptimeSec: number;
  heapUsedMB: number;
  activeModels: string[];
  currentEngine: string;
  lastHealTime: string;
  evaluations?: ContinuousEvaluations;
  moeActiveExpert?: string;
  nasTopRankedModel?: string;
  governanceStatus?: 'APPROVED' | 'MONITORED' | 'GATEKEEPER_ENGAGED';
}

export interface MemoryTopic {
  id: string;
  title: string;
  category: 'Topic' | 'Technical' | 'Directive' | 'Insight' | 'Preference';
  summary: string;
  relevance: 'high' | 'medium' | 'low';
  updatedAt: number;
}

export interface MemoryInsight {
  id: string;
  text: string;
  source: 'ai_synthesis' | 'user_pinned';
  createdAt: number;
}

export interface ClipboardItem {
  id: string;
  title: string;
  content: string;
  type: 'code' | 'snippet' | 'prompt' | 'note';
  language?: string;
  createdAt: number;
}

export interface CapabilityParameterProperty {
  type: string;
  description?: string;
}

export interface CapabilitySchema {
  type: string;
  properties?: Record<string, CapabilityParameterProperty>;
  required?: string[];
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: 'Search' | 'Integration' | 'System' | 'Data' | 'Custom';
  handlerType: 'internal' | 'webhook' | 'script';
  endpoint?: string;
  parametersSchema?: CapabilitySchema;
  authHeadersJson?: string;
  status: 'active' | 'disabled';
  createdAt: number;
}

