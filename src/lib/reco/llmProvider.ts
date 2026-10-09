/**
 * LLMProvider interface + implementations.
 * The recommendation engine is rules + forecasts + templates by design.
 * A real GenAI call can be plugged in via the OpenAI-compatible endpoint
 * below (streaming supported). No API key required for the local endpoint.
 */
export interface LLMProvider {
  name: string;
  generateInsight(prompt: string, context: Record<string, unknown>): Promise<string>;
  streamInsight?(
    prompt: string,
    context: Record<string, unknown>,
    onChunk: (text: string) => void,
  ): Promise<string>;
}

export interface LLMConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  endpoint: 'http://127.0.0.1:8083/v1/chat/completions',
  model: 'opencode/muse-spark-1.3-contributor-free',
};

export class StubLLMProvider implements LLMProvider {
  name = 'stub (rules + templates, no LLM)';

  async generateInsight(_prompt: string, _context: Record<string, unknown>): Promise<string> {
    return 'AI-assisted insight unavailable in demo mode. Showing rules-based output.';
  }
}

/**
 * OpenAI-compatible chat completions provider with SSE streaming.
 * Works with any endpoint implementing POST /v1/chat/completions
 * (vLLM, llama.cpp, Ollama-compatible gateways, etc.).
 */
export class OpenAICompatibleLLMProvider implements LLMProvider {
  name: string;
  private config: LLMConfig;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_LLM_CONFIG, ...config };
    this.name = `openai-compatible (${this.config.model})`;
  }

  private buildMessages(prompt: string, context: Record<string, unknown>): Array<{ role: string; content: string }> {
    const contextStr =
      Object.keys(context).length > 0
        ? `\n\nCurrent site state (JSON):\n${JSON.stringify(context, null, 2)}`
        : '';
    return [
      {
        role: 'system',
        content:
          'You are SiteSense, an AI assistant for facility and estate management. ' +
          'You provide concise, actionable decision-support insights based on simulated sensor data. ' +
          'Always state that data is simulated and insights are decision-support, not official measurements. ' +
          'Keep responses under 120 words. Use bullet points where helpful.',
      },
      { role: 'user', content: prompt + contextStr },
    ];
  }

  async generateInsight(prompt: string, context: Record<string, unknown>): Promise<string> {
    const res = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.buildMessages(prompt, context),
        stream: false,
        max_tokens: 300,
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM endpoint returned ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('LLM returned empty response');
    return text;
  }

  async streamInsight(
    prompt: string,
    context: Record<string, unknown>,
    onChunk: (text: string) => void,
  ): Promise<string> {
    const res = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.buildMessages(prompt, context),
        stream: true,
        max_tokens: 300,
        temperature: 0.4,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`LLM endpoint returned ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch {
          // partial JSON chunk — wait for more data
        }
      }
    }
    if (!full) throw new Error('LLM stream returned no content');
    return full;
  }
}

let activeProvider: LLMProvider = new StubLLMProvider();

export function getLLMProvider(): LLMProvider {
  return activeProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  activeProvider = provider;
}

export function enableRemoteLLM(config?: Partial<LLMConfig>): void {
  setLLMProvider(new OpenAICompatibleLLMProvider(config));
}
