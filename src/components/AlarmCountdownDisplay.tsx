import React, { useEffect, useState } from 'react';
import { MissionAlarm, formatConciseCountdown, formatTime12h } from '../utils/alarmTime';

interface AlarmCountdownDisplayProps {
  activeAlarm: MissionAlarm | null;
  nextDate: Date | null;
  isMasterOn: boolean;
  onSelectAlarm?: (alarm: MissionAlarm) => void;
  className?: string;
}

/**
 * AlarmCountdownDisplay Component
 * Minimal, concise reactive alarm countdown:
 * - Completely unmounted from DOM when master is OFF or no alarms are enabled
 * - Replaces separate HOURS/MINUTES/SECONDS boxes with concise text: e.g. "6 HOURS LEFT", "30 MIN LEFT"
 * - Updates reactively every 1000ms against current device local time
 */
export const AlarmCountdownDisplay: React.FC<AlarmCountdownDisplayProps> = ({
  activeAlarm,
  nextDate,
  isMasterOn,
  onSelectAlarm,
  className = '',
}) => {
  const [countdownText, setCountdownText] = useState<string>('');

  useEffect(() => {
    if (!isMasterOn || !activeAlarm || !nextDate) {
      setCountdownText('');
      return;
    }

    const update = () => {
      setCountdownText(formatConciseCountdown(nextDate));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isMasterOn, activeAlarm, nextDate]);

  // CRITICAL: Completely hide countdown if master is OFF or no active alarm exists
  if (!isMasterOn || !activeAlarm || !nextDate || !countdownText) {
    return null;
  }

  const time12 = formatTime12h(activeAlarm.time);

  return (
    <div
      className={`relative z-20 flex flex-col items-center select-none text-center animate-fade-in ${className}`}
    >
      <button
        type="button"
        onClick={() => onSelectAlarm?.(activeAlarm)}
        title={`Upcoming alarm: ${time12.formatted} (${activeAlarm.label}). Tap to edit.`}
        className="group flex flex-col items-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#F5CE76]/40 rounded-xl px-4 py-1.5 transition-transform duration-150 active:scale-[0.99]"
      >
        {/* Concise Main Countdown (e.g. "6 HOURS LEFT" or "30 MIN LEFT") */}
        <div className="font-mono text-2xl sm:text-3xl font-light tracking-widest text-[#F5CE76] drop-shadow-[0_0_14px_rgba(245,206,118,0.32)]">
          {countdownText}
        </div>

        {/* Minimal Sub-line: Target time & Label */}
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] tracking-[0.22em] font-medium uppercase text-neutral-400 group-hover:text-neutral-300 transition-colors">
          <span>NEXT: {time12.formatted}</span>
          <span aria-hidden="true" className="text-neutral-600 select-none">
            ·
          </span>
          <span className="text-neutral-400 truncate max-w-[140px]">
            {activeAlarm.label || 'ALARM'}
          </span>
        </div>
      </button>
    </div>
  );
};
