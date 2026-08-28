export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: { mimeType: string; data: string }[];
}
