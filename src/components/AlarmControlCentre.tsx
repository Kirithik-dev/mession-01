import React, { useState } from 'react';
import { HangingIndustrialLamp } from './HangingIndustrialLamp';
import { AlarmCountdownDisplay } from './AlarmCountdownDisplay';
import { LampPowerSwitch } from './LampPowerSwitch';
import { AlarmTimeEditorModal } from './AlarmTimeEditorModal';
import {
  MissionAlarm,
  formatTime12h,
  formatRepeatDays,
} from '../utils/alarmTime';
import { parseTimeString } from '../utils/alarmEngine';
import { useAlarmContext } from '../context/AlarmContext';
import { Plus, Pencil, Trash2, BellOff } from 'lucide-react';

/**
 * MISSION Clock Tab Container
 * Master Lamp-Based Alarm Interface:
 * 1. Wire reaches all the way to the top edge (y=0) with lamp in upper screen
 * 2. Shallow dome industrial pendant in matte charcoal graphite
 * 3. Warm downward light cone when ON, unlit when OFF
 * 4. Concise reactive countdown ("6 HOURS LEFT", "30 MIN LEFT"), hidden when OFF
 * 5. Horizontal control row: Alarm ON/OFF Switch (left) + ADD ALARM Button (right)
 * 6. Premium scrollable alarm list in dark translucent glass with subtle champagne highlights
 * 7. Zero grey rails, zero visible browser scrollbars, clean edge-to-edge near-black canvas
 */
