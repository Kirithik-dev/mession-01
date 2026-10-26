import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Check, Plus } from 'lucide-react';
import { MissionAlarm } from '../utils/alarmTime';

interface AlarmTimeEditorModalProps {
  isOpen: boolean;
  alarmToEdit: MissionAlarm | null;
  onSave: (alarmData: {
    id?: string;
    time: string;
    label: string;
    repeatDays: number[];
    enabled: boolean;
  }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const PRESET_TIMES = [
  { label: '06:00 AM', time24: '06:00' },
  { label: '06:30 AM', time24: '06:30' },
  { label: '07:00 AM', time24: '07:00' },
  { label: '07:30 AM', time24: '07:30' },
  { label: '08:00 AM', time24: '08:00' },
  { label: '08:30 AM', time24: '08:30' },
];

const DAYS_OF_WEEK = [
  { dayIndex: 0, label: 'S', name: 'Sunday' },
  { dayIndex: 1, label: 'M', name: 'Monday' },
  { dayIndex: 2, label: 'T', name: 'Tuesday' },
  { dayIndex: 3, label: 'W', name: 'Wednesday' },
  { dayIndex: 4, label: 'T', name: 'Thursday' },
  { dayIndex: 5, label: 'F', name: 'Friday' },
  { dayIndex: 6, label: 'S', name: 'Saturday' },
];

/**
 * AlarmTimeEditorModal
 * Refined modal dialog to add or edit alarms with time picker, repeat schedule, and label.
 */
export const AlarmTimeEditorModal: React.FC<AlarmTimeEditorModalProps> = ({
  isOpen,
  alarmToEdit,
  onSave,
  onDelete,
  onClose,
}) => {
  const isEditing = Boolean(alarmToEdit);

  // Parse time24 into 12h parts
  const parseTime = (timeStr?: string | null) => {
    if (!timeStr || !timeStr.includes(':')) {
      return { hour: 7, minute: 0, ampm: 'AM' as const };
    }
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? ('PM' as const) : ('AM' as const);
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: h, minute: m, ampm };
  };

  const [hour, setHour] = useState<number>(7);
  const [minute, setMinute] = useState<number>(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [label, setLabel] = useState<string>('Wake Up');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Synchronize state when modal opens or alarmToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (alarmToEdit) {
        const parsed = parseTime(alarmToEdit.time);
        setHour(parsed.hour);
        setMinute(parsed.minute);
        setAmpm(parsed.ampm);
        setLabel(alarmToEdit.label || 'Wake Up');
        setRepeatDays(alarmToEdit.repeatDays || []);
      } else {
        // Adding fresh alarm
        setHour(7);
        setMinute(0);
        setAmpm('AM');
        setLabel('Wake Up');
        setRepeatDays([1, 2, 3, 4, 5]);
      }
    }
  }, [isOpen, alarmToEdit]);

  if (!isOpen) return null;

  const toggleDay = (dayIndex: number) => {
    if (repeatDays.includes(dayIndex)) {
      setRepeatDays(repeatDays.filter((d) => d !== dayIndex));
    } else {
      setRepeatDays([...repeatDays, dayIndex].sort((a, b) => a - b));
    }
  };

  const selectPreset = (time24: string) => {
    const parsed = parseTime(time24);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setAmpm(parsed.ampm);
  };

  const handleSave = () => {
    let h24 = hour % 12;
    if (ampm === 'PM') h24 += 12;
    const time24 = `${String(h24).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0'
    )}`;

    onSave({
      id: alarmToEdit?.id,
      time: time24,
      label: label.trim() || 'Alarm',
      repeatDays,
      enabled: true, // Automatically arm when saving
    });
    onClose();
  };

  const incrementHour = () => setHour((prev) => (prev % 12) + 1);
  const decrementHour = () => setHour((prev) => (prev === 1 ? 12 : prev - 1));
  const adjustMinute = (delta: number) => {
    setMinute((prev) => {
      let next = (prev + delta) % 60;
      if (next < 0) next += 60;
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alarm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[380px] bg-[#121215] border border-white/[0.09] rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.95)] flex flex-col gap-4 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#F5CE76]" />
            <h2
              id="alarm-modal-title"
              className="text-xs font-semibold tracking-widest uppercase text-neutral-200"
            >
              {isEditing ? 'Edit Alarm' : 'Add New Alarm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Time Picker Controls */}
        <div className="flex items-center justify-center gap-3 py-1">
          {/* Hour Selector */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={incrementHour}
              className="w-10 h-7 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              aria-label="Increment hour"
            >
              ▲
            </button>
            <div className="font-mono text-4xl sm:text-5xl font-light tabular-nums w-[2ch] text-center text-white py-1">
              {String(hour).padStart(2, '0')}
            </div>
            <button
              type="button"
              onClick={decrementHour}
              className="w-10 h-7 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              aria-label="Decrement hour"
            >
              ▼
            </button>
          </div>

          {/* Colon separator */}
          <div className="text-3xl font-light text-neutral-500 pb-1">:</div>

          {/* Minute Selector */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => adjustMinute(5)}
              className="w-10 h-7 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              aria-label="Add 5 minutes"
            >
              ▲
            </button>
            <div className="font-mono text-4xl sm:text-5xl font-light tabular-nums w-[2ch] text-center text-white py-1">
              {String(minute).padStart(2, '0')}
            </div>
            <button
              type="button"
              onClick={() => adjustMinute(-5)}
              className="w-10 h-7 flex items-center justify-center text-xs text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              aria-label="Subtract 5 minutes"
            >
              ▼
            </button>
          </div>

          {/* AM / PM Segmented Toggle */}
          <div className="flex flex-col gap-1.5 ml-2">
            <button
              type="button"
              onClick={() => setAmpm('AM')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                ampm === 'AM'
                  ? 'bg-[#F5CE76] text-black shadow-sm'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setAmpm('PM')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                ampm === 'PM'
                  ? 'bg-[#F5CE76] text-black shadow-sm'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.2em] font-medium text-neutral-400 uppercase">
            Quick Presets
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESET_TIMES.map((preset) => (
              <button
                key={preset.time24}
                type="button"
                onClick={() => selectPreset(preset.time24)}
                className="py-1 px-2 text-[11px] font-mono rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] text-neutral-300 hover:text-white transition-colors text-center cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Repeat Days Selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.2em] font-medium text-neutral-400 uppercase">
            Repeat Days
          </span>
          <div className="flex items-center justify-between gap-1">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = repeatDays.includes(day.dayIndex);
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  onClick={() => toggleDay(day.dayIndex)}
                  title={day.name}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-medium transition-colors flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#F5CE76] text-black font-semibold'
                      : 'bg-white/[0.04] text-neutral-400 hover:text-white'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alarm Label */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="alarm-label-input"
            className="text-[10px] tracking-[0.2em] font-medium text-neutral-400 uppercase"
          >
            Label
          </label>
          <input
            id="alarm-label-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Wake Up"
            maxLength={26}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-[#F5CE76]/60 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          {/* Delete Action (only in Edit mode) */}
          {isEditing && onDelete && alarmToEdit && (
            <button
              type="button"
              onClick={() => {
                onDelete(alarmToEdit.id);
                onClose();
              }}
              title="Delete this alarm"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/10 cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          )}

          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {/* Save / Confirm */}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-[#F5CE76] hover:bg-[#FFE5A3] text-black text-xs font-semibold tracking-wide uppercase transition-colors shadow-sm cursor-pointer"
          >
            {isEditing ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
                <span>Create Alarm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
