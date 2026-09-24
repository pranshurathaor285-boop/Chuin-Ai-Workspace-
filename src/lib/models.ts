export interface AIModel {
  id: string;
  name: string;
  provider: string;
  providerSlug?: string;
  description: string;
  logo: string;
  badge?: string;
  bestFor?: string;
  contextLength?: number;
}

// Fallback list - only used if /api/models fails
// Main list comes from OpenRouter live API
export const FREE_MODELS: AIModel[] = [
  {
    id: "openrouter/free",
    name: "Auto (Best Available)",
    provider: "OpenRouter",
    providerSlug: "openrouter",
    description: "Automatically picks a working free model.",
    logo: "/models/openrouter.svg",
    bestFor: "Reliability",
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    name: "Nemotron Nano 30B",
    provider: "NVIDIA",
    providerSlug: "nvidia",
    description: "Fastest overall. Best for coding & reasoning.",
    logo: "/models/nvidia.svg",
    badge: "Fastest",
    bestFor: "Coding",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    providerSlug: "meta",
    description: "Balanced. Great all-rounder.",
    logo: "/models/meta.svg",
    badge: "Popular",
    bestFor: "General",
  },
  {
    id: "meta-llama/llama-4-scout:free",
    name: "Llama 4 Scout",
    provider: "Meta",
    providerSlug: "meta",
    description: "10M context. Handles huge inputs.",
    logo: "/models/meta.svg",
    badge: "Long Context",
    bestFor: "Large docs",
  },
  {
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder",
    provider: "Alibaba",
    providerSlug: "alibaba",
    description: "Specialized for code generation.",
    logo: "/models/alibaba.svg",
    badge: "Code",
    bestFor: "Code",
  },
  {
    id: "deepseek/deepseek-chat-v3.1:free",
    name: "DeepSeek V3.1",
    provider: "DeepSeek",
    providerSlug: "deepseek",
    description: "Strong reasoning. Good for planning.",
    logo: "/models/deepseek.svg",
    bestFor: "Reasoning",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    provider: "Google",
    providerSlug: "google",
    description: "Efficient. Good for general tasks.",
    logo: "/models/google.svg",
    bestFor: "General",
  },
  {
    id: "z-ai/glm-5.2:free",
    name: "GLM 5.2",
    provider: "Zhipu AI",
    providerSlug: "z-ai",
    description: "Balanced Chinese model. Good reasoning.",
    logo: "/models/zhipu.svg",
    bestFor: "Multi-language",
  },
];

export const DEFAULT_MODEL = "openrouter/free"; // nemotron by default
