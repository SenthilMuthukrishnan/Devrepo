/**
 * Real face recognition, running fully in the browser.
 *
 * Uses the face-api.js models (tinyFaceDetector + 68 landmarks + 128-D face
 * recognition) that ship with the @vladmandic/face-api npm package and are
 * copied into /models by scripts/copy-face-models.mjs at build time.
 *
 * The 128-D descriptor is an actual face embedding: pictures of the same person
 * land close together, pictures of different people land far apart. This
 * replaces the old luminance-grid "descriptor", which could not tell two people
 * apart and would happily match any face to any enrolled employee.
 */
import * as faceapi from '@vladmandic/face-api';

// Relative URL: works whether the app is served from / or a sub-path.
const MODEL_URL = 'models';

let modelsPromise: Promise<void> | null = null;

export function faceModelsReady(): boolean {
  return modelsPromise !== null;
}

export function loadFaceModels(): Promise<void> {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    })().catch((error) => {
      // Allow a later retry instead of caching the failure forever.
      modelsPromise = null;
      throw new Error(
        'Face recognition models could not be loaded. Check that /models is being served and reload the page.'
      );
    });
  }
  return modelsPromise;
}

export const DESCRIPTOR_DIMENSIONS = 128;

export type FaceReading = {
  descriptor: number[];
  box: { x: number; y: number; width: number; height: number };
  score: number;
};

/** Detect the single most confident face in an image/video/canvas. */
export async function readFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceReading | null> {
  await loadFaceModels();

  const detection = await faceapi
    .detectSingleFace(
      input as HTMLVideoElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return {
    descriptor: Array.from(detection.descriptor),
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
    score: detection.detection.score,
  };
}

/** Grab a JPEG snapshot of the current video frame for the employee record. */
export function captureVideoSnapshot(
  video: HTMLVideoElement,
  maxWidth = 320
): string {
  if (!video || video.readyState < 2 || !video.videoWidth) return '';
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

/** Average several captures of the same face into one L2-normalised vector. */
export function averageDescriptors(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const avg = new Array<number>(dim).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) avg[i] += vec[i] ?? 0;
  }
  for (let i = 0; i < dim; i++) avg[i] /= vectors.length;

  let norm = 0;
  for (const v of avg) norm += v * v;
  const mag = Math.sqrt(norm) || 1;
  return avg.map((v) => Number((v / mag).toFixed(6)));
}
