import type { ScenarioParams } from '@/types/domain';

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  params: Partial<ScenarioParams>;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'fest',
    name: 'Fest weekend',
    description: 'Crowd surge, canteen waste up, parking overload, energy up at the auditorium.',
    icon: 'PartyPopper',
    params: {
      crowdMultiplier: 1.8,
      occupancyMultiplier: 1.5,
      wasteMultiplier: 1.9,
      energyMultiplier: 1.45,
      waterMultiplier: 1.4,
      parkingMultiplier: 1.7,
      congestionMultiplier: 1.5,
      eventDurationHrs: 10,
      truckAvailability: 0.7,
    },
  },
  {
    id: 'exam',
    name: 'Exam day',
    description: 'High academic block and library occupancy, low sports.',
    icon: 'BookOpen',
    params: {
      crowdMultiplier: 1.1,
      occupancyMultiplier: 1.35,
      wasteMultiplier: 1.1,
      energyMultiplier: 1.1,
      waterMultiplier: 1.0,
      parkingMultiplier: 0.8,
      congestionMultiplier: 0.9,
      eventDurationHrs: 6,
    },
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    description: 'Cooling energy up, water use up, outdoor activity down.',
    icon: 'ThermometerSun',
    params: {
      temperatureC: 41,
      energyMultiplier: 1.6,
      waterMultiplier: 1.5,
      occupancyMultiplier: 0.9,
      crowdMultiplier: 0.8,
      eventDurationHrs: 12,
    },
  },
  {
    id: 'badair',
    name: 'Bad air day',
    description: 'Diwali / crop-burning-style PM2.5 spike, hostel advisories.',
    icon: 'Wind',
    params: {
      pm25Multiplier: 3.2,
      crowdMultiplier: 0.9,
      eventDurationHrs: 10,
    },
  },
  {
    id: 'monsoon',
    name: 'Monsoon waterlogging',
    description: 'Road and parking impact, waste collection delays.',
    icon: 'CloudRain',
    params: {
      rainMm: 28,
      congestionMultiplier: 1.6,
      parkingMultiplier: 0.7,
      truckAvailability: 0.5,
      wasteMultiplier: 1.2,
      eventDurationHrs: 8,
    },
  },
];
