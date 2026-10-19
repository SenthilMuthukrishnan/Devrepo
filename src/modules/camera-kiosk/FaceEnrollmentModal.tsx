import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Search,
  ShieldCheck,
  SwitchCamera,
  UserCheck,
  X,
} from 'lucide-react';
import { EmployeeRecord } from '../../types';
import { enrollEmployeeFace, fetchEmployees } from '../../utils/api';
import { playBiometricChime } from '../../utils/faceBiometrics';
import { averageDescriptors, captureVideoSnapshot, readFace } from '../../utils/faceEngine';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrolled: (employeeId: number) => void;
  initialEmployee?: EmployeeRecord | null;
}

const ANGLE_STEPS = [
  { step: 1, title: 'Front Center Face', hint: 'Look straight into the mobile camera' },
  { step: 2, title: 'Slight Left Profile', hint: 'Turn head 15° left for 3D depth mapping' },
  { step: 3, title: 'Slight Right Profile', hint: 'Turn head 15° right for a third capture' },
];

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onEnrolled,
  initialEmployee = null,
}) => {
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeRecord | null>(initialEmployee);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolledSuccess, setEnrolledSuccess] = useState<string | null>(null);

  // Multi-angle progress
  const [angleIndex, setAngleIndex] = useState<number>(0);
  const [capturedVectors, setCapturedVectors] = useState<number[][]>([]);
  const [capturedVectorPreview, setCapturedVectorPreview] = useState<number[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEmp(initialEmployee);
    setEnrolledSuccess(null);
    setAngleIndex(0);
    setCapturedVectors([]);
    setCapturedVectorPreview([]);
    loadEmployees('');
  }, [isOpen, initialEmployee]);

  const loadEmployees = async (term: string) => {
    try {
      const data = await fetchEmployees({ search: term, limit: 30 });
      setEmployees(data.employees);
      if (!selectedEmp && data.employees.length > 0 && !initialEmployee) {
        const pending = data.employees.find((e) => !e.face_enrolled) || data.employees[0];
        setSelectedEmp(pending);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Using Biometric Synthetic Vector Generator (No physical webcam found).');
        setCameraActive(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
      setCameraError(
        'Camera permission not active. Allow camera access, then capture your face angles. Enrollment requires the camera — it cannot be faked without one.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  /**
   * Capture one real 128-D face embedding from the live camera.
   * There is deliberately NO fallback that invents a vector without a camera:
   * a synthetic vector cannot identify anyone and used to make every scan match
   * a random employee.
   */
  const extractSingleDescriptor = async (): Promise<{ descriptor: number[]; snapshot: string }> => {
    const video = videoRef.current;
    if (!cameraActive || !video || video.readyState < 2) {
      throw new Error('Camera is not running. Allow camera access and try again.');
    }

    const reading = await readFace(video);
    if (!reading) {
      throw new Error(
        'No face detected. Center your face in the frame, remove anything covering it, and try again.'
      );
    }

    return {
      descriptor: reading.descriptor,
      snapshot: captureVideoSnapshot(video),
    };
  };

  const handleStepCapture = async () => {
    if (!selectedEmp) return;
    try {
      const { descriptor, snapshot } = await extractSingleDescriptor();
      const nextVectors = [...capturedVectors, descriptor];
      setCapturedVectors(nextVectors);

      if (angleIndex < 2) {
        playBiometricChime('CHECK_IN');
        setAngleIndex(angleIndex + 1);
        return;
      }

      // Completed all 3 angles -> average the embeddings and save.
      await finalizeEnrollment(nextVectors, snapshot);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Face capture failed.');
    }
  };

  const handleQuickOneTapEnroll = async () => {
    if (!selectedEmp) return;
    try {
      const { descriptor, snapshot } = await extractSingleDescriptor();
      await finalizeEnrollment([descriptor], snapshot);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Face capture failed.');
    }
  };

  const finalizeEnrollment = async (vectors: number[][], snapshot: string) => {
    if (!selectedEmp) return;
    setEnrolling(true);
    setEnrolledSuccess(null);
    try {
      const finalDescriptor = averageDescriptors(vectors);
      if (finalDescriptor.length !== 128) {
        throw new Error('Face capture failed. Please try again.');
      }
      setCapturedVectorPreview(finalDescriptor);

      const res = await enrollEmployeeFace(selectedEmp.id, finalDescriptor, snapshot || undefined);
      playBiometricChime('ENROLL');
      setEnrolledSuccess(res.message);
      setAngleIndex(3);
      onEnrolled(selectedEmp.id);
    } catch (err) {
      console.error(err);
    } finally {
      setEnrolling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-md rounded-3xl border border-hairline bg-panel text-ink-soft shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline/80 bg-elevated/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-accent">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                3-Angle Face Biometric Enrollment
              </h3>
              <p className="text-[11px] text-muted">
                128-D Face Embedding Registration (on-device)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-control transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3.5">
          {/* Employee Picker if not pre-locked */}
          {!initialEmployee && (
            <div>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    loadEmployees(e.target.value);
                  }}
                  placeholder="Search EMP0001..EMP0015 or Name..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-elevated border border-hairline-strong/80 text-ink placeholder-faint focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {employees.slice(0, 10).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmp(emp);
                      setAngleIndex(0);
                      setCapturedVectors([]);
                      setEnrolledSuccess(null);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                      selectedEmp?.id === emp.id
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-ink'
                        : 'bg-elevated/60 border-hairline text-body'
                    }`}
                  >
                    <span className="font-semibold truncate">
                      {emp.full_name} ({emp.emp_code})
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        emp.face_enrolled
                          ? 'bg-emerald-500/15 text-accent-soft'
                          : 'bg-amber-500/15 text-warn-soft'
                      }`}
                    >
                      {emp.face_enrolled ? 'Enrolled' : 'Pending'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Employee Banner */}
          {selectedEmp && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/90 border border-hairline">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-ink shrink-0"
                  style={{ backgroundColor: selectedEmp.avatar_color }}
                >
                  {selectedEmp.avatar_initials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink truncate">
                    {selectedEmp.full_name}
                  </div>
                  <div className="text-xs font-mono text-accent">
                    {selectedEmp.emp_code} • {selectedEmp.department}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFacingMode((p) => (p === 'user' ? 'environment' : 'user'))}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-control hover:bg-control-hover text-ink-soft cursor-pointer shrink-0"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-accent" />
                {facingMode === 'user' ? 'Front' : 'Rear'}
              </button>
            </div>
          )}

          {/* 3-Angle Stepper Progress */}
          <div className="grid grid-cols-3 gap-1.5">
            {ANGLE_STEPS.map((s, idx) => {
              const done = angleIndex > idx;
              const active = angleIndex === idx;
              return (
                <div
                  key={s.step}
                  className={`p-2 rounded-xl border text-center transition ${
                    done
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-accent-soft'
                      : active
                      ? 'bg-sky-500/15 border-sky-500/50 text-info-soft'
                      : 'bg-elevated/50 border-hairline text-faint'
                  }`}
                >
                  <div className="text-xs font-mono font-bold">
                    {done ? '✓ CAPTURED' : `ANGLE ${s.step}/3`}
                  </div>
                  <div className="text-xs font-semibold truncate mt-0.5">{s.title}</div>
                </div>
              );
            })}
          </div>

          {/* Camera Viewfinder */}
          <div className="camera-stage relative h-52 w-full rounded-2xl overflow-hidden bg-inset border border-hairline flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              } ${cameraActive ? 'block' : 'hidden'}`}
            />

            {!cameraActive && (
              <div className="p-4 text-center max-w-xs">
                <Camera className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-[11px] text-body leading-relaxed">
                  {cameraError || 'Initializing Android Mobile Camera...'}
                </p>
              </div>
            )}

            {/* Reticle */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-36 h-40 rounded-3xl border-2 border-dashed border-emerald-400/80 relative flex items-center justify-center">
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanline" />
              </div>
              <span className="mt-2 text-xs font-mono text-accent-soft bg-inset/90 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {angleIndex < 3
                  ? ANGLE_STEPS[angleIndex].hint
                  : 'All 3 Angles Averaged & Enrolled!'}
              </span>
            </div>
          </div>

          {/* 128-D Vector Preview on Completion */}
          {capturedVectorPreview.length > 0 && (
            <div className="p-2.5 rounded-xl bg-inset border border-hairline space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-accent">
                <Cpu className="w-3.5 h-3.5" />
                <span>128-D FACE EMBEDDING SAVED:</span>
              </div>
              <div className="text-xs font-mono text-muted break-all">
                [{capturedVectorPreview.slice(0, 8).join(', ')}, ...]
              </div>
            </div>
          )}

          {enrolledSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-accent-soft text-xs">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              <div className="font-semibold text-ink">{enrolledSuccess}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-hairline bg-elevated/70 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!selectedEmp || enrolling}
            onClick={handleQuickOneTapEnroll}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-control hover:bg-control-hover text-info-soft border border-hairline-strong transition cursor-pointer"
          >
            1-Tap Quick Enroll
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-control hover:bg-control-hover text-body transition cursor-pointer"
            >
              Done
            </button>
            {angleIndex < 3 && (
              <button
                type="button"
                disabled={!selectedEmp || enrolling}
                onClick={handleStepCapture}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer"
              >
                {enrolling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    Capture Angle {angleIndex + 1}/3
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
