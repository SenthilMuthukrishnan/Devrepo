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
  ShieldCheck,
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
import { captureVideoSnapshot, loadFaceModels, readFace } from '../../utils/faceEngine';
import { FaceEnrollmentModal } from './FaceEnrollmentModal';

interface CameraKioskModuleProps {
  onPunchRecorded?: () => void;
}

type PunchMode = 'CHECK_IN' | 'CHECK_OUT';

interface PunchAvailability {
  canCheckIn: boolean;
  canCheckOut: boolean;
  badge: string;
  hint: string;
}

/**
 * What the employee is allowed to do right now, derived from today's
 * attendance log. A face scan only ever *identifies* the employee — the
 * actual punch is recorded only when they press a Punch In / Punch Out button.
 */
function getPunchAvailability(emp: EmployeeRecord | null): PunchAvailability {
  if (!emp) {
    return {
      canCheckIn: false,
      canCheckOut: false,
      badge: 'NO EMPLOYEE',
      hint: 'Scan your face (or pick an employee below) to start.',
    };
  }

  switch (emp.today_status) {
    case 'NOT_CHECKED_IN':
      return {
        canCheckIn: true,
        canCheckOut: false,
        badge: 'NOT CHECKED IN',
        hint: 'Not checked in today — press Punch In to start the shift.',
      };
    case 'PRESENT':
    case 'LATE':
      return {
        canCheckIn: false,
        canCheckOut: true,
        badge: `CHECKED IN ${emp.check_in_time ?? ''}`.trim(),
        hint: `Already checked in at ${emp.check_in_time} — press Punch Out when you leave.`,
      };
    case 'CHECKED_OUT':
      return {
        canCheckIn: false,
        canCheckOut: false,
        badge: 'SHIFT COMPLETE',
        hint: `Shift completed — checked out at ${emp.check_out_time}. No punch needed.`,
      };
    case 'ON_LEAVE':
      return {
        canCheckIn: false,
        canCheckOut: false,
        badge: 'ON LEAVE',
        hint: 'On approved leave today — no punch needed.',
      };
    default:
      return {
        canCheckIn: false,
        canCheckOut: false,
        badge: String(emp.today_status).replace(/_/g, ' '),
        hint: 'No punch available for this employee today.',
      };
  }
}

