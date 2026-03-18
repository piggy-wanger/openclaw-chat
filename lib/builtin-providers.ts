/**
 * Built-in Provider configurations extracted from OpenClaw source code.
 *
 * Source: ~/.nvm/versions/node/v24.14.0/lib/node_modules/openclaw/dist/
 * - onboard-provider-auth-flags-DhIGBqAU.js — Provider auth choices
 * - auth-profiles-DRjqKE3G.js — Base URLs and model catalogs
 * - auth-choice-options-BpuOwHIs.js — Provider labels and hints
 */

export type BuiltinProvider = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  api: string; // "anthropic-messages" | "openai-completions" | "openai-codex-responses" | "google-genai"
  authChoice: string;
  authMethod: "api-key" | "oauth" | "local" | "aws-sdk"; // 认证方式
  envVar?: string; // 环境变量名
  models: BuiltinModel[];
};

export type BuiltinModel = {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  input?: string[];
};

// ============================================================================
// Provider: Anthropic
// ============================================================================
const ANTHROPIC_MODELS: BuiltinModel[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 1000000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", contextWindow: 1000000, maxTokens: 32000, reasoning: true, input: ["text", "image"] },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 1000000, maxTokens: 64000, reasoning: true, input: ["text", "image"] },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", contextWindow: 1000000, maxTokens: 64000, reasoning: true, input: ["text", "image"] },
  { id: "claude-haiku-3-5", name: "Claude Haiku 3.5", contextWindow: 200000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: OpenAI
// ============================================================================
const OPENAI_MODELS: BuiltinModel[] = [
  { id: "gpt-5.4", name: "GPT 5.4", contextWindow: 1050000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "gpt-5.4-pro", name: "GPT 5.4 Pro", contextWindow: 1050000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "gpt-5.3-codex", name: "GPT 5.3 Codex", contextWindow: 1050000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "gpt-5.3-codex-spark", name: "GPT 5.3 Codex Spark", contextWindow: 128000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "gpt-5.2", name: "GPT 5.2", contextWindow: 128000, maxTokens: 16384, reasoning: true, input: ["text", "image"] },
  { id: "gpt-5.2-pro", name: "GPT 5.2 Pro", contextWindow: 128000, maxTokens: 16384, reasoning: true, input: ["text", "image"] },
  { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxTokens: 16384, reasoning: false, input: ["text", "image"] },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxTokens: 16384, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: Google Gemini
// ============================================================================
const GEMINI_MODELS: BuiltinModel[] = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", contextWindow: 1000000, maxTokens: 32768, reasoning: true, input: ["text", "image"] },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", contextWindow: 198000, maxTokens: 32768, reasoning: true, input: ["text", "image"] },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", contextWindow: 256000, maxTokens: 65536, reasoning: true, input: ["text", "image"] },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", contextWindow: 128000, maxTokens: 65536, reasoning: true, input: ["text", "image"] },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1000000, maxTokens: 65536, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Mistral
// ============================================================================
const MISTRAL_MODELS: BuiltinModel[] = [
  { id: "mistral-large-latest", name: "Mistral Large", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "mistral-medium-latest", name: "Mistral Medium", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "mistral-small-latest", name: "Mistral Small", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "codestral-latest", name: "Codestral", contextWindow: 256000, maxTokens: 8192, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: xAI (Grok)
// ============================================================================
const XAI_MODELS: BuiltinModel[] = [
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast", contextWindow: 1000000, maxTokens: 30000, reasoning: true, input: ["text", "image"] },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1", contextWindow: 256000, maxTokens: 10000, reasoning: true, input: ["text"] },
  { id: "grok-2-latest", name: "Grok 2", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: OpenRouter
// ============================================================================
const OPENROUTER_MODELS: BuiltinModel[] = [
  { id: "auto", name: "OpenRouter Auto", contextWindow: 200000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
  { id: "openrouter/hunter-alpha", name: "Hunter Alpha", contextWindow: 1048576, maxTokens: 65536, reasoning: true, input: ["text"] },
  { id: "openrouter/healer-alpha", name: "Healer Alpha", contextWindow: 262144, maxTokens: 65536, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Kilo Gateway
// ============================================================================
const KILOCODE_MODELS: BuiltinModel[] = [
  { id: "kilo-auto", name: "Kilo Auto", contextWindow: 1000000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Vercel AI Gateway
// ============================================================================
const VERCEL_AI_GATEWAY_MODELS: BuiltinModel[] = [
  { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6", contextWindow: 1000000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "openai/gpt-5.4", name: "GPT 5.4", contextWindow: 200000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "openai/gpt-5.4-pro", name: "GPT 5.4 Pro", contextWindow: 200000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Hugging Face
// ============================================================================
const HUGGINGFACE_MODELS: BuiltinModel[] = [
  { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", contextWindow: 131072, maxTokens: 8192, reasoning: true, input: ["text"] },
  { id: "deepseek-ai/DeepSeek-V3.1", name: "DeepSeek V3.1", contextWindow: 131072, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Instruct Turbo", contextWindow: 131072, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", contextWindow: 131072, maxTokens: 8192, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: Venice AI
// ============================================================================
const VENICE_MODELS: BuiltinModel[] = [
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", contextWindow: 128000, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "qwen3-235b-a22b-thinking-2507", name: "Qwen3 235B Thinking", contextWindow: 128000, maxTokens: 16384, reasoning: true, input: ["text"] },
  { id: "qwen3-coder-480b-a35b-instruct", name: "Qwen3 Coder 480B", contextWindow: 256000, maxTokens: 65536, reasoning: false, input: ["text"] },
  { id: "deepseek-v3.2", name: "DeepSeek V3.2", contextWindow: 160000, maxTokens: 32768, reasoning: true, input: ["text"] },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6 (via Venice)", contextWindow: 1000000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (via Venice)", contextWindow: 1000000, maxTokens: 64000, reasoning: true, input: ["text", "image"] },
  { id: "openai-gpt-54", name: "GPT-5.4 (via Venice)", contextWindow: 1000000, maxTokens: 131072, reasoning: true, input: ["text", "image"] },
  { id: "gemini-3-1-pro-preview", name: "Gemini 3.1 Pro (via Venice)", contextWindow: 1000000, maxTokens: 32768, reasoning: true, input: ["text", "image"] },
  { id: "kimi-k2-5", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 65536, reasoning: true, input: ["text", "image"] },
  { id: "zai-org-glm-5", name: "GLM 5", contextWindow: 198000, maxTokens: 32000, reasoning: true, input: ["text"] },
  { id: "minimax-m25", name: "MiniMax M2.5", contextWindow: 198000, maxTokens: 32768, reasoning: true, input: ["text"] },
];

// ============================================================================
// Provider: Together AI
// ============================================================================
const TOGETHER_MODELS: BuiltinModel[] = [
  { id: "zai-org/GLM-4.7", name: "GLM 4.7 Fp8", contextWindow: 202752, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", contextWindow: 262144, maxTokens: 32768, reasoning: true, input: ["text", "image"] },
  { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Instruct Turbo", contextWindow: 131072, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "meta-llama/Llama-4-Scout-17B-16E-Instruct", name: "Llama 4 Scout 17B 16E Instruct", contextWindow: 10000000, maxTokens: 32768, reasoning: false, input: ["text", "image"] },
  { id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama 4 Maverick 17B 128E Instruct FP8", contextWindow: 20000000, maxTokens: 32768, reasoning: false, input: ["text", "image"] },
  { id: "deepseek-ai/DeepSeek-V3.1", name: "DeepSeek V3.1", contextWindow: 131072, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", contextWindow: 131072, maxTokens: 8192, reasoning: true, input: ["text"] },
];

// ============================================================================
// Provider: Synthetic
// ============================================================================
const SYNTHETIC_MODELS: BuiltinModel[] = [
  { id: "hf:MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 192000, maxTokens: 65536, reasoning: false, input: ["text"] },
  { id: "hf:moonshotai/Kimi-K2-Thinking", name: "Kimi K2 Thinking", contextWindow: 256000, maxTokens: 8192, reasoning: true, input: ["text"] },
  { id: "hf:zai-org/GLM-4.7", name: "GLM-4.7", contextWindow: 198000, maxTokens: 128000, reasoning: false, input: ["text"] },
  { id: "hf:zai-org/GLM-5", name: "GLM-5", contextWindow: 256000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "hf:deepseek-ai/DeepSeek-R1-0528", name: "DeepSeek R1 0528", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:deepseek-ai/DeepSeek-V3.1", name: "DeepSeek V3.1", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:deepseek-ai/DeepSeek-V3.2", name: "DeepSeek V3.2", contextWindow: 159000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama 4 Maverick 17B 128E Instruct FP8", contextWindow: 524000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen3 Coder 480B A35B Instruct", contextWindow: 256000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "hf:Qwen/Qwen3-VL-235B-A22B-Instruct", name: "Qwen3 VL 235B A22B Instruct", contextWindow: 250000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
  { id: "hf:moonshotai/Kimi-K2.5", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 8192, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Doubao (Volcano Engine)
// ============================================================================
const DOUBAO_MODELS: BuiltinModel[] = [
  { id: "doubao-seed-code-preview-251028", name: "Doubao Seed Code Preview", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "doubao-seed-1-8-251228", name: "Doubao Seed 1.8", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "kimi-k2-5-260127", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "glm-4-7-251222", name: "GLM 4.7", contextWindow: 200000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "deepseek-v3-2-251201", name: "DeepSeek V3.2", contextWindow: 128000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: Doubao Coding Plan
// ============================================================================
const DOUBAO_CODING_MODELS: BuiltinModel[] = [
  { id: "ark-code-latest", name: "Ark Coding Plan", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "doubao-seed-code", name: "Doubao Seed Code", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "glm-4.7", name: "GLM 4.7 Coding", contextWindow: 200000, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "kimi-k2.5", name: "Kimi K2.5 Coding", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: BytePlus
// ============================================================================
const BYTEPLUS_MODELS: BuiltinModel[] = [
  { id: "seed-1-8-251228", name: "Seed 1.8", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "kimi-k2-5-260127", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
  { id: "glm-4-7-251222", name: "GLM 4.7", contextWindow: 200000, maxTokens: 4096, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: MiniMax
// ============================================================================
const MINIMAX_MODELS: BuiltinModel[] = [
  { id: "MiniMax-VL-01", name: "MiniMax VL 01", contextWindow: 200000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 200000, maxTokens: 8192, reasoning: true, input: ["text"] },
  { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", contextWindow: 200000, maxTokens: 8192, reasoning: true, input: ["text"] },
];

// ============================================================================
// Provider: Moonshot (Kimi)
// ============================================================================
const MOONSHOT_MODELS: BuiltinModel[] = [
  { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 256000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: Kimi Coding
// ============================================================================
const KIMI_CODING_MODELS: BuiltinModel[] = [
  { id: "k2p5", name: "Kimi for Coding", contextWindow: 262144, maxTokens: 32768, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Qwen Portal
// ============================================================================
const QWEN_PORTAL_MODELS: BuiltinModel[] = [
  { id: "coder-model", name: "Qwen Coder", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text"] },
  { id: "vision-model", name: "Qwen Vision", contextWindow: 128000, maxTokens: 8192, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: Xiaomi
// ============================================================================
const XIAOMI_MODELS: BuiltinModel[] = [
  { id: "mimo-v2-flash", name: "Xiaomi MiMo V2 Flash", contextWindow: 262144, maxTokens: 8192, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: Qianfan (Baidu)
// ============================================================================
const QIANFAN_MODELS: BuiltinModel[] = [
  { id: "deepseek-v3.2", name: "DEEPSEEK V3.2", contextWindow: 98304, maxTokens: 32768, reasoning: true, input: ["text"] },
  { id: "ernie-5.0-thinking-preview", name: "ERNIE-5.0-Thinking-Preview", contextWindow: 119000, maxTokens: 64000, reasoning: true, input: ["text", "image"] },
];

// ============================================================================
// Provider: Alibaba Cloud Model Studio
// ============================================================================
const MODELSTUDIO_MODELS: BuiltinModel[] = [
  { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", contextWindow: 1000000, maxTokens: 65536, reasoning: false, input: ["text", "image"] },
  { id: "qwen3-max-2026-01-23", name: "Qwen 3 Max", contextWindow: 262144, maxTokens: 65536, reasoning: false, input: ["text"] },
  { id: "qwen3-coder-next", name: "Qwen 3 Coder Next", contextWindow: 262144, maxTokens: 65536, reasoning: false, input: ["text"] },
  { id: "qwen3-coder-plus", name: "Qwen 3 Coder Plus", contextWindow: 1000000, maxTokens: 65536, reasoning: false, input: ["text"] },
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", contextWindow: 1000000, maxTokens: 65536, reasoning: true, input: ["text"] },
  { id: "glm-5", name: "GLM 5", contextWindow: 202752, maxTokens: 16384, reasoning: false, input: ["text"] },
  { id: "glm-4.7", name: "GLM 4.7", contextWindow: 202752, maxTokens: 16384, reasoning: false, input: ["text"] },
  { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 262144, maxTokens: 32768, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: NVIDIA
// ============================================================================
const NVIDIA_MODELS: BuiltinModel[] = [
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "NVIDIA Llama 3.1 Nemotron 70B Instruct", contextWindow: 131072, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "meta/llama-3.3-70b-instruct", name: "Meta Llama 3.3 70B Instruct", contextWindow: 131072, maxTokens: 4096, reasoning: false, input: ["text"] },
  { id: "nvidia/mistral-nemo-minitron-8b-8k-instruct", name: "NVIDIA Mistral NeMo Minitron 8B Instruct", contextWindow: 8192, maxTokens: 2048, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: Ollama (local)
// ============================================================================
const OLLAMA_MODELS: BuiltinModel[] = [
  // Ollama discovers models dynamically from local server
  // These are common models, but the actual list depends on local installation
];

// ============================================================================
// Provider: OpenAI Codex (OAuth)
// ============================================================================
const OPENAI_CODEX_MODELS: BuiltinModel[] = [
  // OpenAI Codex OAuth uses dynamic model discovery
  // Models are fetched from ChatGPT backend
];

// ============================================================================
// Provider: GitHub Copilot
// ============================================================================
const GITHUB_COPILOT_MODELS: BuiltinModel[] = [
  // GitHub Copilot uses dynamic model discovery
];

// ============================================================================
// Provider: LiteLLM
// ============================================================================
const LITELLM_MODELS: BuiltinModel[] = [
  // LiteLLM is a unified gateway for 100+ providers
  // Models are discovered dynamically
];

// ============================================================================
// Provider: Cloudflare AI Gateway
// ============================================================================
const CLOUDFLARE_AI_GATEWAY_MODELS: BuiltinModel[] = [
  // Cloudflare AI Gateway uses dynamic discovery
  // Default model: claude-sonnet-4-5
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", contextWindow: 200000, maxTokens: 64000, reasoning: false, input: ["text", "image"] },
];

// ============================================================================
// Provider: Z.AI
// ============================================================================
const ZAI_MODELS: BuiltinModel[] = [
  // Z.AI (GLM) provides various models
  // Models discovered dynamically from api.z.ai
  { id: "glm-5", name: "GLM 5", contextWindow: 256000, maxTokens: 128000, reasoning: true, input: ["text", "image"] },
  { id: "glm-4.7", name: "GLM 4.7", contextWindow: 198000, maxTokens: 128000, reasoning: false, input: ["text"] },
];

// ============================================================================
// Provider: OpenCode Zen
// ============================================================================
const OPENCODE_ZEN_MODELS: BuiltinModel[] = [
  // OpenCode Zen catalog - models discovered dynamically
];

// ============================================================================
// Provider: OpenCode Go
// ============================================================================
const OPENCODE_GO_MODELS: BuiltinModel[] = [
  // OpenCode Go catalog - models discovered dynamically
];

// ============================================================================
// All Built-in Providers
// ============================================================================
export const BUILT_IN_PROVIDERS: BuiltinProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Anthropic API key",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic-messages",
    authMethod: "oauth",
    authChoice: "apiKey",
    models: ANTHROPIC_MODELS,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI API key",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "openai-api-key",
    models: OPENAI_MODELS,
  },
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    description: "OpenAI Codex (ChatGPT OAuth)",
    baseUrl: "https://chatgpt.com/backend-api",
    api: "openai-codex-responses",
    authMethod: "api-key",
    authChoice: "openai-codex",
    models: OPENAI_CODEX_MODELS,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini API key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google-genai",
    authMethod: "api-key",
    authChoice: "gemini-api-key",
    models: GEMINI_MODELS,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Mistral API key",
    baseUrl: "https://api.mistral.ai/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "mistral-api-key",
    models: MISTRAL_MODELS,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "xAI API key",
    baseUrl: "https://api.x.ai/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "xai-api-key",
    models: XAI_MODELS,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "OpenRouter API key",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "openrouter-api-key",
    models: OPENROUTER_MODELS,
  },
  {
    id: "kilocode",
    name: "Kilo Gateway",
    description: "Kilo Gateway API key",
    baseUrl: "https://api.kilo.ai/api/gateway/",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "kilocode-api-key",
    models: KILOCODE_MODELS,
  },
  {
    id: "vercel-ai-gateway",
    name: "Vercel AI Gateway",
    description: "Vercel AI Gateway API key",
    baseUrl: "https://ai-gateway.vercel.sh",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "ai-gateway-api-key",
    models: VERCEL_AI_GATEWAY_MODELS,
  },
  {
    id: "cloudflare-ai-gateway",
    name: "Cloudflare AI Gateway",
    description: "Cloudflare AI Gateway API key",
    baseUrl: "", // Requires account ID + gateway ID
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "cloudflare-ai-gateway-api-key",
    models: CLOUDFLARE_AI_GATEWAY_MODELS,
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    description: "Hugging Face API key (HF token)",
    baseUrl: "https://router.huggingface.co/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "huggingface-api-key",
    models: HUGGINGFACE_MODELS,
  },
  {
    id: "venice",
    name: "Venice AI",
    description: "Venice API key",
    baseUrl: "https://api.venice.ai/api/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "venice-api-key",
    models: VENICE_MODELS,
  },
  {
    id: "together",
    name: "Together AI",
    description: "Together AI API key",
    baseUrl: "https://api.together.xyz/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "together-api-key",
    models: TOGETHER_MODELS,
  },
  {
    id: "synthetic",
    name: "Synthetic",
    description: "Synthetic API key",
    baseUrl: "https://api.synthetic.new/anthropic",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "synthetic-api-key",
    models: SYNTHETIC_MODELS,
  },
  {
    id: "doubao",
    name: "Doubao (Volcano Engine)",
    description: "Volcano Engine API key",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "volcengine-api-key",
    models: DOUBAO_MODELS,
  },
  {
    id: "doubao-coding",
    name: "Doubao Coding Plan",
    description: "Volcano Engine Coding Plan",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "volcengine-api-key",
    models: DOUBAO_CODING_MODELS,
  },
  {
    id: "byteplus",
    name: "BytePlus",
    description: "BytePlus API key",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "byteplus-api-key",
    models: BYTEPLUS_MODELS,
  },
  {
    id: "byteplus-coding",
    name: "BytePlus Coding Plan",
    description: "BytePlus Coding Plan API key",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "byteplus-api-key",
    models: DOUBAO_CODING_MODELS, // Same as doubao-coding
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax API key",
    baseUrl: "https://api.minimax.io/anthropic",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "minimax-global-api",
    models: MINIMAX_MODELS,
  },
  {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    description: "Moonshot API key",
    baseUrl: "https://api.moonshot.ai/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "moonshot-api-key",
    models: MOONSHOT_MODELS,
  },
  {
    id: "kimi-coding",
    name: "Kimi Coding",
    description: "Kimi Coding API key",
    baseUrl: "https://api.kimi.com/coding/",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "kimi-code-api-key",
    models: KIMI_CODING_MODELS,
  },
  {
    id: "qwen-portal",
    name: "Qwen Portal",
    description: "Qwen OAuth",
    baseUrl: "https://portal.qwen.ai/v1",
    api: "openai-completions",
    authMethod: "oauth",
    authChoice: "qwen-portal",
    models: QWEN_PORTAL_MODELS,
  },
  {
    id: "xiaomi",
    name: "Xiaomi",
    description: "Xiaomi API key",
    baseUrl: "https://api.xiaomimimo.com/anthropic",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "xiaomi-api-key",
    models: XIAOMI_MODELS,
  },
  {
    id: "qianfan",
    name: "Qianfan (Baidu)",
    description: "QIANFAN API key",
    baseUrl: "https://qianfan.baidubce.com/v2",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "qianfan-api-key",
    models: QIANFAN_MODELS,
  },
  {
    id: "modelstudio",
    name: "Alibaba Cloud Model Studio",
    description: "Alibaba Cloud Model Studio Coding Plan API key (Global)",
    baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "modelstudio-api-key",
    models: MODELSTUDIO_MODELS,
  },
  {
    id: "modelstudio-cn",
    name: "Alibaba Cloud Model Studio (CN)",
    description: "Alibaba Cloud Model Studio Coding Plan API key (China)",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "modelstudio-api-key-cn",
    models: MODELSTUDIO_MODELS,
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    description: "NVIDIA API key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "nvidia-api-key",
    models: NVIDIA_MODELS,
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Ollama local server",
    baseUrl: "http://127.0.0.1:11434",
    api: "ollama",
    authMethod: "local",
    authChoice: "ollama",
    models: OLLAMA_MODELS,
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    description: "GitHub Copilot (GitHub device login)",
    baseUrl: "", // Dynamic
    api: "openai-completions",
    authMethod: "oauth",
    authChoice: "github-copilot",
    models: GITHUB_COPILOT_MODELS,
  },
  {
    id: "litellm",
    name: "LiteLLM",
    description: "LiteLLM API key",
    baseUrl: "", // Configurable
    api: "openai-completions",
    authMethod: "api-key",
    authChoice: "litellm-api-key",
    models: LITELLM_MODELS,
  },
  {
    id: "zai",
    name: "Z.AI",
    description: "Z.AI API key",
    baseUrl: "https://api.z.ai/anthropic",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "zai-api-key",
    models: ZAI_MODELS,
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    description: "OpenCode Zen catalog",
    baseUrl: "https://api.opencode.ai/zen",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "opencode-zen",
    models: OPENCODE_ZEN_MODELS,
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    description: "OpenCode Go catalog",
    baseUrl: "https://api.opencode.ai/go",
    api: "anthropic-messages",
    authMethod: "api-key",
    authChoice: "opencode-go",
    models: OPENCODE_GO_MODELS,
  },
];

/**
 * Get a provider by ID
 */
export function getProviderById(id: string): BuiltinProvider | undefined {
  return BUILT_IN_PROVIDERS.find((p) => p.id === id);
}

/**
 * Get a provider by authChoice
 */
export function getProviderByAuthChoice(authChoice: string): BuiltinProvider | undefined {
  return BUILT_IN_PROVIDERS.find((p) => p.authChoice === authChoice);
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): string[] {
  return BUILT_IN_PROVIDERS.map((p) => p.id);
}

/**
 * Get all auth choices
 */
export function getAuthChoices(): string[] {
  return BUILT_IN_PROVIDERS.map((p) => p.authChoice);
}
