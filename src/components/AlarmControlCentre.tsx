import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Clock,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Bell,
  BellOff,
  Edit3,
} from 'lucide-react';
import { AlarmItem, ClockTool } from '../types/alarm';

const STORAGE_KEY = 'mission_alarms_data';

const DEFAULT_ALARMS: AlarmItem[] = [
  {
    id: 'alarm-1',
    time: '06:30',
    label: 'Morning Ignition',
    repeatDays: [1, 2, 3, 4, 5], // Mon - Fri
    enabled: true,
    tone: 'Starlight Chime',
  },
  {
    id: 'alarm-2',
    time: '08:00',
    label: 'Mission Briefing',
    repeatDays: [0, 1, 2, 3, 4, 5, 6], // Daily
    enabled: true,
    tone: 'Orbital Pulse',
  },
  {
    id: 'alarm-3',
    time: '22:45',
    label: 'Wind Down & Sleep',
    repeatDays: [0, 1, 2, 3, 4], // Sun - Thu
    enabled: false,
    tone: 'Cosmic Drift',
  },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTimeDisplay(time24: string): { time: string; period: string } {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, '0');
  return {
    time: `${displayH}:${displayM}`,
    period,
  };
}

function formatRepeatDays(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [0, 6].every((d) => days.includes(d))) return 'Weekends';

  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d])
    .join(', ');
}