export const CameraKioskModule: React.FC<CameraKioskModuleProps> = ({ onPunchRecorded }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mirrored, setMirrored] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStatusMsg, setCameraStatusMsg] = useState('Initializing mobile camera...');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [simulatedOtHours, setSimulatedOtHours] = useState<number>(9.5);

  // Face scan = identity verification only. It never records a punch.
  const [verifying, setVerifying] = useState(false);
  const [verifiedEmployee, setVerifiedEmployee] = useState<EmployeeRecord | null>(null);
  const [verifiedConfidence, setVerifiedConfidence] = useState<number | null>(null);
  // Which button is currently saving ('CHECK_IN' | 'CHECK_OUT' | null)
  const [pendingPunch, setPendingPunch] = useState<PunchMode | null>(null);

  const [faceDetectedInFrame, setFaceDetectedInFrame] = useState(false);
  const [lastPunchResult, setLastPunchResult] = useState<PunchResponse | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [recentPunches, setRecentPunches] = useState<PunchEvent[]>([]);

  const [empSearch, setEmpSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [totalMatchedEmployees, setTotalMatchedEmployees] = useState(0);
  const [selectedTestEmployee, setSelectedTestEmployee] = useState<EmployeeRecord | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Guards the identify-once-per-face-presentation behaviour.
  const autoVerifyLockRef = useRef(false);
  const lastAutoVerifyAtRef = useRef(0);

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

  // Warm the on-device models as soon as the camera opens so the first scan is
  // not stuck waiting on a 6.8 MB download.
  useEffect(() => {
    if (!cameraActive) return;
    loadFaceModels().catch((error) => {
      setPunchError(error instanceof Error ? error.message : 'Could not load face models.');
    });
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive) return;
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const res = analyzeVideoFrame(videoRef.current);
        setFaceDetectedInFrame(res.faceDetected);
      }
    }, 900);
    return () => clearInterval(interval);
  }, [cameraActive]);

  // AUTOMATIC: recognise the face in front of the camera, then stop.
  // This only identifies the employee and reads their attendance state so the
  // kiosk can tell them which button applies (Punch In or Punch Out).
  // It NEVER records a punch — that requires an explicit button press.
  useEffect(() => {
    if (!cameraActive) {
      autoVerifyLockRef.current = false;
      return;
    }
    if (!faceDetectedInFrame) {
      autoVerifyLockRef.current = false;
      return;
    }
    if (autoVerifyLockRef.current || verifying || verifiedEmployee) return;
    if (Date.now() - lastAutoVerifyAtRef.current < 5000) return;

    const timer = setTimeout(() => {
      autoVerifyLockRef.current = true;
      lastAutoVerifyAtRef.current = Date.now();
      verifyFace();
    }, 900);
    return () => clearTimeout(timer);
  }, [faceDetectedInFrame, cameraActive, verifying, verifiedEmployee]);

  // Once the face leaves the frame for a moment, forget the verified employee
  // so the next person who steps up gets identified from scratch.
  useEffect(() => {
    if (!cameraActive || faceDetectedInFrame || !verifiedEmployee) return;
    const timer = setTimeout(() => {
      setVerifiedEmployee(null);
      setVerifiedConfidence(null);
      autoVerifyLockRef.current = false;
    }, 3000);
    return () => clearTimeout(timer);
  }, [faceDetectedInFrame, cameraActive, verifiedEmployee]);

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

      if (selectedTestEmployee) {
        const refreshed = empData.employees.find((e) => e.id === selectedTestEmployee.id);
        if (refreshed) setSelectedTestEmployee(refreshed);
      }

      // Keep the verified identity in sync with the freshly loaded status so
      // the recommended action flips from Punch In to Punch Out after a punch.
      setVerifiedEmployee((prev) =>
        prev ? empData.employees.find((e) => e.id === prev.id) ?? prev : prev
      );
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

  /**
   * Identify whoever is in front of the camera (or the employee selected in
   * the list). Records NO attendance — it only answers the question
   * "who is this, and have they already checked in today?".
   */
  const verifyFace = async (targetEmployee?: EmployeeRecord | null) => {
    if (verifying) return;
    setVerifying(true);
    setPunchError(null);

    try {
      const video = videoRef.current;
      if (!cameraActive || !video || video.readyState < 2) {
        setVerifiedEmployee(null);
        setVerifiedConfidence(null);
        setPunchError(
          'Camera is not running. Allow camera access, then scan again — or use Manual Punch and pick your name.'
        );
        return;
      }

      // Real 128-D face embedding from the live frame. No employee is ever
      // sent along with it, so the server cannot return a preselected person.
      const reading = await readFace(video);
      if (!reading) {
        setVerifiedEmployee(null);
        setVerifiedConfidence(null);
        setPunchError(
          'No face detected. Center your face in the frame, in good light, and scan again.'
        );
        return;
      }

      const matchRes = await matchEmployeeFace({ descriptor: reading.descriptor });

      if (!matchRes.matched || !matchRes.employee) {
        setVerifiedEmployee(null);
        setVerifiedConfidence(null);
        setPunchError(
          matchRes.message ||
            'Face not recognised. Center your face in the frame and scan again.'
        );
        return;
      }

      const matchedEmp = matchRes.employee as EmployeeRecord;
      const availability = getPunchAvailability(matchedEmp);

      setVerifiedEmployee(matchedEmp);
      setVerifiedConfidence(matchRes.confidence);

      const spoken =
        availability.canCheckIn
          ? `Verified ${matchedEmp.full_name}. You are not checked in today. Press punch in to start your shift.`
          : availability.canCheckOut
          ? `Verified ${matchedEmp.full_name}. Checked in at ${matchedEmp.check_in_time}. Press punch out when you leave.`
          : availability.hint;
      speakAttendanceAnnouncement(spoken, voiceEnabled);
    } catch (error) {
      console.error('Face verification failed:', error);
      setPunchError(
        error instanceof Error ? error.message : 'Face verification failed. Please try again.'
      );
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Record a punch for an *explicit* user action (Punch In / Punch Out button,
   * or the quick buttons in the employee list). Never called automatically.
   */
  const handlePunch = async (
    mode: PunchMode,
    targetEmployee?: EmployeeRecord | null
  ) => {
    if (pendingPunch) return;

    const target = targetEmployee ?? verifiedEmployee ?? selectedTestEmployee;
    if (!target) {
      setPunchError('Scan a face or select an employee before punching.');
      return;
    }

    const availability = getPunchAvailability(target);
    if (mode === 'CHECK_IN' && !availability.canCheckIn) {
      setPunchError(`${target.full_name}: ${availability.hint}`);
      return;
    }
    if (mode === 'CHECK_OUT' && !availability.canCheckOut) {
      setPunchError(`${target.full_name}: ${availability.hint}`);
      return;
    }

    setPendingPunch(mode);
    setPunchError(null);

    try {
      let snapshotUrl: string | null = null;
      if (cameraActive && videoRef.current) {
        snapshotUrl = captureVideoSnapshot(videoRef.current) || null;
      }

      const confidence =
        verifiedEmployee && verifiedEmployee.id === target.id && verifiedConfidence
          ? verifiedConfidence
          : 99;

      const punchRes = await recordBiometricPunch({
        employeeId: target.id,
        mode,
        confidenceScore: confidence,
        deviceLabel: cameraActive
          ? `Android Mobile Cam (${facingMode === 'user' ? 'Front' : 'Rear'})`
          : 'Android Mobile Terminal',
        snapshotUrl,
        // Only a check-out needs a work duration (overtime calculation).
        simulatedWorkHours: mode === 'CHECK_OUT' ? simulatedOtHours : null,
      });

      setLastPunchResult(punchRes);
      playBiometricChime(punchRes.punchType);

      const spokenAction =
        punchRes.punchType === 'CHECK_IN'
          ? `Verified. Welcome ${punchRes.employee.full_name}. Checked in at ${punchRes.punchTime}.`
          : `Verified. Goodbye ${punchRes.employee.full_name}. Checked out. Total work ${punchRes.workHours} hours, overtime ${punchRes.overtimeHours} hours.`;

      speakAttendanceAnnouncement(spokenAction, voiceEnabled);

      // Reflect the new state immediately on the verified card so the kiosk
      // recommends the next valid action instead of repeating this one.
      setVerifiedEmployee((prev) =>
        prev && prev.id === target.id
          ? {
              ...prev,
              today_status: punchRes.status as EmployeeRecord['today_status'],
              check_in_time:
                punchRes.punchType === 'CHECK_IN'
                  ? punchRes.punchTime
                  : punchRes.checkInTime ?? prev.check_in_time,
              check_out_time:
                punchRes.punchType === 'CHECK_OUT' ? punchRes.punchTime : null,
              work_hours: punchRes.workHours,
              overtime_hours: punchRes.overtimeHours,
            }
          : prev
      );

      await loadDirectoryAndPunches(empSearch, statusFilter);
      if (onPunchRecorded) onPunchRecorded();
    } catch (error) {
      console.error('Punch failed:', error);
      setPunchError(
        error instanceof Error
          ? error.message
          : 'Punch could not be completed. Please try again.'
      );
    } finally {
      setPendingPunch(null);
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
            {/* Scan (verify only) + Camera Flip */}
            <div className="p-2.5 border-b border-hairline/80 bg-elevated/60 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => verifyFace(selectedTestEmployee)}
                  disabled={verifying}
                  title="Identify the employee and read today's punch status (records no attendance)"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60 transition cursor-pointer"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  {verifying ? 'Scanning…' : 'Scan Face'}
                </button>
                {verifiedEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedEmployee(null);
                      setVerifiedConfidence(null);
                      autoVerifyLockRef.current = false;
                    }}
                    title="Clear the verified employee"
                    className="p-1.5 rounded-lg bg-control hover:bg-control-hover text-muted border border-hairline-strong transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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
                    <span>
                      {verifiedEmployee && verifiedConfidence !== null
                        ? `MATCH: ${verifiedConfidence}%`
                        : cameraActive
                        ? 'READY TO SCAN'
                        : 'CAMERA OFF'}
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-inset/80 border border-hairline text-body">
                    {verifiedEmployee
                      ? 'IDENTIFIED'
                      : cameraActive
                      ? 'CAMERA ON'
                      : 'CAMERA OFF'}
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

            {/* Punch Action Bar — punches are recorded ONLY from these buttons */}
            <div className="p-3 bg-elevated/95 border-t border-hairline space-y-2.5">
              {(() => {
                const punchTarget = verifiedEmployee ?? selectedTestEmployee;
                const availability = getPunchAvailability(punchTarget);

                return (
                  <>
                    {/* Verified / selected employee + recommended action */}
                    <div
                      className={`rounded-xl border px-3 py-2 ${
                        verifiedEmployee
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-hairline bg-inset/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                          {verifiedEmployee ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                              Face verified
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 text-warn" />
                              Not scanned yet
                            </>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-faint shrink-0">
                          {availability.badge}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="text-sm font-bold text-ink truncate">
                          {punchTarget ? punchTarget.full_name : 'No employee selected'}
                        </span>
                        {punchTarget && (
                          <span className="text-[10px] font-mono text-muted shrink-0">
                            {punchTarget.emp_code}
                            {verifiedEmployee && verifiedConfidence
                              ? ` • ${verifiedConfidence}%`
                              : ''}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-body mt-1 leading-snug">{availability.hint}</p>
                    </div>

                    {/* Work duration — only relevant when punching out */}
                    {availability.canCheckOut && (
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

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePunch('CHECK_IN')}
                        disabled={pendingPunch !== null || verifying || !availability.canCheckIn}
                        title={
                          availability.canCheckIn
                            ? `Punch in ${punchTarget?.full_name ?? ''}`
                            : availability.hint
                        }
                        className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>{pendingPunch === 'CHECK_IN' ? 'Saving…' : 'Punch In'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePunch('CHECK_OUT')}
                        disabled={pendingPunch !== null || verifying || !availability.canCheckOut}
                        title={
                          availability.canCheckOut
                            ? `Punch out ${punchTarget?.full_name ?? ''}`
                            : availability.hint
                        }
                        className="inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{pendingPunch === 'CHECK_OUT' ? 'Saving…' : 'Punch Out'}</span>
                      </button>
                    </div>

                    <div className="text-center text-[11px] font-semibold text-muted bg-inset border border-hairline rounded-xl px-3 py-1.5">
                      <ScanFace className="w-3 h-3 inline mr-1 text-accent" />
                      Face scan only verifies identity — attendance is recorded when you press Punch
                      In or Punch Out.
                    </div>
                  </>
                );
              })()}
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

        {/* Manual employee selector & live stream */}
        <div className="@md:col-span-5 space-y-3">
          <div className="rounded-2xl border border-hairline/90 bg-panel p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-ink">
                  Manual Punch (no face)
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
                placeholder="Search by code or name..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-inset border border-hairline text-ink placeholder-faint focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: 'ALL', label: `All (${totalMatchedEmployees})` },
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
                          title={
                            getPunchAvailability(emp).canCheckIn
                              ? `Punch in ${emp.full_name}`
                              : getPunchAvailability(emp).hint
                          }
                          disabled={pendingPunch !== null || !getPunchAvailability(emp).canCheckIn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTestEmployee(emp);
                            handlePunch('CHECK_IN', emp);
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <LogIn className="w-3 h-3" />
                          In
                        </button>
                        <button
                          type="button"
                          title={
                            getPunchAvailability(emp).canCheckOut
                              ? `Punch out ${emp.full_name}`
                              : getPunchAvailability(emp).hint
                          }
                          disabled={pendingPunch !== null || !getPunchAvailability(emp).canCheckOut}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTestEmployee(emp);
                            handlePunch('CHECK_OUT', emp);
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
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
