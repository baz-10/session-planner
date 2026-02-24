import type { ActionType } from './diagram-types';

export interface StagePoint {
  x: number;
  y: number;
}

type ActionDrawMode = 'arrow' | 'wavy_arrow' | 'screen';

export interface ActionVisualStyle {
  mode: ActionDrawMode;
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash?: number[];
  pointerLength: number;
  pointerWidth: number;
}

const BASE_ACTION_STYLES: Record<ActionType, ActionVisualStyle> = {
  dribble: {
    mode: 'wavy_arrow',
    stroke: '#2f333c',
    fill: '#2f333c',
    strokeWidth: 4.2,
    pointerLength: 19,
    pointerWidth: 19,
  },
  pass: {
    mode: 'arrow',
    stroke: '#2f333c',
    fill: '#2f333c',
    strokeWidth: 3,
    dash: [11, 8],
    pointerLength: 16,
    pointerWidth: 16,
  },
  cut: {
    mode: 'arrow',
    stroke: '#2f333c',
    fill: '#2f333c',
    strokeWidth: 3.6,
    pointerLength: 17,
    pointerWidth: 17,
  },
  screen: {
    mode: 'screen',
    stroke: '#2f333c',
    fill: '#2f333c',
    strokeWidth: 4.2,
    pointerLength: 0,
    pointerWidth: 0,
  },
  shot: {
    mode: 'arrow',
    stroke: '#c81e1e',
    fill: '#c81e1e',
    strokeWidth: 4.6,
    pointerLength: 19,
    pointerWidth: 19,
  },
  handoff: {
    mode: 'arrow',
    stroke: '#3f4652',
    fill: '#3f4652',
    strokeWidth: 3.4,
    dash: [7, 6],
    pointerLength: 15,
    pointerWidth: 15,
  },
};

export function getActionVisualStyle(
  type: ActionType,
  selected: boolean
): ActionVisualStyle {
  const base = BASE_ACTION_STYLES[type];
  if (!selected) {
    return base;
  }

  return {
    ...base,
    strokeWidth: base.strokeWidth + 0.8,
  };
}

function clampWaveCount(distance: number): number {
  return Math.max(5, Math.min(18, Math.round(distance / 55)));
}

export function buildStraightPoints(from: StagePoint, to: StagePoint): number[] {
  return [from.x, from.y, to.x, to.y];
}

export function buildWavyArrowPoints(
  from: StagePoint,
  to: StagePoint
): number[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 6) {
    return buildStraightPoints(from, to);
  }

  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;

  const segments = Math.max(18, Math.round(distance / 8));
  const waveCount = Math.max(6, Math.min(28, Math.round(distance / 42)));
  const amplitude = Math.max(5, Math.min(9, distance * 0.028));
  const points: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const baseX = from.x + dx * t;
    const baseY = from.y + dy * t;
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.85);
    const wave =
      i === 0 || i === segments
        ? 0
        : Math.sin(t * Math.PI * waveCount * 2) * amplitude * envelope;

    points.push(baseX + nx * wave, baseY + ny * wave);
  }

  points[0] = from.x;
  points[1] = from.y;
  points[points.length - 2] = to.x;
  points[points.length - 1] = to.y;

  return points;
}

export function buildScreenTCapPoints(
  from: StagePoint,
  to: StagePoint,
  capLength = 30
): number[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const ux = distance > 0 ? dx / distance : 1;
  const uy = distance > 0 ? dy / distance : 0;
  const nx = -uy;
  const ny = ux;
  const halfCap = capLength / 2;

  return [
    to.x - nx * halfCap,
    to.y - ny * halfCap,
    to.x + nx * halfCap,
    to.y + ny * halfCap,
  ];
}
