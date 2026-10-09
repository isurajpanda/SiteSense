import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Bot, User } from 'lucide-react';
import { getLLMProvider } from '@/lib/reco/llmProvider';
import { buildLLMContext } from '@/lib/reco/llmContext';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSimStore } from '@/store/useSimStore';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const siteId = useSettingsStore((s) => s.siteId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Hello! I\'m SiteSense. I can see the full simulation state — alerts, KPIs, bins, energy, occupancy, recommendations. Ask me what\'s going on, or try "summarise the site", "what should we fix first?", "explain the hostel alert".',
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: q };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);
    abortRef.current = false;

    try {
      const provider = getLLMProvider();
      const context = buildLLMContext(siteId);
      const history = messages
        .filter((m) => !m.streaming)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const prompt = `Conversation so far:\n${history.map((h) => `${h.role}: ${h.content}`).join('\n')}\n\nCurrent question: ${q}\n\nGive a concise, actionable answer based on the live site state below.`;
      const streamFn = provider.streamInsight;
      if (streamFn) {
        await streamFn.call(provider, prompt, context, (chunk) => {
          if (abortRef.current) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        });
      } else {
        const text = await provider.generateInsight(prompt, context);
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: text } : m)));
      }
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                content: `Error: ${err instanceof Error ? err.message : 'LLM unreachable'}. Showing rules-based summary instead.\n\n${rulesSummary()}`,
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-3" role="dialog" aria-modal="true" aria-label="Chat with SiteSense">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex h-[70vh] w-full max-w-md flex-col rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]/97 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-data/40 bg-data/10">
            <Bot size={14} className="text-data" />
          </div>
          <div className="flex-1">
            <div className="font-hud text-xs font-bold uppercase tracking-wider text-[#fafafa]">
              Ask SiteSense
            </div>
            <div className="text-[10px] text-muted-foreground">
              {getLLMProvider().name} · live sim context · simulated data
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={15} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  m.role === 'assistant' ? 'border-data/40 bg-data/10' : 'border-primary/40 bg-primary/10',
                )}
              >
                {m.role === 'assistant' ? <Bot size={11} className="text-data" /> : <User size={11} className="text-primary" />}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg border px-3 py-2 text-xs leading-relaxed',
                  m.role === 'assistant'
                    ? 'border-border bg-[#0a0a0a] text-[#fafafa]'
                    : 'border-primary/30 bg-primary/10 text-[#fafafa]',
                )}
              >
                {m.content}
                {m.streaming && m.content === '' && <Loader2 size={12} className="inline animate-spin text-muted-foreground" />}
                {m.streaming && m.content !== '' && (
                  <span className="ml-1 inline-block h-3 w-1.5 animate-blink bg-data align-middle" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about the site…"
              aria-label="Chat message"
              className="h-9 flex-1 rounded-md border border-border bg-secondary px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-muted-foreground">
            Each message sends the full live sim state (KPIs, alerts, bins, recommendations) to the LLM. Rules + forecasts + templates remain the backbone.
          </p>
        </div>
      </div>
    </div>
  );
}

function rulesSummary(): string {
  const { kpis, alerts, congestion, recommendations } = useSimStore.getState();
  const open = recommendations.filter((r) => r.status === 'open');
  const lines = [
    `People on site: ${kpis.totalPeople}`,
    `Campus AQI (indicative): ${kpis.campusAqi}`,
    `Bins above 80%: ${kpis.binsAbove80}`,
    `Parking: ${kpis.parkingOccupancyPct}%`,
    `Energy: ${kpis.energyKw} kW`,
    `Congestion: ${Math.round(Object.values(congestion).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(congestion).length) * 100)}%`,
    `Active alerts: ${alerts.length}`,
    `Open recommendations: ${open.length}`,
  ];
  if (alerts.length > 0) lines.push(`Top alert: ${alerts[0].message}`);
  if (open.length > 0) lines.push(`Top recommendation: ${open[0].title}`);
  return lines.join('\n');
}
