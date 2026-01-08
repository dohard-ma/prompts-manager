
export interface PromptVersion {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

export interface GeneratedResult {
  id: string;
  imageUrl: string;
  promptVersionId: string;
  promptText: string;
  timestamp: number;
  duration?: number; // in seconds
}

export interface ImageReference {
  id: string;
  data: string; // Base64
  mimeType: string;
  name: string;
  selected?: boolean;
  selectedOrder?: number; 
}

export interface LogEntry {
  id: string;
  date: string;
  content: string;
}

export interface GenConfig {
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}

export interface Project {
  id: string;
  name: string;
  versions: PromptVersion[];
  results: GeneratedResult[];
  lastPrompt: string;
  assets: ImageReference[];
  updateLogs: LogEntry[];
  config: GenConfig;
}

export enum AppStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error',
}
