import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Activity,
  Layers,
  Sparkles,
  Database,
  Check,
  Copy,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  HardDrive,
  Eye,
} from 'lucide-react';
import { useMediaLibrary } from '../context/MediaLibraryContext';
import { TrackItem, ImageItem } from '../types/media';
import {
  runFullSystemDiagnostics,
  DiagnosticReport,
  getDiagnosticReports,
  clearDiagnosticLogs,
  copyReportToClipboard,
} from '../utils/systemDiagnostics';
import {
  loadAdvancedPreferences,
  saveAdvancedPreferences,
  AdvancedPreferences,
  createSettingsBackupPackage,
  downloadSettingsBackup,
  validateBackupJson,
  SettingsBackupPackage,
} from '../utils/advancedSettings';
import { recordTimelineEvent } from '../utils/eventTimeline';
import { recordAppError, getErrorLogs, clearErrorLogs } from '../utils/errorCentre';

type SettingsView = 'main' | 'diagnostics' | 'media' | 'appearance' | 'data';

export const SettingsSection: React.FC = () => {
  const {
    songs,
    images,
    addSongs,
    addImages,
    clearSongs,
    clearImages,
    currentTrackIndex,
  } = useMediaLibrary();

  // Active view navigation ('main' or one of the 4 dedicated sub-screens)
  const [activeView, setActiveView] = useState<SettingsView>('main');

  // Preferences
  const [preferences, setPreferences] = useState<AdvancedPreferences>(loadAdvancedPreferences);

  // Diagnostics State
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [latestReport, setLatestReport] = useState<DiagnosticReport | null>(() => {
    const reports = getDiagnosticReports();
    return reports.length > 0 ? reports[0] : null;
  });
  const [copiedReport, setCopiedReport] = useState(false);

  // Media Library Subview State
  const [consistencyResult, setConsistencyResult] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  // Backup & Recovery State
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [backupPreview, setBackupPreview] = useState<SettingsBackupPackage | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);

  // Developer Mode (Discreetly preserved under diagnostics)
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [sandboxActive, setSandboxActive] = useState(false);
  const sandboxBackupRef = useRef<{ songs: TrackItem[]; images: ImageItem[] } | null>(null);

  const hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  const updatePreference = <K extends keyof AdvancedPreferences>(
    key: K,
    val: AdvancedPreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: val };
      saveAdvancedPreferences(next);
      recordTimelineEvent({
        type: 'settings_change',
        title: 'PREFERENCE UPDATED',
        message: `${String(key)} set to ${String(val)}`,
      });
      return next;
    });
  };

  // Run authentic diagnostics check
  const handleRunCheck = async () => {
    if (isRunningCheck) return;
    setIsRunningCheck(true);
    try {
      const report = await runFullSystemDiagnostics({
        songs,
        images,
        currentTrackIndex,
      });
      setLatestReport(report);
      recordTimelineEvent({
        type: 'diagnostic_run',
        severity: report.overallStatus === 'PASS' ? 'success' : 'warning',
        title: 'DIAGNOSTICS EXECUTED',
        message: `System check finished: ${report.overallStatus}`,
      });
    } catch (err) {
      recordAppError({
        operation: 'Diagnostics',
        title: 'CHECK EXECUTION FAILED',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunningCheck(false);
    }
  };

  const handleCopyReport = async () => {
    if (!latestReport) return;
    const ok = await copyReportToClipboard(latestReport);
    if (ok) {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  // Validate Media Library Consistency
  const handleValidateConsistency = () => {
    const invalidSongs = songs.filter((s) => !s.id || !s.title);
    const invalidImages = images.filter((img) => !img.id || !img.url);

    const songIds = new Set<string>();
    let dupSongs = 0;
    songs.forEach((s) => {
      if (songIds.has(s.id)) dupSongs++;
      songIds.add(s.id);
    });

    const imgIds = new Set<string>();
    let dupImgs = 0;
    images.forEach((i) => {
      if (imgIds.has(i.id)) dupImgs++;
      imgIds.add(i.id);
    });

    if (invalidSongs.length === 0 && invalidImages.length === 0 && dupSongs === 0 && dupImgs === 0) {
      setConsistencyResult('All library records are consistent and intact.');
    } else {
      setConsistencyResult(
        `Found ${invalidSongs.length + invalidImages.length} invalid & ${dupSongs + dupImgs} duplicate records.`
      );
    }
  };

  const handlePurgeInvalid = () => {
    const validSongs = songs.filter((s) => s.id && s.title);
    const validImages = images.filter((img) => img.id && img.url);
    const removed = (songs.length - validSongs.length) + (images.length - validImages.length);

    clearSongs();
    addSongs(validSongs);
    clearImages();
    addImages(validImages);

    setShowPurgeConfirm(false);
    setConsistencyResult(`Purged ${removed} corrupt records safely.`);
  };

  // Backup Export
  const handleExportBackup = () => {
    const pkg = createSettingsBackupPackage({
      preferences,
      audioCount: songs.length,
      imageCount: images.length,
    });
    downloadSettingsBackup(pkg);
    setBackupFeedback('Backup exported successfully.');
    setTimeout(() => setBackupFeedback(null), 3000);
  };

  // Backup File Picker
  const handleBackupSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = validateBackupJson(text);
      if (res.valid && res.package) {
        setBackupPreview(res.package);
      } else {
        setBackupFeedback(res.error || 'Invalid backup file.');
        setTimeout(() => setBackupFeedback(null), 4000);
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const handleApplyBackup = () => {
    if (!backupPreview) return;
    saveAdvancedPreferences(backupPreview.preferences);
    setPreferences(backupPreview.preferences);
    if (backupPreview.alarmsSnapshot) {
      localStorage.setItem('mission_alarms_v2', JSON.stringify(backupPreview.alarmsSnapshot));
    }
    setBackupPreview(null);
    setBackupFeedback('Settings restored successfully.');
    setTimeout(() => setBackupFeedback(null), 3000);
  };

  // Developer sandbox trigger (preserved in diagnostics)
  const toggleSandbox = (scenario: 'Case A' | 'Case D') => {
    if (!sandboxActive) {
      sandboxBackupRef.current = { songs: [...songs], images: [...images] };
      setSandboxActive(true);
      clearSongs();
      clearImages();
      if (scenario === 'Case D') {
        addSongs([
          {
            id: 'sandbox-1',
            title: 'SANDBOX PULSE',
            artist: 'DEV FIXTURE',
            duration: 60,
            src: '',
            addedAt: Date.now(),
            isDemo: true,
          },
        ]);
        addImages([
          {
            id: 'sandbox-img-1',
            title: 'SANDBOX MONOLITH',
            url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
            addedAt: Date.now(),
            isDemo: true,
          },
        ]);
      }
    } else {
      if (sandboxBackupRef.current) {
        clearSongs();
        addSongs(sandboxBackupRef.current.songs);
        clearImages();
        addImages(sandboxBackupRef.current.images);
        sandboxBackupRef.current = null;
      }
      setSandboxActive(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#050507] text-white flex flex-col pt-[calc(env(safe-area-inset-top,24px)+16px)] pb-[116px] px-4 sm:px-6 select-none overflow-y-auto">
      {/* Hidden file input for restore */}
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleBackupSelected}
      />

      <div className="w-full max-w-sm mx-auto flex flex-col gap-6 text-left">
        <AnimatePresence mode="wait">
          {/* =================================================================
              MASTER SETTINGS VIEW (Four Calm, Spacious Entries)
              ================================================================= */}
          {activeView === 'main' ? (
            <motion.div
              key="main-settings"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-5"
            >
              {/* Header */}
              <div className="border-b border-white/[0.06] pb-3">
                <h1 className="text-base sm:text-lg font-bold tracking-[0.16em] uppercase text-white font-sans">
                  SETTINGS
                </h1>
                <p className="text-[11px] font-mono text-neutral-400 tracking-wider mt-0.5">
                  System preferences
                </p>
              </div>

              {/* Four Clean Rows */}
              <div className="rounded-[28px] bg-[#141417] border border-white/[0.08] shadow-[0_16px_36px_rgba(0,0,0,0.6)] overflow-hidden divide-y divide-white/[0.06]">
                {/* 1. Diagnostics */}
                <div
                  onClick={() => setActiveView('diagnostics')}
                  className="group flex items-center justify-between py-4 px-5 sm:px-6 cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-wide font-sans">
                      Diagnostics
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 mt-0.5">
                      System health & verification
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {latestReport && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                          latestReport.overallStatus === 'PASS'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : latestReport.overallStatus === 'WARNING'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}
                      >
                        {latestReport.overallStatus}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>

                {/* 2. Media Libraries */}
                <div
                  onClick={() => setActiveView('media')}
                  className="group flex items-center justify-between py-4 px-5 sm:px-6 cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-wide font-sans">
                      Media Libraries
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 mt-0.5">
                      Storage vault & integrity
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-[#C9A15B]">
                      {songs.length} audio • {images.length} images
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>

                {/* 3. Appearance */}
                <div
                  onClick={() => setActiveView('appearance')}
                  className="group flex items-center justify-between py-4 px-5 sm:px-6 cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-wide font-sans">
                      Appearance
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 mt-0.5">
                      Motion, quality & haptics
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {preferences.visualQuality}
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>

                {/* 4. Data & Recovery */}
                <div
                  onClick={() => setActiveView('data')}
                  className="group flex items-center justify-between py-4 px-5 sm:px-6 cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-wide font-sans">
                      Data & Recovery
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 mt-0.5">
                      Backup export & restore
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-neutral-400">
                      Backup
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}

          {/* =================================================================
              SUBVIEW 1: DIAGNOSTICS SCREEN
              ================================================================= */}
          {activeView === 'diagnostics' ? (
            <motion.div
              key="subview-diagnostics"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveView('main')}
                  className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>SETTINGS</span>
                </button>
                <span className="text-xs font-mono font-bold tracking-wider text-[#C9A15B] uppercase">
                  DIAGNOSTICS
                </span>
              </div>

              {/* Run Check Card */}
              <div className="rounded-[24px] p-5 bg-[#141417] border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.6)] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400">
                    System Health Check
                  </span>
                  {latestReport && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                        latestReport.overallStatus === 'PASS'
                          ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                          : latestReport.overallStatus === 'WARNING'
                          ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
                          : 'text-red-400 bg-red-500/15 border border-red-500/30'
                      }`}
                    >
                      {latestReport.overallStatus}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRunCheck}
                  disabled={isRunningCheck}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.98] border border-[#C9A15B]/40 hover:border-[#C9A15B] text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#EDEDED] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {isRunningCheck ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-[#C9A15B] animate-spin" />
                      <span>CHECKING RUNTIME...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 text-[#C9A15B]" />
                      <span>RUN CHECK</span>
                    </>
                  )}
                </button>

                {/* Individual Check Results */}
                {latestReport && (
                  <div className="flex flex-col gap-2 mt-1">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                      Verification Results:
                    </span>
                    <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {latestReport.checks.map((chk) => (
                        <div
                          key={chk.id}
                          className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] font-mono flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium truncate max-w-[200px]">
                              {chk.name}
                            </span>
                            <span
                              className={`text-[9.5px] font-bold ${
                                chk.status === 'PASS'
                                  ? 'text-emerald-400'
                                  : chk.status === 'WARNING'
                                  ? 'text-amber-400'
                                  : chk.status === 'FAIL'
                                  ? 'text-red-400'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {chk.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-sans leading-tight">
                            {chk.details}
                          </p>
                          {chk.recoverySuggestion && (
                            <p className="text-[9.5px] text-[#C9A15B] font-sans mt-0.5">
                              {chk.recoverySuggestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedReport ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#C9A15B]" />
                            <span>COPY AUDIT</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          clearDiagnosticLogs();
                          setLatestReport(null);
                        }}
                        className="text-neutral-500 hover:text-red-400 cursor-pointer"
                      >
                        CLEAR LOGS
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Developer Sandbox (Discreetly Preserved) */}
              <div className="rounded-[20px] p-3.5 bg-[#141417]/60 border border-white/[0.05] text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setDevToolsOpen(!devToolsOpen)}
                  className="w-full flex items-center justify-between text-neutral-400 hover:text-white cursor-pointer"
                >
                  <span>DEVELOPER FIXTURES</span>
                  <span>{devToolsOpen ? '▲' : '▼'}</span>
                </button>

                {devToolsOpen && (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-col gap-2">
                    <p className="text-[10px] text-neutral-500 font-sans">
                      Test isolated media states. Real data is safeguarded in memory.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSandbox('Case A')}
                        className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono cursor-pointer transition-colors ${
                          sandboxActive
                            ? 'bg-[#C9A15B]/20 text-[#F5D89A] border-[#C9A15B]'
                            : 'bg-white/[0.03] text-neutral-300 border-white/[0.06]'
                        }`}
                      >
                        {sandboxActive ? 'RESTORE REAL DATA' : 'TEST SCENARIOS'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {/* =================================================================
              SUBVIEW 2: MEDIA LIBRARIES SCREEN
              ================================================================= */}
          {activeView === 'media' ? (
            <motion.div
              key="subview-media"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveView('main')}
                  className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>SETTINGS</span>
                </button>
                <span className="text-xs font-mono font-bold tracking-wider text-[#C9A15B] uppercase">
                  MEDIA LIBRARIES
                </span>
              </div>

              {/* Real Library Status */}
              <div className="rounded-[24px] p-5 bg-[#141417] border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.6)] flex flex-col gap-3">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-xs font-mono text-neutral-300">Phonk Audio Vault</span>
                  <span className="text-xs font-mono text-[#C9A15B] font-bold">
                    {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-xs font-mono text-neutral-300">Image Gallery</span>
                  <span className="text-xs font-mono text-[#C9A15B] font-bold">
                    {images.length} {images.length === 1 ? 'image' : 'images'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-mono text-neutral-300">Storage Architecture</span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    INDEXEDDB + LOCALSTORAGE
                  </span>
                </div>
              </div>

              {/* Integrity & Inspection Controls */}
              <div className="rounded-[24px] p-5 bg-[#141417] border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.6)] flex flex-col gap-3">
                <span className="text-[10.5px] font-mono text-neutral-400 uppercase tracking-wider">
                  Integrity Maintenance
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleValidateConsistency}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-mono text-neutral-200 cursor-pointer transition-colors border border-white/[0.06]"
                  >
                    Validate Integrity
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInspecting(!isInspecting)}
                    className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-mono text-neutral-200 cursor-pointer transition-colors border border-white/[0.06]"
                  >
                    {isInspecting ? 'Hide Items' : 'Inspect'}
                  </button>
                </div>

                {consistencyResult && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] text-xs font-mono text-neutral-300 flex flex-col gap-2">
                    <p>{consistencyResult}</p>
                    {consistencyResult.includes('invalid') && (
                      <button
                        type="button"
                        onClick={() => setShowPurgeConfirm(true)}
                        className="py-1 px-2.5 rounded-lg bg-red-500/20 text-red-400 text-[10.5px] font-bold self-start cursor-pointer hover:bg-red-500/30"
                      >
                        Purge Invalid Records
                      </button>
                    )}
                  </div>
                )}

                {/* Inspect List */}
                {isInspecting && (
                  <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] text-[10.5px] font-mono max-h-48 overflow-y-auto flex flex-col gap-1.5">
                    <span className="text-neutral-500 uppercase font-bold text-[9.5px]">Audio:</span>
                    {songs.length === 0 ? (
                      <span className="text-neutral-600">No tracks</span>
                    ) : (
                      songs.map((s, idx) => (
                        <div key={s.id} className="text-neutral-300 truncate">
                          #{idx + 1}: {s.title}
                        </div>
                      ))
                    )}
                    <span className="text-neutral-500 uppercase font-bold text-[9.5px] mt-2">Images:</span>
                    {images.length === 0 ? (
                      <span className="text-neutral-600">No images</span>
                    ) : (
                      images.map((img, idx) => (
                        <div key={img.id} className="text-neutral-300 truncate">
                          #{idx + 1}: {img.title || img.id}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Purge Confirmation Modal */}
                {showPurgeConfirm && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs font-mono flex flex-col gap-2">
                    <span className="text-red-400 font-bold">CONFIRM PURGE:</span>
                    <p className="text-neutral-300 text-[11px] font-sans">
                      This removes invalid or broken records only. Valid media is never deleted.
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setShowPurgeConfirm(false)}
                        className="px-2.5 py-1 rounded bg-white/[0.08] text-neutral-300 text-[10.5px] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handlePurgeInvalid}
                        className="px-2.5 py-1 rounded bg-red-500 text-white font-bold text-[10.5px] cursor-pointer"
                      >
                        Confirm Purge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}

          {/* =================================================================
              SUBVIEW 3: APPEARANCE SCREEN
              ================================================================= */}
          {activeView === 'appearance' ? (
            <motion.div
              key="subview-appearance"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveView('main')}
                  className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>SETTINGS</span>
                </button>
                <span className="text-xs font-mono font-bold tracking-wider text-[#C9A15B] uppercase">
                  APPEARANCE
                </span>
              </div>

              {/* Appearance Controls */}
              <div className="rounded-[24px] p-5 bg-[#141417] border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.6)] flex flex-col gap-4 text-xs font-mono">
                {/* Reduced Motion */}
                <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                  <div>
                    <p className="text-white font-medium">Motion Effects</p>
                    <p className="text-[10.5px] text-neutral-500">Particle & liquid ribbon</p>
                  </div>
                  <select
                    value={preferences.reducedMotion}
                    onChange={(e) =>
                      updatePreference('reducedMotion', e.target.value as AdvancedPreferences['reducedMotion'])
                    }
                    className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#C9A15B] cursor-pointer"
                  >
                    <option value="system">System Default</option>
                    <option value="always">Reduced</option>
                    <option value="never">Full Motion</option>
                  </select>
                </div>

                {/* Visual Quality */}
                <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                  <div>
                    <p className="text-white font-medium">Visual Quality</p>
                    <p className="text-[10.5px] text-neutral-500">Pixel sampling density</p>
                  </div>
                  <select
                    value={preferences.visualQuality}
                    onChange={(e) =>
                      updatePreference('visualQuality', e.target.value as AdvancedPreferences['visualQuality'])
                    }
                    className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-[#C9A15B] cursor-pointer"
                  >
                    <option value="high">High (Retina)</option>
                    <option value="medium">Balanced</option>
                    <option value="safe">Safe (Canvas2D)</option>
                  </select>
                </div>

                {/* Haptics */}
                <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                  <div>
                    <p className="text-white font-medium">Haptic Feedback</p>
                    <p className="text-[10.5px] text-neutral-500">
                      {hasVibrate ? 'Supported on hardware' : 'Unsupported on this device'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!hasVibrate}
                    checked={preferences.hapticsEnabled && hasVibrate}
                    onChange={(e) => updatePreference('hapticsEnabled', e.target.checked)}
                    className="cursor-pointer accent-[#C9A15B] w-4 h-4"
                  />
                </div>

                {/* Safe Mode */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-white font-medium">Safe Mode</p>
                    <p className="text-[10.5px] text-neutral-500">Disable complex shaders safely</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.safeMode}
                    onChange={(e) => updatePreference('safeMode', e.target.checked)}
                    className="cursor-pointer accent-emerald-500 w-4 h-4"
                  />
                </div>
              </div>
            </motion.div>
          ) : null}

          {/* =================================================================
              SUBVIEW 4: DATA & RECOVERY SCREEN
              ================================================================= */}
          {activeView === 'data' ? (
            <motion.div
              key="subview-data"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* Back Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <button
                  type="button"
                  onClick={() => setActiveView('main')}
                  className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>SETTINGS</span>
                </button>
                <span className="text-xs font-mono font-bold tracking-wider text-[#C9A15B] uppercase">
                  DATA & RECOVERY
                </span>
              </div>

              {/* Backup Actions */}
              <div className="rounded-[24px] p-5 bg-[#141417] border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.6)] flex flex-col gap-3">
                <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                  Export settings and alarms to a versioned JSON backup, or restore an existing configuration safely.
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-mono text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-white/[0.06]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C9A15B]" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => backupInputRef.current?.click()}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-mono text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-white/[0.06]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#C9A15B]" />
                    <span>Restore JSON</span>
                  </button>
                </div>

                {backupFeedback && (
                  <p className="text-xs font-mono text-emerald-400 text-center mt-1">
                    {backupFeedback}
                  </p>
                )}

                {/* Restore Preview Confirmation */}
                {backupPreview && (
                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/[0.1] text-xs font-mono flex flex-col gap-2 mt-2">
                    <span className="text-[#C9A15B] font-bold">CONFIRM RESTORE:</span>
                    <p className="text-neutral-300 text-[11px] font-sans">
                      Package v{backupPreview.schemaVersion} ({backupPreview.metadataSummary.audioCount} audio, {backupPreview.metadataSummary.imageCount} image refs).
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setBackupPreview(null)}
                        className="px-2.5 py-1 rounded bg-white/[0.08] text-neutral-300 text-[10.5px] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyBackup}
                        className="px-3 py-1 rounded bg-[#C9A15B] text-black font-bold text-[10.5px] cursor-pointer"
                      >
                        Apply Restore
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};
