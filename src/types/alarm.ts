export interface AlarmItem {
  id: string;
  time: string; // "HH:MM" 24-hour format
  label: string;
  repeatDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  enabled: boolean;
  tone?: string;
}

export type ClockTool = 'alarms' | 'timer' | 'stopwatch';
