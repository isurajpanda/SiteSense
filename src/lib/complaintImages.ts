import type { ReportCategory } from '@/types/domain';

const ACCENT: Record<ReportCategory, string> = {
  waste: '#A78BFA',
  water: '#38BDF8',
  light: '#FBBF24',
  air: '#00E5C3',
  safety: '#FF4D5E',
  road: '#FBBF24',
  parking: '#F472B6',
  other: '#94A3B8',
};

function art(category: ReportCategory, a: string): string {
  switch (category) {
    case 'waste':
      return `<circle cx="150" cy="62" r="7" fill="#2a2f36"/><circle cx="169" cy="60" r="9" fill="#2a2f36"/><path d="M138 78 h44 l-7 66 h-30 z" fill="#161b21" stroke="${a}" stroke-width="4"/><rect x="130" y="70" width="60" height="8" rx="2" fill="${a}"/><path d="M150 42 q-5 -8 0 -16 M170 42 q5 -8 0 -16" stroke="#5a6470" stroke-width="3" fill="none"/>`;
    case 'water':
      return `<path d="M160 56 c14 18 24 30 24 44 a24 24 0 1 1 -48 0 c0 -14 10 -26 24 -44 z" fill="none" stroke="${a}" stroke-width="5"/><ellipse cx="160" cy="150" rx="42" ry="8" fill="none" stroke="${a}" stroke-opacity="0.5" stroke-width="3"/><ellipse cx="160" cy="150" rx="24" ry="5" fill="none" stroke="${a}" stroke-opacity="0.85" stroke-width="3"/>`;
    case 'light':
      return `<polygon points="172,68 190,68 214,150 148,150" fill="${a}" opacity="0.16"/><line x1="120" y1="150" x2="120" y2="60" stroke="#39404a" stroke-width="6"/><line x1="120" y1="60" x2="182" y2="60" stroke="#39404a" stroke-width="6"/><rect x="172" y="55" width="18" height="11" rx="2" fill="${a}"/><circle cx="181" cy="72" r="4" fill="${a}"/>`;
    case 'air':
      return `<path d="M60 84 q20 -14 40 0 t40 0 t40 0 t40 0" fill="none" stroke="${a}" stroke-width="4" opacity="0.85"/><path d="M60 106 q20 -14 40 0 t40 0 t40 0 t40 0" fill="none" stroke="${a}" stroke-width="4" opacity="0.55"/><path d="M60 128 q20 -14 40 0 t40 0 t40 0 t40 0" fill="none" stroke="${a}" stroke-width="4" opacity="0.3"/>`;
    case 'safety':
      return `<path d="M160 60 L210 142 H110 Z" fill="none" stroke="${a}" stroke-width="5"/><line x1="160" y1="94" x2="160" y2="118" stroke="${a}" stroke-width="6"/><circle cx="160" cy="130" r="4" fill="${a}"/>`;
    case 'road':
      return `<polygon points="118,200 144,92 176,92 202,200" fill="#14171c" stroke="#2a2f36" stroke-width="2"/><line x1="160" y1="104" x2="160" y2="192" stroke="#8a8f96" stroke-width="3" stroke-dasharray="10 8"/><polyline points="150,118 158,131 151,144 162,157" fill="none" stroke="${a}" stroke-width="3"/>`;
    case 'parking':
      return `<rect x="128" y="52" width="64" height="64" rx="8" fill="#14171c" stroke="${a}" stroke-width="4"/><text x="160" y="100" text-anchor="middle" font-family="monospace" font-size="38" font-weight="bold" fill="${a}">P</text><rect x="118" y="128" width="84" height="18" rx="6" fill="#1c2127" stroke="#39404a" stroke-width="2"/><circle cx="136" cy="148" r="7" fill="#0a0a0a" stroke="#39404a" stroke-width="2"/><circle cx="184" cy="148" r="7" fill="#0a0a0a" stroke="#39404a" stroke-width="2"/>`;
    default:
      return `<circle cx="160" cy="104" r="34" fill="none" stroke="#39404a" stroke-width="6"/><path d="M160 104 L184 86" stroke="${a}" stroke-width="5"/><circle cx="160" cy="104" r="6" fill="${a}"/>`;
  }
}

const KEYWORDS: Record<ReportCategory, string> = {
  waste: 'garbage,trash',
  water: 'faucet,plumbing',
  light: 'streetlight',
  air: 'smog,factory',
  safety: 'construction,warning',
  road: 'pothole,road',
  parking: 'parking,car',
  other: 'maintenance,building',
};

function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function complaintPhotoUrl(category: ReportCategory, lockKey: string): string {
  const lock = 100 + (hashKey(`${category}:${lockKey}`) % 900);
  return `https://loremflickr.com/640/400/${KEYWORDS[category] ?? 'maintenance'}?lock=${lock}`;
}

export function picsumUrl(lockKey: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(`sitesense-${lockKey}`)}/640/400`;
}

export function complaintPhoto(category: ReportCategory, seed = 0): string {
  const a = ACCENT[category] ?? ACCENT.other;
  const shift = seed % 3 === 0 ? 0 : seed % 3 === 1 ? 8 : -8;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">` +
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10141a"/><stop offset="1" stop-color="#05070a"/></linearGradient>` +
    `<radialGradient id="vg" cx="0.5" cy="0.45" r="0.9"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>` +
    `<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern></defs>` +
    `<rect width="320" height="200" fill="url(#bg)"/><rect width="320" height="200" fill="url(#grid)"/>` +
    `<line x1="20" y1="152" x2="300" y2="152" stroke="#2a2f36" stroke-width="2"/>` +
    `<g transform="translate(${shift},0)">${art(category, a)}</g>` +
    `<rect width="320" height="200" fill="url(#vg)"/>` +
    `<rect y="172" width="320" height="28" fill="#000000" opacity="0.55"/>` +
    `<text x="12" y="190" font-family="monospace" font-size="11" letter-spacing="2" fill="#8a8a8a">${category.toUpperCase()} · FIELD PHOTO</text>` +
    `<circle cx="298" cy="186" r="5" fill="#FF4D5E"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
