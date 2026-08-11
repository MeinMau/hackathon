export const SCROLL_PHASES = {
  closedHoldEnd: 0.15,
  openingStart: 0.15,
  openingEnd: 0.5,
  openHoldEnd: 0.6,
  zoomStart: 0.6,
  zoomEnd: 0.92,
  fullscreenStart: 0.9,
  fullscreenEnd: 1,
} as const;

export const LAPTOP_MOTION = {
  closedAngle: Math.PI / 2 - 0.12,
  openAngle: -0.18,
  initialFov: 39,
  finalFov: 34,
  screenHeight: 1.72,
  bezel: 0.1,
  baseDepth: 2.12,
  baseThickness: 0.12,
} as const;

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function inverseLerp(start: number, end: number, value: number) {
  if (start === end) {
    return 0;
  }

  return clamp01((value - start) / (end - start));
}

export function smoothStep(progress: number) {
  const t = clamp01(progress);
  return t * t * (3 - 2 * t);
}

export function phaseProgress(start: number, end: number, progress: number) {
  return smoothStep(inverseLerp(start, end, progress));
}
