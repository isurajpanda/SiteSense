/**
 * Plain-language template rendering. NOT an LLM — variable slots filled
 * from live state. A real GenAI call can be plugged in via LLMProvider.
 */
export interface TemplateSlots {
  buildingName: string;
  [key: string]: string | number | undefined | null;
}

export function renderTemplate(template: string, slots: TemplateSlots): string {
  let out = template;
  for (const [k, v] of Object.entries(slots)) {
    if (v === undefined || v === null) continue;
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function etaText(etaMinutes: number | null | undefined): string {
  if (etaMinutes === null || etaMinutes === undefined) return 'no overflow expected soon';
  if (etaMinutes <= 0) return 'overflowing now';
  if (etaMinutes < 60) return `about ${etaMinutes} min`;
  const hrs = Math.floor(etaMinutes / 60);
  const mins = etaMinutes % 60;
  return `about ${hrs} h ${mins > 0 ? `${mins} min` : ''}`.trim();
}