export const AlarmControlCentre: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ClockTool>('alarms');
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_ALARMS;
  });

  // Modal State for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [modalHour, setModalHour] = useState('07');
  const [modalMinute, setModalMinute] = useState('00');
  const [modalPeriod, setModalPeriod] = useState<'AM' | 'PM'>('AM');
  const [modalLabel, setModalLabel] = useState('');
  const [modalDays, setModalDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Timer tool state
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(300);
  const [timerInitialSeconds, setTimerInitialSeconds] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Stopwatch tool state
  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);

  // Persist alarms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    } catch {
      // Ignore
    }
  }, [alarms]);

  // Timer loop
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Stopwatch loop
  useEffect(() => {
    if (!isStopwatchRunning) return;
    let lastTime = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      setStopwatchMs((prev) => prev + delta);
    }, 33);
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  // Toggle alarm enabled
  const toggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  // Delete alarm
  const deleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  // Open modal for new alarm
  const handleOpenNewAlarm = () => {
    setEditingAlarmId(null);
    setModalHour('07');
    setModalMinute('00');
    setModalPeriod('AM');
    setModalLabel('Mission Wakeup');
    setModalDays([1, 2, 3, 4, 5]);
    setIsModalOpen(true);
  };

  // Open modal for editing existing alarm
  const handleOpenEditAlarm = (alarm: AlarmItem) => {
    setEditingAlarmId(alarm.id);
    const [h24Str, mStr] = alarm.time.split(':');
    const h24 = parseInt(h24Str, 10);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

    setModalHour(h12.toString().padStart(2, '0'));
    setModalMinute(mStr);
    setModalPeriod(period);
    setModalLabel(alarm.label);
    setModalDays(alarm.repeatDays);
    setIsModalOpen(true);
  };

  // Save modal alarm
  const handleSaveModalAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    let h12 = parseInt(modalHour, 10);
    if (isNaN(h12) || h12 < 1) h12 = 12;
    if (h12 > 12) h12 = 12;

    let h24 = h12;
    if (modalPeriod === 'PM' && h12 < 12) h24 = h12 + 12;
    if (modalPeriod === 'AM' && h12 === 12) h24 = 0;

    let min = parseInt(modalMinute, 10);
    if (isNaN(min) || min < 0) min = 0;
    if (min > 59) min = 59;

    const timeString = `${h24.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    const cleanLabel = modalLabel.trim() || 'Scheduled Alarm';

    if (editingAlarmId) {
      setAlarms((prev) =>
        prev.map((a) =>
          a.id === editingAlarmId
            ? {
                ...a,
                time: timeString,
                label: cleanLabel,
                repeatDays: modalDays,
                enabled: true,
              }
            : a
        )
      );
    } else {
      const newAlarm: AlarmItem = {
        id: `alarm-${Date.now()}`,
        time: timeString,
        label: cleanLabel,
        repeatDays: modalDays,
        enabled: true,
        tone: 'Starlight Chime',
      };
      setAlarms((prev) => [newAlarm, ...prev]);
    }

    setIsModalOpen(false);
  };

  const toggleModalDay = (dayIndex: number) => {
    setModalDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const activeAlarmsCount = useMemo(
    () => alarms.filter((a) => a.enabled).length,
    [alarms]
  );

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-100px)] flex flex-col items-center select-none overflow-y-auto px-4 sm:px-6 pt-6 pb-28 sm:pb-32">
      {/* Top Header & Tool Switcher */}
      <div className="w-full max-w-lg flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.25em] text-white/40 uppercase">
              CHRONO CONTROL
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ALARMS
            </h1>
          </div>

          {/* New Alarm Primary CTA Button */}
          {activeTool === 'alarms' && (
            <button
              type="button"
              onClick={handleOpenNewAlarm}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C9A15B]/15 hover:bg-[#C9A15B]/25 text-[#F5D89A] border border-[#C9A15B]/30 transition-all cursor-pointer shadow-[0_0_12px_rgba(201,161,91,0.15)] active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#F5D89A]" strokeWidth={2.5} />
              <span className="text-xs font-semibold tracking-wide">Add Alarm</span>
            </button>
          )}
        </div>

        {/* Clock Tools Segmented Switcher */}
        <div className="flex items-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl self-start">
          <button
            type="button"
            onClick={() => setActiveTool('alarms')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTool === 'alarms'
                ? 'bg-[#C9A15B]/20 text-[#F5D89A] border border-[#C9A15B]/30 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alarms</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/70">
              {activeAlarmsCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('timer')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTool === 'timer'
                ? 'bg-[#C9A15B]/20 text-[#F5D89A] border border-[#C9A15B]/30 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Timer</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTool('stopwatch')}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTool === 'stopwatch'
                ? 'bg-[#C9A15B]/20 text-[#F5D89A] border border-[#C9A15B]/30 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Stopwatch</span>
          </button>
        </div>
      </div>

      {/* Main Tool Content Container */}
      <div className="w-full max-w-lg mt-6">
        {/* ===================================================================
            TOOL 1: ALARMS LIST & MANAGEMENT
           =================================================================== */}
        {activeTool === 'alarms' && (
          <div className="flex flex-col gap-3">
            {alarms.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center p-12 text-center border border-white/[0.06] rounded-2xl bg-white/[0.01]">
                <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4">
                  <BellOff className="w-5 h-5 text-white/40" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  No Alarms Scheduled
                </h3>
                <p className="text-xs text-white/40 max-w-xs mb-6">
                  Set recurring or one-time alerts to synchronize your daily schedule with precision.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewAlarm}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A15B] hover:bg-[#F5D89A] text-black font-semibold text-xs tracking-wide transition-all shadow-[0_0_16px_rgba(201,161,91,0.25)] cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-black" strokeWidth={2.5} />
                  <span>Create First Alarm</span>
                </button>
              </div>
            ) : (
              /* Configured Alarms List */
              alarms.map((alarm) => {
                const { time, period } = formatTimeDisplay(alarm.time);
                const repeatLabel = formatRepeatDays(alarm.repeatDays);

                return (
                  <div
                    key={alarm.id}
                    className={`group relative flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                      alarm.enabled
                        ? 'bg-white/[0.03] border-white/[0.1] hover:border-white/20'
                        : 'bg-white/[0.01] border-white/[0.04] opacity-50 hover:opacity-75'
                    }`}
                  >
                    {/* Time & Label Info (Clicking opens Edit) */}
                    <div
                      onClick={() => handleOpenEditAlarm(alarm)}
                      className="flex flex-col cursor-pointer pr-4 flex-1"
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-mono">
                          {time}
                        </span>
                        <span className="text-xs font-mono font-medium text-white/50 tracking-wider">
                          {period}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="font-medium text-white/80">
                          {alarm.label}
                        </span>
                        <span className="text-white/25">·</span>
                        <span className="text-white/45">{repeatLabel}</span>
                      </div>
                    </div>

                    {/* Actions: Edit, Delete, Toggle */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAlarm(alarm)}
                        title="Edit alarm"
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-white transition-opacity rounded-lg hover:bg-white/[0.05] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteAlarm(alarm.id)}
                        title="Delete alarm"
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 transition-opacity rounded-lg hover:bg-white/[0.05] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Custom Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alarm.enabled}
                        onClick={() => toggleAlarm(alarm.id)}
                        aria-label={`Toggle alarm for ${time} ${period}`}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          alarm.enabled
                            ? 'bg-[#C9A15B] shadow-[0_0_12px_rgba(201,161,91,0.5)]'
                            : 'bg-white/10'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            alarm.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===================================================================
            TOOL 2: TIMER UTILITY
           =================================================================== */}
        {activeTool === 'timer' && (
          <div className="flex flex-col items-center p-8 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {/* Timer Display */}
            <div className="text-6xl sm:text-7xl font-mono font-bold tracking-tight text-white mb-6">
              {Math.floor(timerSecondsLeft / 60)
                .toString()
                .padStart(2, '0')}
              :
              {(timerSecondsLeft % 60).toString().padStart(2, '0')}
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 mb-8">
              {[
                { label: '1m', secs: 60 },
                { label: '5m', secs: 300 },
                { label: '10m', secs: 600 },
                { label: '15m', secs: 900 },
                { label: '25m', secs: 1500 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerInitialSeconds(p.secs);
                    setTimerSecondsLeft(p.secs);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${
                    timerInitialSeconds === p.secs
                      ? 'border-[#C9A15B] text-[#F5D89A] bg-[#C9A15B]/10'
                      : 'border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSecondsLeft(timerInitialSeconds);
                }}
                className="p-3.5 rounded-full border border-white/10 hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A15B] hover:bg-[#F5D89A] text-black shadow-[0_0_20px_rgba(201,161,91,0.4)] transition-all cursor-pointer active:scale-95"
                title={isTimerRunning ? 'Pause' : 'Start'}
              >
                {isTimerRunning ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            TOOL 3: STOPWATCH UTILITY
           =================================================================== */}
        {activeTool === 'stopwatch' && (
          <div className="flex flex-col items-center p-8 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {/* Stopwatch Display */}
            <div className="flex items-baseline gap-1 text-5xl sm:text-6xl font-mono font-bold tracking-tight text-white mb-6">
              <span>
                {Math.floor(stopwatchMs / 60000)
                  .toString()
                  .padStart(2, '0')}
                :
                {Math.floor((stopwatchMs % 60000) / 1000)
                  .toString()
                  .padStart(2, '0')}
              </span>
              <span className="text-2xl sm:text-3xl text-white/40">
                .
                {Math.floor((stopwatchMs % 1000) / 10)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsStopwatchRunning(false);
                  setStopwatchMs(0);
                  setLaps([]);
                }}
                className="p-3.5 rounded-full border border-white/10 hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Reset stopwatch"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsStopwatchRunning(!isStopwatchRunning)}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-[#C9A15B] hover:bg-[#F5D89A] text-black shadow-[0_0_20px_rgba(201,161,91,0.4)] transition-all cursor-pointer active:scale-95"
                title={isStopwatchRunning ? 'Pause' : 'Start'}
              >
                {isStopwatchRunning ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              {isStopwatchRunning && (
                <button
                  type="button"
                  onClick={() => setLaps((prev) => [stopwatchMs, ...prev])}
                  className="px-4 py-2.5 rounded-full border border-white/20 text-xs font-mono font-medium hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Lap
                </button>
              )}
            </div>

            {/* Laps List */}
            {laps.length > 0 && (
              <div className="w-full max-h-40 overflow-y-auto border-t border-white/[0.08] pt-3 flex flex-col gap-1.5">
                {laps.map((lap, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs font-mono text-white/60 px-2 py-1 rounded hover:bg-white/[0.03]"
                  >
                    <span>Lap {laps.length - idx}</span>
                    <span>
                      {Math.floor(lap / 60000)
                        .toString()
                        .padStart(2, '0')}
                      :
                      {Math.floor((lap % 60000) / 1000)
                        .toString()
                        .padStart(2, '0')}
                      .
                      {Math.floor((lap % 1000) / 10)
                        .toString()
                        .padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================
          MODAL: CREATE / EDIT ALARM DIALOG
         =================================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alarm-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm rounded-2xl bg-[#121215] border border-white/10 p-6 shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <h2
                  id="alarm-dialog-title"
                  className="text-base font-semibold text-white tracking-wide"
                >
                  {editingAlarmId ? 'Edit Alarm' : 'Set New Alarm'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveModalAlarm} className="flex flex-col gap-5 mt-5">
                {/* Time Picker Controls (Hour : Minute + AM/PM) */}
                <div className="flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={modalHour}
                      onChange={(e) => setModalHour(e.target.value.padStart(2, '0'))}
                      className="w-16 h-14 text-center text-3xl font-mono font-bold text-white bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:border-[#C9A15B]"
                    />
                    <span className="text-[10px] text-white/40 mt-1 uppercase">Hour</span>
                  </div>

                  <span className="text-3xl font-mono font-bold text-white/40 -mt-4">:</span>

                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={modalMinute}
                      onChange={(e) => setModalMinute(e.target.value.padStart(2, '0'))}
                      className="w-16 h-14 text-center text-3xl font-mono font-bold text-white bg-white/[0.04] border border-white/10 rounded-xl focus:outline-none focus:border-[#C9A15B]"
                    />
                    <span className="text-[10px] text-white/40 mt-1 uppercase">Minute</span>
                  </div>

                  {/* AM/PM Toggle */}
                  <div className="flex flex-col gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => setModalPeriod('AM')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                        modalPeriod === 'AM'
                          ? 'bg-[#C9A15B] text-black'
                          : 'bg-white/[0.04] text-white/40 hover:text-white'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalPeriod('PM')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                        modalPeriod === 'PM'
                          ? 'bg-[#C9A15B] text-black'
                          : 'bg-white/[0.04] text-white/40 hover:text-white'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Alarm Label Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-white/60">Label</label>
                  <input
                    type="text"
                    value={modalLabel}
                    onChange={(e) => setModalLabel(e.target.value)}
                    placeholder="e.g. Morning Ignition"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#C9A15B]"
                  />
                </div>

                {/* Repeat Days Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-white/60">Repeat</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_LABELS.map((dayLabel, idx) => {
                      const isSelected = modalDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleModalDay(idx)}
                          className={`h-9 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#C9A15B] text-black font-bold'
                              : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08]'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] mt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#C9A15B] hover:bg-[#F5D89A] text-black font-semibold text-xs transition-all shadow-[0_0_12px_rgba(201,161,91,0.3)] cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                    <span>Save Alarm</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
