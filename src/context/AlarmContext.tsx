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
  AlarmItem,
  AlarmOccurrence,
  AlarmSession,
  MissionAlarm,
} from '../types/alarm';
import {
  loadStoredAlarms,
  saveStoredAlarms,
  loadMasterPowerState,
  saveMasterPowerState,
  getNextUpcomingAlarm,
  validateAndSanitizeAlarm,
  generateAlarmId,
  handleAlarmFired,
  parseTimeString,
  sanitizeRepeatDays,
} from '../utils/alarmEngine';
import {
  defaultAlarmCoordinator,
} from '../utils/alarmExecutionCoordinator';

interface AlarmContextType {
  alarms: AlarmItem[];
  isMasterOn: boolean;
  nextActiveAlarm: { alarm: AlarmItem; nextDate: Date; occurrence?: AlarmOccurrence } | null;
  activeSession: AlarmSession | null;
  toggleMaster: () => void;
  toggleAlarm: (id: string) => void;
  addAlarm: (alarmData: {
    time: string;
    label?: string;
    repeatDays?: number[];
    enabled?: boolean;
  }) => AlarmItem;
  updateAlarm: (alarm: AlarmItem) => boolean;
  deleteAlarm: (id: string) => void;
  fireAlarm: (id: string) => void;
  snoozeAlarm: (minutes?: number) => AlarmSession | null;
  stopAlarm: () => AlarmSession | null;
  getEnabledAlarms: () => AlarmItem[];
}

const AlarmContext = createContext<AlarmContextType | null>(null);

export const AlarmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Alarms state initialized safely from versioned storage
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => loadStoredAlarms());

  // 2. Master switch state
  const [isMasterOn, setIsMasterOn] = useState<boolean>(() => {
    const initialAlarms = loadStoredAlarms();
    return loadMasterPowerState(initialAlarms);
  });

  // 3. Active trigger session state
  const [activeSession, setActiveSession] = useState<AlarmSession | null>(() =>
    defaultAlarmCoordinator.getActiveSession()
  );

  // Sync alarms to versioned storage whenever changed
  useEffect(() => {
    saveStoredAlarms(alarms);
  }, [alarms]);

  // Sync master toggle to storage whenever changed
  useEffect(() => {
    saveMasterPowerState(isMasterOn);
  }, [isMasterOn]);

  // Wire coordinator subscriptions and execution polling
  useEffect(() => {
    const unsubscribe = defaultAlarmCoordinator.subscribe((session) => {
      setActiveSession(session);
      // If a session stopped or triggered, re-sync alarms to capture one-time disarms
      setAlarms(loadStoredAlarms());
    });

    defaultAlarmCoordinator.start(1000);

    return () => {
      unsubscribe();
      defaultAlarmCoordinator.stopCoordinator();
    };
  }, []);

  // Compute next active upcoming alarm based on local wall clock
  const nextActiveAlarm = useMemo(() => {
    if (!isMasterOn) return null;
    const occurrence = getNextUpcomingAlarm(alarms);
    if (!occurrence) return null;
    return {
      alarm: occurrence.alarm,
      nextDate: occurrence.nextDate,
      occurrence,
    };
  }, [alarms, isMasterOn]);

  // Master power toggle with illumination rule enforcement
  const toggleMaster = useCallback(() => {
    setIsMasterOn((prev) => {
      const next = !prev;
      if (next) {
        // If turning ON but no alarms are armed, automatically arm the first alarm
        const hasAnyEnabled = alarms.some((a) => a.enabled);
        if (!hasAnyEnabled && alarms.length > 0) {
          setAlarms((curr) =>
            curr.map((a, i) =>
              i === 0
                ? {
                    ...a,
                    enabled: true,
                    updatedAt: new Date().toISOString(),
                  }
                : a
            )
          );
        }
      }
      return next;
    });
  }, [alarms]);

  // Toggle individual alarm arming status
  const toggleAlarm = useCallback(
    (id: string) => {
      setAlarms((curr) => {
        const nowIso = new Date().toISOString();
        const updated = curr.map((a) =>
          a.id === id
            ? {
                ...a,
                enabled: !a.enabled,
                updatedAt: nowIso,
              }
            : a
        );

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

  // Add a new alarm
  const addAlarm = useCallback(
    (data: {
      time: string;
      label?: string;
      repeatDays?: number[];
      enabled?: boolean;
    }): AlarmItem => {
      const { hour, minute } = parseTimeString(data.time);
      const nowIso = new Date().toISOString();
      const newAlarm: AlarmItem = {
        id: generateAlarmId(),
        time: data.time,
        hour,
        minute,
        label: data.label?.trim() || 'Alarm',
        repeatDays: sanitizeRepeatDays(data.repeatDays),
        enabled: data.enabled ?? true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastTriggeredAt: null,
      };

      setAlarms((curr) => [...curr, newAlarm]);
      setIsMasterOn(true);
      return newAlarm;
    },
    []
  );

  // Update existing alarm
  const updateAlarm = useCallback((updated: AlarmItem): boolean => {
    const sanitized = validateAndSanitizeAlarm({
      ...updated,
      updatedAt: new Date().toISOString(),
    });

    if (!sanitized) return false;

    setAlarms((curr) => {
      const next = curr.map((a) => (a.id === sanitized.id ? sanitized : a));
      if (sanitized.enabled) {
        setIsMasterOn(true);
      } else if (!next.some((a) => a.enabled)) {
        setIsMasterOn(false);
      }
      return next;
    });

    return true;
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

  // Fire an alarm (decoupled native interface)
  const fireAlarm = useCallback((id: string) => {
    setAlarms((curr) => {
      const result = handleAlarmFired(id, curr);
      if (result.disarmedOneTime && !result.remainingAlarms.some((a) => a.enabled)) {
        setIsMasterOn(false);
      }
      return result.remainingAlarms;
    });
  }, []);

  // Snooze active alarm session
  const snoozeAlarm = useCallback((minutes?: number): AlarmSession | null => {
    return defaultAlarmCoordinator.snooze(minutes);
  }, []);

  // Stop active alarm session
  const stopAlarm = useCallback((): AlarmSession | null => {
    const result = defaultAlarmCoordinator.stop();
    setAlarms(loadStoredAlarms());
    return result;
  }, []);

  // Query enabled alarms
  const getEnabledAlarms = useCallback(() => {
    return alarms.filter((a) => a.enabled);
  }, [alarms]);

  const value = useMemo(
    () => ({
      alarms,
      isMasterOn,
      nextActiveAlarm,
      activeSession,
      toggleMaster,
      toggleAlarm,
      addAlarm,
      updateAlarm,
      deleteAlarm,
      fireAlarm,
      snoozeAlarm,
      stopAlarm,
      getEnabledAlarms,
    }),
    [
      alarms,
      isMasterOn,
      nextActiveAlarm,
      activeSession,
      toggleMaster,
      toggleAlarm,
      addAlarm,
      updateAlarm,
      deleteAlarm,
      fireAlarm,
      snoozeAlarm,
      stopAlarm,
      getEnabledAlarms,
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
