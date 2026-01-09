export interface PromptSlot {
  id: string;
  key: string; // 用户自定义 key，如 "lighting"
  label: string; // 用户自定义标签，如 "灯光效果"
  value_cn: string; // 中文逻辑
  value_en: string; // 英文指令
  enabled: boolean;
}

export interface PromptVersion {
  id: string;
  name: string;
  slots: PromptSlot[]; // 模块化插槽
  hash: string; // 用于版本去重
  finalPrompt: string; // 最终拼接的英文提示词（用于结果展示和复制）
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
  imageSize: "1K" | "2K" | "4K";
  aspectRatio: string;
  autoTranslate: boolean;
  translatePrompt: string;
  parsePrompt: string; // 新增：会话分析提示词
}

export interface Project {
  id: string;
  name: string;
  versions: PromptVersion[];
  results: GeneratedResult[];
  assets: ImageReference[];
  config: GenConfig;
  translationCache?: Record<string, string>; // 缓存：中文拼接结果 -> 英文翻译结果
}

export enum AppStatus {
  IDLE = "idle",
  LOADING = "loading",
  ERROR = "error",
}
