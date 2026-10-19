#!/usr/bin/env node
// Copies the face-api.js model weights that ship inside the npm package into
// public/models so the browser can load them from /models. Run automatically
// before `npm run build` and `npm run server`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/@vladmandic/face-api/model');
const to = resolve(root, 'public/models');

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

if (!existsSync(from)) {
  console.error('[face-models] @vladmandic/face-api is not installed — run npm install.');
  process.exit(1);
}

mkdirSync(to, { recursive: true });
for (const file of files) {
  const src = resolve(from, file);
  if (!existsSync(src)) {
    console.error(`[face-models] missing model file: ${file}`);
    process.exit(1);
  }
  cpSync(src, resolve(to, file));
}
console.log(`[face-models] ${files.length} files copied to public/models`);
