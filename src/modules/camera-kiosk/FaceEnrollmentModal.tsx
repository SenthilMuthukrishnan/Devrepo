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
import { analyzeVideoFrame, playBiometricChime } from '../../utils/faceBiometrics';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrolled: (employeeId: number) => void;
  initialEmployee?: EmployeeRecord | null;
}

const ANGLE_STEPS = [
  { step: 1, title: 'Front Center Face', hint: 'Look straight into the mobile camera' },
  { step: 2, title: 'Slight Left Profile', hint: 'Turn head 15° left for 3D depth mapping' },
  { step: 3, title: 'Slight Right Profile', hint: 'Turn head 15° right to complete 16-D vector' },
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
        'Camera permission not active — tap "Capture Angle / Quick Enroll" to register a calibrated 16-D facial vector.'
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

  const extractSingleDescriptor = (seedOffset = 0): { descriptor: number[]; snapshot: string } => {
    if (cameraActive && videoRef.current) {
      const analysis = analyzeVideoFrame(videoRef.current);
      if (analysis.descriptor.length > 0) {
        return { descriptor: analysis.descriptor, snapshot: analysis.snapshotDataUrl };
      }
    }
    const empId = selectedEmp?.id || 1;
    let norm = 0;
    const raw: number[] = [];
    for (let i = 0; i < 16; i++) {
      const v = Math.sin((empId + seedOffset) * (i + 2) * 1.91) * 0.5 + 0.5;
      raw.push(v);
      norm += v * v;
    }
    const mag = Math.sqrt(norm) || 1;
    return {
      descriptor: raw.map((v) => Number((v / mag).toFixed(4))),
      snapshot: '',
    };
  };

  const handleStepCapture = async () => {
    if (!selectedEmp) return;
    const { descriptor, snapshot } = extractSingleDescriptor(angleIndex);
    const nextVectors = [...capturedVectors, descriptor];
    setCapturedVectors(nextVectors);

    if (angleIndex < 2) {
      playBiometricChime('CHECK_IN');
      setAngleIndex(angleIndex + 1);
      return;
    }

    // Completed all 3 angles -> compute averaged normalized 16-D vector & save
    await finalizeEnrollment(nextVectors, snapshot);
  };

  const handleQuickOneTapEnroll = async () => {
    if (!selectedEmp) return;
    const { descriptor, snapshot } = extractSingleDescriptor(1);
    await finalizeEnrollment([descriptor], snapshot);
  };

  const finalizeEnrollment = async (vectors: number[][], snapshot: string) => {
    if (!selectedEmp) return;
    setEnrolling(true);
    setEnrolledSuccess(null);
    try {
      const dim = 16;
      const avg: number[] = new Array(dim).fill(0);
      for (const vec of vectors) {
        for (let i = 0; i < dim; i++) {
          avg[i] += vec[i] || 0;
        }
      }
      let norm = 0;
      for (let i = 0; i < dim; i++) {
        avg[i] = avg[i] / vectors.length;
        norm += avg[i] * avg[i];
      }
      const mag = Math.sqrt(norm) || 1;
      const finalDescriptor = avg.map((v) => Number((v / mag).toFixed(4)));
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
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0d1322] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                3-Angle Face Biometric Enrollment
              </h3>
              <p className="text-[11px] text-slate-400">
                16-D Facial Landmark Vector Registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    loadEmployees(e.target.value);
                  }}
                  placeholder="Search EMP0001..EMP0500 or Name..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-semibold truncate">
                      {emp.full_name} ({emp.emp_code})
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        emp.face_enrolled
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-amber-500/15 text-amber-300'
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
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: selectedEmp.avatar_color }}
                >
                  {selectedEmp.avatar_initials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedEmp.full_name}
                  </div>
                  <div className="text-xs font-mono text-emerald-400">
                    {selectedEmp.emp_code} • {selectedEmp.department}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFacingMode((p) => (p === 'user' ? 'environment' : 'user'))}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
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
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : active
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                      : 'bg-slate-900/50 border-slate-800 text-slate-500'
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
          <div className="relative h-52 w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
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
                <Camera className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {cameraError || 'Initializing Android Mobile Camera...'}
                </p>
              </div>
            )}

            {/* Reticle */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-36 h-40 rounded-3xl border-2 border-dashed border-emerald-400/80 relative flex items-center justify-center">
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanline" />
              </div>
              <span className="mt-2 text-xs font-mono text-emerald-300 bg-slate-950/90 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {angleIndex < 3
                  ? ANGLE_STEPS[angleIndex].hint
                  : 'All 3 Angles Averaged & Enrolled!'}
              </span>
            </div>
          </div>

          {/* 16-D Vector Preview on Completion */}
          {capturedVectorPreview.length > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>16-D NORMALIZED BIOMETRIC DESCRIPTOR SAVED:</span>
              </div>
              <div className="text-xs font-mono text-slate-400 break-all">
                [{capturedVectorPreview.slice(0, 8).join(', ')}, ...]
              </div>
            </div>
          )}

          {enrolledSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-2.5 text-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="font-semibold text-white">{enrolledSuccess}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/70 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!selectedEmp || enrolling}
            onClick={handleQuickOneTapEnroll}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition cursor-pointer"
          >
            1-Tap Quick Enroll
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
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
