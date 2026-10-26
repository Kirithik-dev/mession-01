import React from 'react';
import { Power } from 'lucide-react';

interface LampPowerSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * LampPowerSwitch Component
 * Compact, tactile binary ON/OFF switch engineered for the horizontal control row:
 * - Positioned on the left of the control row
 * - Clear binary state with accessible role="switch"
 * - Warm champagne highlight when ON, sleek graphite when OFF
 */
export const LampPowerSwitch: React.FC<LampPowerSwitchProps> = ({
  isOn,
  onToggle,
  className = '',
}) => {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={onToggle}
        aria-label={`Master alarm is ${isOn ? 'On' : 'Off'}. Tap to toggle master alarm.`}
        className={`group relative flex items-center justify-between w-[114px] sm:w-[122px] h-[38px] px-3 rounded-full cursor-pointer transition-all duration-250 outline-none focus-visible:ring-1 focus-visible:ring-[#F5CE76]/60 active:scale-95 ${
          isOn
            ? 'bg-[#2A2216]/95 border border-[#F5CE76]/40 shadow-[0_2px_14px_rgba(245,206,118,0.18)]'
            : 'bg-[#151518]/90 border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* State Label: ON / OFF */}
        <span
          className={`text-[11px] sm:text-xs font-semibold tracking-wider uppercase transition-colors duration-250 pl-0.5 ${
            isOn ? 'text-[#FEEBC8]' : 'text-neutral-400'
          }`}
        >
          {isOn ? 'Alarm On' : 'Alarm Off'}
        </span>

        {/* Circular Power Indicator */}
        <div
          className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-250 ${
            isOn
              ? 'bg-[#3E311D] border border-[#F5CE76]/50 text-[#F5CE76] shadow-[0_0_8px_rgba(245,206,118,0.3)]'
              : 'bg-[#222227] border border-white/[0.06] text-neutral-400'
          }`}
        >
          <Power
            size={12}
            strokeWidth={2.4}
            className={`transition-transform duration-250 ${
              isOn ? 'rotate-0' : '-rotate-12'
            }`}
          />
        </div>
      </button>

      <span className="sr-only">
        {isOn ? 'Master alarm is active.' : 'Master alarm is disabled.'}
      </span>
    </div>
  );
};
