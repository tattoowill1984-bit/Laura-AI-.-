export interface MessageAttachment {
  mimeType: string;
  data: string;
  name?: string;
  size?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: MessageAttachment[];
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
