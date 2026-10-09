export const TICK_MS = 2000;
export const SIM_MINUTES_PER_TICK = 15;
export const HISTORY_DAYS = 7;
export const POINTS_PER_DAY = 96;
export const TOTAL_POINTS = HISTORY_DAYS * POINTS_PER_DAY;

export function simMinutesPerTick(speed: number): number {
  return SIM_MINUTES_PER_TICK * speed;
}

export function bucketIndex(t: number): number {
  return Math.floor(t / (SIM_MINUTES_PER_TICK * 60 * 1000));
}

export function formatSimTime(t: number): string {
  const d = new Date(t);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
}
