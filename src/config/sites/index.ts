import type { SiteConfig } from '@/types/domain';
import { campusSite } from './campus';

export const SITES: SiteConfig[] = [campusSite];

export function getSite(id: string): SiteConfig {
  return SITES.find((s) => s.id === id) ?? SITES[0];
}
