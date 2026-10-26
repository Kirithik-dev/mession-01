import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  MissionAlarm,
  DEFAULT_ALARMS,
  findNextActiveAlarm,
} from '../utils/alarmTime';

const ALARMS_STORAGE_KEY = 'mission_alarms_v2';
const MASTER_POWER_STORAGE_KEY = 'mission_master_alarm_on';

interface AlarmContextType {
  alarms: MissionAlarm[];
  isMasterOn: boolean;
  nextActiveAlarm: { alarm: MissionAlarm; nextDate: Date } | null;
  toggleMaster: () => void;
  toggleAlarm: (id: string) => void;
  addAlarm: (alarmData: Omit<MissionAlarm, 'id'>) => void;
  updateAlarm: (alarm: MissionAlarm) => void;
  deleteAlarm: (id: string) => void;
}

const AlarmContext = createContext<AlarmContextType | null>(null);

export const AlarmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Alarms state
  const [alarms, setAlarms] = useState<MissionAlarm[]>(() => {
    try {
      const saved = localStorage.getItem(ALARMS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ALARMS;
  });

  // 2. Master toggle state
  const [isMasterOn, setIsMasterOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(MASTER_POWER_STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ALARMS.some((a) => a.enabled);
  });

  // Sync alarms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(alarms));
    } catch {
      // Storage unavailable
    }
  }, [alarms]);

  // Sync master toggle to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(MASTER_POWER_STORAGE_KEY, JSON.stringify(isMasterOn));
    } catch {
      // Storage unavailable
    }
  }, [isMasterOn]);

  // Compute next active upcoming alarm
  const nextActiveAlarm = useMemo(() => {
    if (!isMasterOn) return null;
    return findNextActiveAlarm(alarms);
  }, [alarms, isMasterOn]);

  // Toggle master power
  const toggleMaster = useCallback(() => {
    setIsMasterOn((prev) => {
      const next = !prev;
      if (next && !alarms.some((a) => a.enabled) && alarms.length > 0) {
        setAlarms((curr) => curr.map((a, i) => (i === 0 ? { ...a, enabled: true } : a)));
      }
      return next;
    });
  }, [alarms]);

  // Toggle individual alarm
  const toggleAlarm = useCallback(
    (id: string) => {
      setAlarms((curr) => {
        const updated = curr.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
        const hasAnyActive = updated.some((a) => a.enabled);
        if (!isMasterOn && hasAnyActive) {
          setIsMasterOn(true);
        } else if (!hasAnyActive) {
          setIsMasterOn(false);
        }
        return updated;
      });
    },
    [isMasterOn]
  );

  // Add alarm
  const addAlarm = useCallback((data: Omit<MissionAlarm, 'id'>) => {
    const newAlarm: MissionAlarm = {
      ...data,
      id: `alarm-${Date.now()}`,
      enabled: true,
    };
    setAlarms((curr) => [...curr, newAlarm]);
    setIsMasterOn(true);
  }, []);

  // Update alarm
  const updateAlarm = useCallback((updated: MissionAlarm) => {
    setAlarms((curr) => {
      const next = curr.map((a) => (a.id === updated.id ? updated : a));
      if (updated.enabled) {
        setIsMasterOn(true);
      } else if (!next.some((a) => a.enabled)) {
        setIsMasterOn(false);
      }
      return next;
    });
  }, []);

  // Delete alarm
  const deleteAlarm = useCallback((id: string) => {
    setAlarms((curr) => {
      const remaining = curr.filter((a) => a.id !== id);
      if (!remaining.some((a) => a.enabled)) {
        setIsMasterOn(false);
      }
      return remaining;
    });
  }, []);

  const value = useMemo(
    () => ({
      alarms,
      isMasterOn,
      nextActiveAlarm,
      toggleMaster,
      toggleAlarm,
      addAlarm,
      updateAlarm,
      deleteAlarm,
    }),
    [
      alarms,
      isMasterOn,
      nextActiveAlarm,
      toggleMaster,
      toggleAlarm,
      addAlarm,
      updateAlarm,
      deleteAlarm,
    ]
  );

  return <AlarmContext.Provider value={value}>{children}</AlarmContext.Provider>;
};

export const useAlarmContext = (): AlarmContextType => {
  const context = useContext(AlarmContext);
  if (!context) {
    throw new Error('useAlarmContext must be used within an AlarmProvider');
  }
  return context;
};
