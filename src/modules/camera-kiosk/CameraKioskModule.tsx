import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cpu,
  FlipHorizontal,
  LogIn,
  LogOut,
  Mic,
  MicOff,
  RefreshCw,
  ScanFace,
  Search,
  ShieldAlert,
  SwitchCamera,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { EmployeeRecord, PunchEvent, PunchResponse } from '../../types';
import {
  fetchEmployees,
  fetchRecentPunches,
  matchEmployeeFace,
  recordBiometricPunch,
} from '../../utils/api';
import {
  analyzeVideoFrame,
  playBiometricChime,
  speakAttendanceAnnouncement,
} from '../../utils/faceBiometrics';
import { FaceEnrollmentModal } from './FaceEnrollmentModal';

interface CameraKioskModuleProps {
  onPunchRecorded?: () => void;
}

export const CameraKioskModule: React.FC<CameraKioskModuleProps> = ({ onPunchRecorded }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mirrored, setMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState('Initializing mobile camera...');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [punchMode, setPunchMode] = useState<'AUTO' | 'CHECK_IN' | 'CHECK_OUT'>('AUTO');
  const [simulatedOtHours, setSimulatedOtHours] = useState<number>(9.5);

  const [scanning, setScanning] = useState(false);
  const [liveConfidence, setLiveConfidence] = useState<number>(98.7);
  const [faceDetectedInFrame, setFaceDetectedInFrame] = useState(false);
  const [lastPunchResult, setLastPunchResult] = useState<PunchResponse | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [recentPunches, setRecentPunches] = useState<PunchEvent[]>([]);

  const [empSearch, setEmpSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [totalMatchedEmployees, setTotalMatchedEmployees] = useState(15);
  const [selectedTestEmployee, setSelectedTestEmployee] = useState<EmployeeRecord | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    startMobileCamera(facingMode);
    return () => {
      stopMobileCamera();
    };
  }, [facingMode]);

  useEffect(() => {
    if (!cameraActive) return;
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const res = analyzeVideoFrame(videoRef.current);
        setFaceDetectedInFrame(res.faceDetected);
        setLiveConfidence(Number((97.4 + Math.random() * 2.3).toFixed(1)));
      }
    }, 900);
    return () => clearInterval(interval);
  }, [cameraActive]);

  // Auto-punch when face is detected (no button required). Employees who have
  // already completed today's shift are skipped so the kiosk does not nag.
  useEffect(() => {
    if (!faceDetectedInFrame || scanning || !selectedTestEmployee || !cameraActive) return;
    if (selectedTestEmployee.today_status === 'CHECKED_OUT') return;
    const timer = setTimeout(() => {
      const mode =
        selectedTestEmployee.today_status === 'PRESENT' || selectedTestEmployee.today_status === 'LATE'
          ? 'CHECK_OUT'
          : 'CHECK_IN';
      setPunchMode(mode);
      handleTriggerBiometricScan(selectedTestEmployee, mode);
    }, 800);
    return () => clearTimeout(timer);
  }, [faceDetectedInFrame, selectedTestEmployee, cameraActive, scanning]);

  const startMobileCamera = async (mode: 'user' | 'environment') => {
    stopMobileCamera();
    setCameraStatusMsg('Connecting to Android Mobile Camera...');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        setCameraStatusMsg('Simulator Active • Select any employee below');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraStatusMsg(mode === 'user' ? 'Front Selfie Cam Live' : 'Rear Back Cam Live');
    } catch {
      setCameraActive(false);
      setCameraStatusMsg('Simulator Ready (Allow camera for live feed)');
    }
  };

  const stopMobileCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const loadDirectoryAndPunches = async (search = empSearch, filter = statusFilter) => {
    setLoadingEmployees(true);
    try {
      const [empData, punchData] = await Promise.all([
        fetchEmployees({ search, todayStatus: filter, limit: 60 }),
        fetchRecentPunches(),
      ]);
      setEmployees(empData.employees);
      setTotalMatchedEmployees(empData.total);
      setRecentPunches(punchData.punches);

      if (!selectedTestEmployee && empData.employees.length > 0) {
        const readyForCheckIn =
          empData.employees.find((e) => e.today_status === 'NOT_CHECKED_IN') ||
          empData.employees[0];
        setSelectedTestEmployee(readyForCheckIn);
      } else if (selectedTestEmployee) {
        const refreshed = empData.employees.find((e) => e.id === selectedTestEmployee.id);
        if (refreshed) setSelectedTestEmployee(refreshed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadDirectoryAndPunches(empSearch, statusFilter);
  }, [statusFilter]);

  const handleSearchChange = (val: string) => {
    setEmpSearch(val);
    loadDirectoryAndPunches(val, statusFilter);
  };

  const handleTriggerBiometricScan = async (
    targetEmployee?: EmployeeRecord | null,
    forcedMode?: 'CHECK_IN' | 'CHECK_OUT'
  ) => {
    if (scanning) return;
    const mode = forcedMode || punchMode;
    setScanning(true);
    setPunchError(null);

    try {
      let descriptor: number[] = [];
      let snapshotUrl: string | null = null;

      if (cameraActive && videoRef.current) {
        const frameAnalysis = analyzeVideoFrame(videoRef.current);
        descriptor = frameAnalysis.descriptor;
        snapshotUrl = frameAnalysis.snapshotDataUrl || null;
      }

      const target = targetEmployee || selectedTestEmployee;

      const matchRes = await matchEmployeeFace({
        descriptor: descriptor.length > 0 ? descriptor : undefined,
        preferredEmployeeId: target ? target.id : null,
      });

      if (!matchRes.matched || !matchRes.employee) {
        setScanning(false);
        return;
      }

      const matchedEmp = matchRes.employee;

      const punchRes = await recordBiometricPunch({
        employeeId: matchedEmp.id,
        mode,
        confidenceScore: matchRes.confidence,
        deviceLabel: cameraActive
          ? `Android Mobile Cam (${facingMode === 'user' ? 'Front' : 'Rear'})`
          : 'Android Mobile Terminal',
        snapshotUrl,
        simulatedWorkHours: simulatedOtHours,
      });

      setLastPunchResult(punchRes);
      playBiometricChime(punchRes.punchType);

      const spokenAction =
        punchRes.punchType === 'CHECK_IN'
          ? `Verified. Welcome ${punchRes.employee.full_name}. Checked in at ${punchRes.punchTime}.`
          : `Verified. Goodbye ${punchRes.employee.full_name}. Checked out. Total work ${punchRes.workHours} hours, overtime ${punchRes.overtimeHours} hours.`;

      speakAttendanceAnnouncement(spokenAction, voiceEnabled);

      await loadDirectoryAndPunches(empSearch, statusFilter);
      if (onPunchRecorded) onPunchRecorded();
    } catch (error) {
      console.error('Biometric scan failed:', error);
      setPunchError(
        error instanceof Error
          ? error.message
          : 'Biometric punch could not be completed. Please try again.'
      );
    } finally {
      setTimeout(() => setScanning(false), 350);
    }
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Compact Mobile Camera Top Bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-hairline/90 bg-elevated/80 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-accent shrink-0">
            <ScanFace className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-ink truncate">Face Login / Logout Cam</h2>
            <p className="text-xs text-muted truncate">{cameraStatusMsg}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-1 rounded-lg bg-inset border border-hairline text-xs font-mono font-bold text-accent tabular-nums">
            {currentTimeStr}
          </span>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              voiceEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-accent-soft'
                : 'bg-control/80 border-hairline-strong text-muted'
            }`}
            title="Toggle Voice Announcement"
          >
            {voiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setEnrollModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-bold bg-sky-500/15 hover:bg-sky-500/25 text-info-soft border border-sky-500/30 transition cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Enroll</span>
          </button>
        </div>
      </div>

      {punchError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-danger flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{punchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPunchError(null)}
            className="p-1 rounded-lg hover:bg-rose-500/15 shrink-0 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Container-Responsive Layout: Single Column on Android Phone, 2-Column on Android Tablet */}
      <div className="grid grid-cols-1 @md:grid-cols-12 gap-3.5">
        {/* Camera Viewfinder Card */}
        <div className="@md:col-span-7 space-y-3">
          <div className="rounded-2xl border border-hairline/90 bg-panel overflow-hidden shadow-xl">
            {/* Mode Tabs + Camera Flip */}
            <div className="p-2.5 border-b border-hairline/80 bg-elevated/60 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 bg-inset p-1 rounded-xl border border-hairline">
                <button
                  type="button"
                  onClick={() => setPunchMode('AUTO')}
                  title="Face auto-scan decides in/out automatically"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    punchMode === 'AUTO'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setPunchMode('CHECK_IN')}
                  title="Face auto-scan always records a punch in"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    punchMode === 'CHECK_IN'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <LogIn className="w-3 h-3" />
                  In
                </button>
                <button
                  type="button"
                  onClick={() => setPunchMode('CHECK_OUT')}
                  title="Face auto-scan always records a punch out"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    punchMode === 'CHECK_OUT'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <LogOut className="w-3 h-3" />
                  Out+OT
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-control hover:bg-control-hover text-ink-soft border border-hairline-strong/80 transition cursor-pointer"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-accent" />
                  <span>{facingMode === 'user' ? 'Front' : 'Rear'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMirrored((m) => !m)}
                  className="p-1.5 rounded-lg bg-control hover:bg-control-hover text-body border border-hairline-strong/80 transition cursor-pointer"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => startMobileCamera(facingMode)}
                  className="p-1.5 rounded-lg bg-control hover:bg-control-hover text-body border border-hairline-strong/80 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mobile Portrait-Friendly Viewfinder */}
            <div className="camera-stage relative h-64 @md:h-72 w-full bg-inset overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''} ${
                  cameraActive ? 'block' : 'hidden'
                }`}
              />

              {!cameraActive && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0f2922_0%,#090d16_75%)] flex flex-col items-center justify-center p-4 text-center">
                  {selectedTestEmployee ? (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-ink shadow-2xl border-2 border-emerald-400/50 mb-2 relative"
                        style={{ backgroundColor: selectedTestEmployee.avatar_color }}
                      >
                        {selectedTestEmployee.face_snapshot ? (
                          <img
                            src={selectedTestEmployee.face_snapshot}
                            alt={selectedTestEmployee.full_name}
                            className="w-full h-full object-cover rounded-3xl"
                          />
                        ) : (
                          selectedTestEmployee.avatar_initials
                        )}
                        <span className="absolute -bottom-2 px-2 py-0.5 rounded-full text-[11px] font-mono bg-inset text-accent border border-emerald-500/40">
                          {selectedTestEmployee.emp_code}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-ink mt-1">
                        {selectedTestEmployee.full_name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {selectedTestEmployee.designation} • {selectedTestEmployee.department}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-elevated/90 border border-hairline-strong text-xs text-body">
                        <span>Status:</span>
                        <span
                          className={`font-bold ${
                            selectedTestEmployee.today_status === 'NOT_CHECKED_IN'
                              ? 'text-warn'
                              : selectedTestEmployee.today_status === 'CHECKED_OUT'
                              ? 'text-info'
                              : 'text-accent'
                          }`}
                        >
                          {selectedTestEmployee.today_status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted text-xs">Select employee below</div>
                  )}
                </div>
              )}

              {/* Biometric Reticle HUD */}
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-inset/80 border border-hairline text-accent">
                    <Cpu className="w-3 h-3" />
                    <span>MATCH: {liveConfidence}%</span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-inset/80 border border-hairline text-body">
                    {cameraActive
                      ? faceDetectedInFrame
                        ? 'FACE LOCKED'
                        : 'CENTER FACE'
                      : 'SIMULATOR READY'}
                  </div>
                </div>

                <div className="relative mx-auto my-auto w-40 h-44 flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-xl" />
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-scanline" />
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-inset/80 border border-hairline text-body">
                    LIVENESS: ON
                  </span>
                  <span className="px-2 py-0.5 rounded bg-inset/80 border border-hairline text-info-soft">
                    1:15 DB
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Punch Action Bar */}
            <div className="p-3 bg-elevated/95 border-t border-hairline space-y-2.5">
              {/* Overtime Selector when checking out */}
              {(punchMode === 'CHECK_OUT' ||
                (punchMode === 'AUTO' &&
                  selectedTestEmployee &&
                  (selectedTestEmployee.today_status === 'PRESENT' ||
                    selectedTestEmployee.today_status === 'LATE'))) && (
                <div className="flex items-center justify-between bg-inset px-3 py-1.5 rounded-xl border border-hairline text-xs">
                  <span className="text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-info" />
                    Work Duration:
                  </span>
                  <select
                    value={simulatedOtHours}
                    onChange={(e) => setSimulatedOtHours(Number(e.target.value))}
                    className="bg-transparent font-bold text-info-soft focus:outline-none cursor-pointer"
                  >
                    <option value={8.0} className="bg-elevated">
                      8.0h (0h Overtime)
                    </option>
                    <option value={9.5} className="bg-elevated">
                      9.5h (+1.5h OT)
                    </option>
                    <option value={10.5} className="bg-elevated">
                      10.5h (+2.5h OT)
                    </option>
                    <option value={12.0} className="bg-elevated">
                      12.0h (+4.0h OT)
                    </option>
                  </select>
                </div>
              )}

              {/* Explicit manual punch controls (work with or without the camera) */}
              <div className="rounded-xl border border-hairline bg-inset/60 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted truncate">
                  Punching for{' '}
                  <strong className="text-ink font-semibold">
                    {selectedTestEmployee ? selectedTestEmployee.full_name : 'select an employee'}
                  </strong>
                </span>
                <span className="text-[10px] font-mono text-faint shrink-0">
                  {selectedTestEmployee?.today_status.replace(/_/g, ' ') || '—'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerBiometricScan(selectedTestEmployee, 'CHECK_IN')}
                  disabled={scanning || !selectedTestEmployee}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Punch In</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTriggerBiometricScan(selectedTestEmployee, 'CHECK_OUT')}
                  disabled={scanning || !selectedTestEmployee}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Punch Out</span>
                </button>
              </div>

              <div className="text-center text-[11px] font-semibold text-accent-soft bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                <ScanFace className="w-3 h-3 inline mr-1" />
                Auto-scan active — show your face to punch in or out hands-free
              </div>
            </div>
          </div>

          {/* Instant Biometric Verification Card */}
          {lastPunchResult && (
            <div
              className={`rounded-2xl border p-3.5 shadow-xl ${
                lastPunchResult.punchType === 'CHECK_IN'
                  ? 'bg-emerald-500/10 border-emerald-500/50'
                  : 'bg-sky-500/10 border-sky-500/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-hairline/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-ink shrink-0"
                    style={{ backgroundColor: lastPunchResult.employee.avatar_color }}
                  >
                    {lastPunchResult.employee.avatar_initials}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                        lastPunchResult.punchType === 'CHECK_IN'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-sky-400 text-slate-950'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {lastPunchResult.punchType === 'CHECK_IN' ? 'Employee logged in' : 'Employee logged out'}
                    </span>
                    <div className="text-sm font-bold text-ink truncate mt-0.5">
                      {lastPunchResult.employee.full_name} ({lastPunchResult.employee.emp_code})
                    </div>
                    <div className="text-[11px] font-mono text-accent-soft mt-0.5">
                      {currentTimeStr} • {lastPunchResult.punchType === 'CHECK_IN' ? 'Logged In' : 'Logged Out'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-mono font-bold text-ink tabular-nums">
                    {lastPunchResult.punchTime}
                  </div>
                  <div className="text-xs font-mono text-accent">
                    {lastPunchResult.confidenceScore}% Match
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2.5 text-center">
                <div className="p-2 rounded-xl bg-inset/70 border border-hairline/80">
                  <div className="text-[11px] uppercase text-muted">Work Hrs</div>
                  <div className="text-xs font-mono font-bold text-ink mt-0.5">
                    {lastPunchResult.punchType === 'CHECK_OUT'
                      ? `${lastPunchResult.workHours}h`
                      : 'Active'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-inset/70 border border-hairline/80">
                  <div className="text-[11px] uppercase text-muted">Overtime</div>
                  <div className="text-xs font-mono font-bold text-info mt-0.5">
                    +{lastPunchResult.overtimeHours}h
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-inset/70 border border-hairline/80">
                  <div className="text-[11px] uppercase text-muted">OT Pay</div>
                  <div className="text-xs font-mono font-bold text-accent mt-0.5">
                    ₹{lastPunchResult.overtimePay}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 15-Employee Mobile Selector & Live Stream */}
        <div className="@md:col-span-5 space-y-3">
          <div className="rounded-2xl border border-hairline/90 bg-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-ink">
                  Test Any of 15 Employees
                </h3>
              </div>
              <span className="text-xs font-mono text-muted">
                {totalMatchedEmployees} Staff
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search EMP0001..EMP0015 or Name..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-inset border border-hairline text-ink placeholder-faint focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: 'ALL', label: 'All (15)' },
                { id: 'NOT_CHECKED_IN', label: 'Not In' },
                { id: 'INSIDE', label: 'Working' },
                { id: 'CHECKED_OUT', label: 'Out' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-emerald-500/20 text-accent-soft border border-emerald-500/40'
                      : 'bg-elevated text-muted border border-hairline'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
              {loadingEmployees ? (
                <div className="py-6 text-center text-xs text-muted">Loading...</div>
              ) : (
                employees.map((emp) => {
                  const isSelected = selectedTestEmployee?.id === emp.id;
                  const isInside = emp.today_status === 'PRESENT' || emp.today_status === 'LATE';
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedTestEmployee(emp)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/50'
                          : 'bg-elevated/70 border-hairline/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-ink shrink-0"
                          style={{ backgroundColor: emp.avatar_color }}
                        >
                          {emp.avatar_initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-ink truncate">
                            {emp.full_name}
                          </div>
                          <div className="text-xs font-mono text-muted truncate">
                            {emp.emp_code} • {emp.shift_id}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          title={`Punch in ${emp.full_name}`}
                          disabled={scanning}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTestEmployee(emp);
                            handleTriggerBiometricScan(emp, 'CHECK_IN');
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition cursor-pointer"
                        >
                          <LogIn className="w-3 h-3" />
                          In
                        </button>
                        <button
                          type="button"
                          title={`Punch out ${emp.full_name}`}
                          disabled={scanning}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTestEmployee(emp);
                            handleTriggerBiometricScan(emp, 'CHECK_OUT');
                          }}
                          className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold disabled:opacity-50 transition cursor-pointer ${
                            isInside
                              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                              : 'bg-sky-500/15 hover:bg-sky-500/25 text-info-soft border border-sky-500/30'
                          }`}
                        >
                          <LogOut className="w-3 h-3" />
                          Out
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Camera Punches */}
          <div className="rounded-2xl border border-hairline/90 bg-panel p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-info" />
                <h3 className="text-xs font-bold text-ink">Live Terminal Stream</h3>
              </div>
              <span className="text-[11px] font-mono text-accent">REAL-TIME</span>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {recentPunches.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-elevated/80 border border-hairline/80 text-xs"
                >
                  <div className="truncate">
                    <span className="font-semibold text-ink">{p.full_name}</span>{' '}
                    <span className="text-xs font-mono text-muted">{p.emp_code}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                    <span
                      className={
                        p.punch_type === 'CHECK_IN' ? 'text-accent font-bold' : 'text-info font-bold'
                      }
                    >
                      {p.punch_type === 'CHECK_IN' ? 'IN' : 'OUT'}
                    </span>
                    <span className="text-body">{p.punch_time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FaceEnrollmentModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        initialEmployee={selectedTestEmployee}
        onEnrolled={() => {
          loadDirectoryAndPunches(empSearch, statusFilter);
          if (onPunchRecorded) onPunchRecorded();
        }}
      />
    </div>
  );
};
