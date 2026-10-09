import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Report, ReportCategory, ReportStatus } from '@/types/domain';

const CATEGORIES: ReportCategory[] = ['waste', 'water', 'light', 'air', 'safety', 'road', 'parking', 'other'];

function seedReports(): Report[] {
  const now = Date.now();
  const H = 3600000;
  const seeds: Array<[number, ReportCategory, string, string, ReportStatus, number]> = [
    [5, 'waste', 'canteen', 'Canteen bin 2 overflowing near the back door.', 'resolved', 3],
    [9, 'water', 'hostel-south', 'Water dripping from ceiling near room 204, floor is slippery.', 'in-progress', 1],
    [14, 'light', 'academic-a', 'Two tube lights flickering in room 305.', 'assigned', 0],
    [22, 'air', 'workshop', 'Strong smell of paint/thinner in the workshop after hours.', 'resolved', 2],
    [30, 'road', 'gate-main', 'Pothole widening on the main gate approach road.', 'received', 0],
    [41, 'parking', 'parking', 'Cars parked on the footpath near the parking exit.', 'received', 0],
    [55, 'safety', 'sports', 'Broken boundary wall near the cricket nets, sharp edges exposed.', 'assigned', 1],
    [70, 'waste', 'hostel-east', 'Dustbin not emptied since yesterday evening.', 'resolved', 4],
    [96, 'light', 'library', 'Reading hall lights dim on the second floor.', 'resolved', 1],
    [120, 'other', 'auditorium', 'AC not cooling in the left block during the seminar.', 'resolved', 2],
  ];
  return seeds.map(([hrsAgo, category, buildingId, note, status, upvotes], i) => ({
    id: `seed-${i}`,
    trackingId: `SSR-${(1000 + i * 7).toString(36).toUpperCase()}`,
    t: now - hrsAgo * H,
    category,
    buildingId,
    buildingName: buildingId,
    note,
    hasPhoto: i % 3 === 0,
    status,
    anonymous: true,
    upvotes,
  }));
}

interface ReportState {
  reports: Report[];
  submitReport: (r: Omit<Report, 'id' | 'trackingId' | 't' | 'status' | 'upvotes'>) => Report;
  updateStatus: (id: string, status: ReportStatus) => void;
  upvote: (id: string) => void;
  byId: (id: string) => Report | undefined;
}

let reportCounter = 0;

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: seedReports(),
      submitReport: (r) => {
        reportCounter += 1;
        const report: Report = {
          ...r,
          id: `r-${Date.now()}-${reportCounter}`,
          trackingId: `SSR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          t: Date.now(),
          status: 'received',
          upvotes: 0,
        };
        set((s) => ({ reports: [report, ...s.reports] }));
        return report;
      },
      updateStatus: (id, status) =>
        set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)) })),
      upvote: (id) =>
        set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r)) })),
      byId: (id) => get().reports.find((r) => r.id === id),
    }),
    { name: 'sitesense-reports' },
  ),
);

export { CATEGORIES };