export const AlarmControlCentre: React.FC = () => {
  const {
    alarms,
    isMasterOn,
    nextActiveAlarm,
    activeSession,
    toggleMaster,
    toggleAlarm,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    snoozeAlarm,
    stopAlarm,
  } = useAlarmContext();

  // Modal editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<MissionAlarm | null>(null);

  // Open modal to add new alarm
  const handleAddNew = () => {
    setEditingAlarm(null);
    setIsEditorOpen(true);
  };

  // Open modal to edit existing alarm
  const handleEditAlarm = (alarm: MissionAlarm, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingAlarm(alarm);
    setIsEditorOpen(true);
  };

  // Delete an alarm
  const handleDeleteAlarm = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteAlarm(id);
  };

  // Save alarm (from modal)
  const handleSaveAlarm = (data: {
    id?: string;
    time: string;
    label: string;
    repeatDays: number[];
    enabled: boolean;
  }) => {
    if (data.id) {
      const existing = alarms.find((a) => a.id === data.id);
      const { hour, minute } = parseTimeString(data.time);
      updateAlarm({
        id: data.id,
        time: data.time,
        hour,
        minute,
        label: data.label,
        repeatDays: data.repeatDays,
        enabled: data.enabled,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastTriggeredAt: existing?.lastTriggeredAt || null,
      });
    } else {
      addAlarm({
        time: data.time,
        label: data.label,
        repeatDays: data.repeatDays,
        enabled: true,
      });
    }
  };

  // Determine if lamp is illuminated: ON if an active alarm is scheduled, or if actively ringing/snoozed
  const isLampIlluminated =
    (isMasterOn && nextActiveAlarm !== null) ||
    activeSession?.status === 'ringing' ||
    activeSession?.status === 'snoozed';

  return (
    <div
      aria-label="Clock and Alarm Interface"
      className="relative w-full h-full bg-[#050507] text-white select-none overflow-hidden flex flex-col items-center justify-between no-scrollbar"
    >
      {/* ===================================================================
          1. HANGING INDUSTRIAL SHALLOW DOME LAMP
          - Wire reaches all the way to top edge (y=0)
          - Shallow dome shade in matte charcoal graphite
          - Warm downward light cone when ON
         =================================================================== */}
      <div className="relative z-10 w-full flex flex-col items-center pt-0">
        <HangingIndustrialLamp
          isOn={isLampIlluminated}
          onToggle={toggleMaster}
          className="w-full"
        />

        {/* ===================================================================
            2. CONCISE REACTIVE COUNTDOWN OR ACTIVE RINGING/SNOOZED CONTROLLER
            - When ringing: displays ringing notice, sound source, SNOOZE and STOP
            - When snoozed: displays countdown and CANCEL SNOOZE
            - When scheduled: displays concise countdown ("6 HOURS LEFT")
            - When disarmed: displays STANDBY · ALARMS DISARMED
           =================================================================== */}
        <div className="min-h-[58px] sm:min-h-[64px] flex items-center justify-center mt-1 sm:mt-2">
          {activeSession?.status === 'ringing' ? (
            <div className="flex flex-col items-center animate-fade-in z-20">
              <div className="font-mono text-xl sm:text-2xl font-semibold tracking-widest text-[#F5CE76] drop-shadow-[0_0_18px_rgba(245,206,118,0.7)] animate-pulse">
                ALARM RINGING
              </div>
              <div className="text-[10px] sm:text-[11px] tracking-wider text-neutral-300 uppercase mt-0.5 flex items-center gap-1.5">
                <span className="font-semibold text-white">{activeSession.alarmLabel}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-400">
                  {activeSession.hasAudio ? `♪ ${activeSession.trackTitle || 'Vault Track'}` : 'VISUAL MODE'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => snoozeAlarm()}
                  className="px-3.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.14] text-[11px] font-semibold tracking-wider uppercase text-neutral-200 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  Snooze ({activeSession.snoozeDurationMinutes}m)
                </button>
                <button
                  type="button"
                  onClick={() => stopAlarm()}
                  className="px-4 py-1 rounded-full bg-[#E5484D] hover:bg-[#F2555A] text-white text-[11px] font-bold tracking-wider uppercase transition-all cursor-pointer active:scale-95 shadow-[0_0_14px_rgba(229,72,77,0.4)]"
                >
                  Stop
                </button>
              </div>
            </div>
          ) : activeSession?.status === 'snoozed' ? (
            <div className="flex flex-col items-center animate-fade-in z-20">
              <div className="font-mono text-lg sm:text-xl font-light tracking-widest text-[#F5CE76]">
                SNOOZED · {activeSession.snoozeUntil ? Math.max(1, Math.ceil((new Date(activeSession.snoozeUntil).getTime() - Date.now()) / 60000)) : 5}M REMAINING
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
                  {activeSession.alarmLabel}
                </span>
                <button
                  type="button"
                  onClick={() => stopAlarm()}
                  className="px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[10px] font-medium tracking-wider uppercase text-neutral-300 transition-colors cursor-pointer"
                >
                  Stop
                </button>
              </div>
            </div>
          ) : isLampIlluminated && nextActiveAlarm ? (
            <AlarmCountdownDisplay
              activeAlarm={nextActiveAlarm.alarm}
              nextDate={nextActiveAlarm.nextDate}
              isMasterOn={isLampIlluminated}
              onSelectAlarm={(alarm) => handleEditAlarm(alarm)}
            />
          ) : (
            <div className="text-[10px] sm:text-[11px] tracking-[0.24em] font-medium text-neutral-400 uppercase">
              STANDBY · ALARMS DISARMED
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          3. MAIN INTERACTION AREA
          - Single balanced horizontal control row:
            [Alarm Switch (Left)] ---------- [+ ADD ALARM (Right)]
          - Below: Premium scrollable alarm list in dark glass panel
         =================================================================== */}
      <div className="relative z-20 w-full max-w-[410px] px-4 sm:px-5 flex-1 flex flex-col justify-end pb-24 sm:pb-28">
        {/* Horizontal Control Row */}
        <div className="w-full flex items-center justify-between mb-2.5 sm:mb-3">
          {/* Left: Compact Alarm ON/OFF Switch */}
          <LampPowerSwitch
            isOn={isLampIlluminated}
            onToggle={toggleMaster}
          />

          {/* Right: + ADD ALARM Button */}
          <button
            type="button"
            onClick={handleAddNew}
            className="group flex items-center gap-1.5 px-3.5 sm:px-4 h-[38px] rounded-full bg-[#151518]/90 hover:bg-[#1E1E24] text-[#F5CE76] hover:text-[#FFEAB5] border border-[#F5CE76]/30 hover:border-[#F5CE76]/60 transition-all duration-200 outline-none focus-visible:ring-1 focus-visible:ring-[#F5CE76]/50 active:scale-95 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
            title="Create a new alarm"
          >
            <Plus size={14} strokeWidth={2.4} />
            <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase">
              Add Alarm
            </span>
          </button>
        </div>

        {/* ===================================================================
            4. PREMIUM SCROLLABLE ALARM LIST
            - Dark translucent glass panel
            - Subtle champagne-gold rim highlight on top
            - Internal scrolling (no-scrollbar) without pushing navigation
           =================================================================== */}
        <div className="relative w-full rounded-2xl bg-[#111114]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.9)] overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#F5D89A]/25 before:to-transparent">
          {/* Internal Scroll Container */}
          <div className="max-h-[175px] sm:max-h-[220px] overflow-y-auto no-scrollbar p-2 sm:p-2.5 flex flex-col gap-1.5">
            {alarms.length > 0 ? (
              alarms.map((alarm) => {
                const timeInfo = formatTime12h(alarm.time);
                const isItemActive = isMasterOn && alarm.enabled;

                return (
                  <div
                    key={alarm.id}
                    onClick={() => handleEditAlarm(alarm)}
                    className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                      isItemActive
                        ? 'bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06]'
                        : 'bg-white/[0.015] hover:bg-white/[0.035] border border-white/[0.025] opacity-65 hover:opacity-85'
                    }`}
                  >
                    {/* Left: Time, Label, and Repeat Schedule */}
                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`font-mono text-lg sm:text-xl font-medium tracking-tight tabular-nums transition-colors ${
                            isItemActive
                              ? 'text-white'
                              : 'text-neutral-400'
                          }`}
                        >
                          {timeInfo.hour12}:{timeInfo.minute}
                        </span>
                        <span
                          className={`text-[10px] font-mono tracking-wider transition-colors ${
                            isItemActive
                              ? 'text-[#F5CE76]'
                              : 'text-neutral-400'
                          }`}
                        >
                          {timeInfo.ampm}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
                        <span className="truncate font-medium text-neutral-300">
                          {alarm.label || 'Alarm'}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-neutral-600 select-none"
                        >
                          ·
                        </span>
                        <span className="font-mono text-[9px] sm:text-[10px] text-neutral-400 tracking-wider">
                          {formatRepeatDays(alarm.repeatDays)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Controls (Edit, Delete, Toggle) */}
                    <div
                      className="flex items-center gap-1 sm:gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={(e) => handleEditAlarm(alarm, e)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                        title="Edit alarm"
                        aria-label={`Edit ${alarm.label}`}
                      >
                        <Pencil size={13} />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAlarm(alarm.id, e)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete alarm"
                        aria-label={`Delete ${alarm.label}`}
                      >
                        <Trash2 size={13} />
                      </button>

                      {/* Individual Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alarm.enabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAlarm(alarm.id);
                        }}
                        className={`relative w-9 h-5 rounded-full p-0.5 transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-[#F5CE76]/50 cursor-pointer ml-1 ${
                          alarm.enabled
                            ? 'bg-[#F5CE76]'
                            : 'bg-neutral-800 border border-white/[0.06]'
                        }`}
                        title={
                          alarm.enabled
                            ? 'Alarm armed. Click to disarm.'
                            : 'Alarm disarmed. Click to arm.'
                        }
                        aria-label={`Toggle ${alarm.label}`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full transition-transform duration-200 shadow-sm ${
                            alarm.enabled
                              ? 'translate-x-4 bg-black'
                              : 'translate-x-0 bg-neutral-400'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty State when no alarms are configured */
              <div className="flex flex-col items-center justify-center py-7 px-4 text-center">
                <BellOff size={22} className="text-neutral-400 mb-2" />
                <div className="text-[11px] font-semibold tracking-widest uppercase text-neutral-300">
                  NO ALARMS SET
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 max-w-[220px]">
                  Tap + Add Alarm above to schedule a wake-up time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================
          5. ADD / EDIT ALARM MODAL
         =================================================================== */}
      <AlarmTimeEditorModal
        isOpen={isEditorOpen}
        alarmToEdit={editingAlarm}
        onSave={handleSaveAlarm}
        onDelete={handleDeleteAlarm}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
};
