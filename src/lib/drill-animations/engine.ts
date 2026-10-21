import type {
  BallSegment,
  DrillAnimation,
  DrillArrowSet,
  DrillKeyframe,
  DrillStep,
} from './types';

// Every function here is a pure function of time, so any frame can be rendered exactly
// (scrubbing, slow motion and freeze frames never drift).

export const COURT = { length: 94, width: 50 } as const;
export const HOOP = { x: 88.75, y: 25 } as const;
export const HOOPS = { right: HOOP, left: { x: 5.25, y: 25 } } as const;
const nearestHoop = (p: { x: number }) => (p.x < 47 ? HOOPS.left : HOOPS.right);
const RIM_HEIGHT = 10;

export interface Vec {
  x: number;
  y: number;
}

// ---------- Timing helpers (slow in / slow out, springs) ----------

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOut = (p: number) => 1 - (1 - p) ** 3;

/** Damped spring step response: 0 before t = 0, overshoots, settles at 1. */
export function spring(t: number, freq = 2.4, zeta = 0.55): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = Math.min(zeta, 0.999);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Fade in over `fade` s at `from`, out over `fade` s before `to`. */
export function windowOpacity(t: number, from: number, to: number, fade = 0.3): number {
  return Math.min(prog(t, from, from + fade), 1 - prog(t, to - fade, to));
}

// ---------- Player tracks ----------

interface TrackSegment {
  keys: DrillKeyframe[];
  tangents: Vec[];
  start: number;
}

const samePoint = (a: DrillKeyframe, b: DrillKeyframe) =>
  Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;

function buildTrack(keys: DrillKeyframe[]): TrackSegment[] {
  const segments: DrillKeyframe[][] = [];
  let current: DrillKeyframe[] = [];
  for (const key of keys) {
    if (key[3] === 'jump' && current.length) {
      segments.push(current);
      current = [];
    }
    current.push(key);
  }
  if (current.length) segments.push(current);

  return segments.map((seg, index) => ({
    keys: seg,
    start: index === 0 ? -Infinity : seg[0][0],
    // Cardinal tangents through the keys; zero at the ends and at holds so players
    // accelerate away and decelerate into every stop.
    tangents: seg.map((key, i) => {
      const prev = seg[i - 1];
      const next = seg[i + 1];
      if (!prev || !next || samePoint(prev, key) || samePoint(key, next)) return { x: 0, y: 0 };
      const dt = next[0] - prev[0];
      return { x: ((next[1] - prev[1]) / dt) * 0.9, y: ((next[2] - prev[2]) / dt) * 0.9 };
    }),
  }));
}

function segmentAt(track: TrackSegment[], tau: number): number {
  let index = 0;
  for (let i = 1; i < track.length; i += 1) if (tau >= track[i].start) index = i;
  return index;
}

function evalSegment(seg: TrackSegment, tau: number): Vec {
  const { keys, tangents } = seg;
  if (tau <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  const last = keys[keys.length - 1];
  if (tau >= last[0]) return { x: last[1], y: last[2] };
  let i = 0;
  while (i < keys.length - 2 && tau >= keys[i + 1][0]) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const h = b[0] - a[0];
  const u = (tau - a[0]) / h;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  return {
    x: h00 * a[1] + h10 * h * tangents[i].x + h01 * b[1] + h11 * h * tangents[i + 1].x,
    y: h00 * a[2] + h10 * h * tangents[i].y + h01 * b[2] + h11 * h * tangents[i + 1].y,
  };
}

// ---------- Compiled drill ----------

export interface BallState {
  x: number;
  y: number;
  /** Height above the floor in feet. */
  h: number;
  holder: string | null;
}

export interface ArrowPath {
  key: string;
  kind: 'cut' | 'dribble' | 'pass' | 'shot' | 'defense';
  points: Vec[];
  opacity: number;
  head: { at: Vec; angle: number } | null;
  /** 'screen' ends the arrow in a T. */
  cap: 'arrow' | 'screen';
}

interface ArrowSource {
  key: string;
  kind: ArrowPath['kind'];
  set: DrillArrowSet;
  delay: number;
  cap: ArrowPath['cap'];
  samples: { tau: number; p: Vec }[];
}

export interface CompiledDrill {
  drill: DrillAnimation;
  tauAt: (t: number) => number;
  pos: (id: string, tau: number) => Vec;
  vel: (id: string, tau: number) => Vec;
  /** Unit vector the player faces. */
  facing: (id: string, tau: number) => Vec;
  ball: (tau: number) => BallState;
  /** The last made shot at or before tau, while it is still celebrating. */
  scoreAt: (tau: number) => { at: number; hoop: Vec } | null;
  /** Whether a player is attacking or defending at tau (kit drills swap roles on every change of possession). */
  roleAt: (id: string, tau: number) => 'offense' | 'defense';
  /** Players standing in a line or at an outlet spot, waiting for their turn. */
  waitingAt: (id: string, tau: number) => boolean;
  /** The camera's centre and width in feet at presentation time t. */
  cameraAt: (t: number) => { x: number; y: number; w: number } | null;
  arrows: (t: number, tau: number) => ArrowPath[];
  stepAt: (t: number) => { step: DrillStep; index: number } | null;
}

export function compileDrill(drill: DrillAnimation): CompiledDrill {
  const tracks = new Map(Object.entries(drill.tracks).map(([id, keys]) => [id, buildTrack(keys)]));
  const teams = new Map(drill.players.map((p) => [p.id, p.team]));
  const kits = new Map(drill.players.map((p) => [p.id, p.kit]));
  const segments = [...drill.ball].sort((a, b) => a.start - b.start);

  const tauAt = (t: number) => {
    const c = drill.clock;
    if (t <= c[0][0]) return c[0][1];
    for (let i = 0; i < c.length - 1; i += 1) {
      const [t0, k0] = c[i];
      const [t1, k1] = c[i + 1];
      if (t >= t0 && t < t1) return lerp(k0, k1, (t - t0) / (t1 - t0));
    }
    return c[c.length - 1][1];
  };

  const pos = (id: string, tau: number): Vec => {
    const track = tracks.get(id);
    if (!track) return { x: 0, y: 0 };
    return evalSegment(track[segmentAt(track, tau)], tau);
  };

  // Velocity never looks across a jump cut, so resets don't smear.
  const vel = (id: string, tau: number): Vec => {
    const track = tracks.get(id);
    if (!track) return { x: 0, y: 0 };
    const index = segmentAt(track, tau);
    const seg = track[index];
    const end = track[index + 1]?.start ?? Infinity;
    const a = Math.max(seg.start, tau - 0.06);
    const b = Math.min(end - 1e-4, tau + 0.06);
    if (b - a < 1e-3) return { x: 0, y: 0 };
    const pa = evalSegment(seg, a);
    const pb = evalSegment(seg, b);
    return { x: (pb.x - pa.x) / (b - a), y: (pb.y - pa.y) / (b - a) };
  };

  const segmentFor = (tau: number): { seg: BallSegment; index: number } | null => {
    let found: { seg: BallSegment; index: number } | null = null;
    segments.forEach((seg, index) => {
      if (tau >= seg.start) found = { seg, index };
    });
    return found;
  };

  const holderOf = (tau: number): string | null => {
    const found = segmentFor(tau);
    if (!found) return segments[0]?.type === 'hold' ? segments[0].player : null;
    const { seg } = found;
    if (seg.type === 'hold' && tau <= seg.end + 0.05) return seg.player;
    if ((seg.type === 'pass' || seg.type === 'rebound') && tau >= seg.end) return seg.to;
    return null;
  };

  // The player whose team has the ball: the holder, the passer or shooter while it's in the air.
  const possessorOf = (tau: number): string | null => {
    const found = segmentFor(tau);
    if (!found) return segments[0]?.type === 'hold' ? segments[0].player : null;
    const { seg } = found;
    if (seg.type === 'hold' || seg.type === 'shot') return seg.player;
    if (seg.type === 'pass') return tau >= seg.end ? seg.to : seg.from;
    return seg.to;
  };

  const phaseAt = (tau: number) => {
    let found: NonNullable<typeof drill.phases>[number] | undefined;
    for (const phase of drill.phases ?? []) if (tau >= phase.at) found = phase;
    return found ?? drill.phases?.[0];
  };
  const waitingAt = (id: string, tau: number) => phaseAt(tau)?.waiting?.includes(id) ?? false;

  const roleAt = (id: string, tau: number): 'offense' | 'defense' => {
    const phase = phaseAt(tau);
    if (phase) return phase.offense.includes(id) ? 'offense' : 'defense';
    const kit = kits.get(id);
    if (!kit) return teams.get(id) ?? 'offense';
    const possessor = possessorOf(tau);
    if (!possessor) return teams.get(id) ?? 'offense';
    return kits.get(possessor) === kit ? 'offense' : 'defense';
  };

  const facing = (id: string, tau: number): Vec => {
    const v = vel(id, tau);
    const speed = Math.hypot(v.x, v.y);
    const p = pos(id, tau);
    const holder = holderOf(tau);
    let target: Vec;
    if (holder === id) target = nearestHoop(p);
    else {
      const b = ballFloor(tau);
      target = { x: b.x, y: b.y };
    }
    const tx = target.x - p.x;
    const ty = target.y - p.y;
    const tl = Math.hypot(tx, ty) || 1;
    const w = clamp((speed - 2) / 5);
    const fx = (1 - w) * (tx / tl) + (speed > 0.01 ? (w * v.x) / speed : 0);
    const fy = (1 - w) * (ty / tl) + (speed > 0.01 ? (w * v.y) / speed : 0);
    const l = Math.hypot(fx, fy) || 1;
    return { x: fx / l, y: fy / l };
  };

  // Where the ball sits relative to a holder: at the chest when still, out on the dribble hand when moving.
  const holdPoint = (id: string, tau: number, mode: 'auto' | 'always' | 'never' = 'auto', since = 0) => {
    const p = pos(id, tau);
    const v = vel(id, tau);
    const speed = Math.hypot(v.x, v.y);
    const forward = speed > 1 ? { x: v.x / speed, y: v.y / speed } : directionTo(p, nearestHoop(p));
    const right = { x: -forward.y, y: forward.x };
    const w = mode === 'always' ? 1 : mode === 'never' ? 0 : clamp((speed - 2.5) / 3);
    const bounce = 3.1 * Math.abs(Math.sin(Math.PI * 2.3 * (tau - since)));
    return {
      x: p.x + forward.x * lerp(1.75, 0.6, w) + right.x * 1.3 * w,
      y: p.y + forward.y * lerp(1.75, 0.6, w) + right.y * 1.3 * w,
      h: lerp(3.6, bounce, w),
    };
  };

  const hoopOf = (seg: Extract<BallSegment, { type: 'shot' | 'rebound' }>) =>
    seg.hoop === 'left' ? HOOPS.left : seg.hoop === 'right' ? HOOPS.right : HOOP;

  function afterShot(hoop: Vec, u: number): BallState {
    // Drops through the net, bounces under the rim and rolls toward the baseline.
    if (u < 0.3) return { x: hoop.x, y: hoop.y, h: lerp(RIM_HEIGHT, 3, u / 0.3), holder: null };
    const r = u - 0.3;
    const roll = Math.min(r, 2.5);
    const h = 3 * Math.exp(-1.6 * r) * Math.abs(Math.cos(Math.PI * 1.7 * r));
    const out = hoop.x > 47 ? 1 : -1;
    return { x: hoop.x + 1.6 * roll * out, y: hoop.y + 0.5 * roll, h, holder: null };
  }

  // A miss clanks off the front of the rim and pops up before anyone catches it.
  function offRim(hoop: Vec, u: number): BallState {
    const out = hoop.x > 47 ? -1 : 1;
    return { x: hoop.x + out * 1.2 * u, y: hoop.y + 0.8 * u, h: RIM_HEIGHT + 2 * Math.sin(Math.PI * Math.min(u, 1)), holder: null };
  }

  const ball = (tau: number): BallState => {
    const found = segmentFor(tau);
    const first = segments[0];
    if (!found) {
      if (first?.type === 'hold') return { ...holdPoint(first.player, tau, first.dribble, first.start), holder: first.player };
      return { x: 47, y: 25, h: 0, holder: null };
    }
    const { seg } = found;
    if (seg.type === 'hold') {
      const at = Math.min(tau, seg.end);
      return { ...holdPoint(seg.player, at, seg.dribble, seg.start), holder: seg.player };
    }
    if (seg.type === 'pass') {
      if (tau >= seg.end) return { ...holdPoint(seg.to, tau), holder: seg.to };
      const a = holdPoint(seg.from, seg.start);
      const b = holdPoint(seg.to, seg.end);
      const p = (tau - seg.start) / (seg.end - seg.start);
      let h = lerp(a.h, b.h, p) + 1.2 * Math.sin(Math.PI * p);
      if (seg.style === 'bounce') h = p < 0.55 ? lerp(a.h, 0, p / 0.55) : lerp(0, b.h, (p - 0.55) / 0.45);
      if (seg.style === 'lob') h = lerp(a.h, b.h, p) + 8 * Math.sin(Math.PI * p);
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), h, holder: null };
    }
    if (seg.type === 'rebound') {
      if (tau >= seg.end) return { ...holdPoint(seg.to, tau), holder: seg.to };
      const hoop = hoopOf(seg);
      const a = { x: hoop.x + (hoop.x > 47 ? -1.4 : 1.4), y: hoop.y + 1, h: RIM_HEIGHT };
      const b = holdPoint(seg.to, seg.end);
      const p = (tau - seg.start) / (seg.end - seg.start);
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), h: lerp(a.h, b.h, p) + 3 * Math.sin(Math.PI * p), holder: null };
    }
    const hoop = hoopOf(seg);
    if (tau >= seg.end) return seg.make === false ? offRim(hoop, tau - seg.end) : afterShot(hoop, tau - seg.end);
    const a = holdPoint(seg.player, seg.start);
    const p = (tau - seg.start) / (seg.end - seg.start);
    const reach = Math.hypot(hoop.x - a.x, hoop.y - a.y);
    const arc = clamp(reach / 3, 2, 9);
    return {
      x: lerp(a.x, hoop.x, easeOut(p) * 0.4 + p * 0.6),
      y: lerp(a.y, hoop.y, easeOut(p) * 0.4 + p * 0.6),
      h: lerp(a.h + 2, RIM_HEIGHT, p) + arc * Math.sin(Math.PI * p),
      holder: null,
    };
  };

  function ballFloor(tau: number): Vec {
    const b = ball(tau);
    return { x: b.x, y: b.y };
  }

  const scoreAt = (tau: number) => {
    let last: { at: number; hoop: Vec } | null = null;
    for (const seg of segments) {
      if (seg.type === 'shot' && seg.make !== false && tau >= seg.end && tau < seg.end + 1.6) last = { at: seg.end, hoop: hoopOf(seg) };
    }
    return last;
  };

  // ---------- Coaching arrows ----------

  const sources: ArrowSource[] = [];
  drill.arrows.forEach((set, si) => {
    let order = 0;
    for (const id of set.players ?? []) {
      const samples: ArrowSource['samples'] = [];
      for (let tau = set.from; tau <= set.to + 1e-6; tau += 0.05) samples.push({ tau, p: pos(id, tau) });
      const trimmed = trimStill(samples);
      if (pathLength(trimmed.map((s) => s.p)) < 2.5) continue;
      const held = trimmed.filter((s) => holderOf(s.tau) === id).length / trimmed.length;
      const mid = trimmed[Math.floor(trimmed.length / 2)].tau;
      const kind: ArrowPath['kind'] = roleAt(id, mid) === 'defense' ? 'defense' : held > 0.6 ? 'dribble' : 'cut';
      const cap = set.screens?.includes(id) ? 'screen' : 'arrow';
      sources.push({ key: `${si}-${id}`, kind, set, cap, delay: order * 0.22, samples: kind === 'dribble' ? wavy(trimmed) : trimmed });
      order += 1;
    }
    if (set.passes) {
      segments.forEach((seg, gi) => {
        if (seg.start < set.from - 1e-6 || seg.start > set.to) return;
        if (seg.type === 'pass') {
          const a = holdPoint(seg.from, seg.start);
          const b = holdPoint(seg.to, seg.end);
          sources.push({
            key: `${si}-p${gi}`,
            kind: 'pass',
            set,
            cap: 'arrow',
            delay: order * 0.22,
            samples: [
              { tau: seg.start, p: { x: a.x, y: a.y } },
              { tau: seg.end, p: { x: b.x, y: b.y } },
            ],
          });
          order += 1;
        } else if (seg.type === 'shot') {
          const a = holdPoint(seg.player, seg.start);
          const hoop = hoopOf(seg);
          sources.push({
            key: `${si}-s${gi}`,
            kind: 'shot',
            set,
            cap: 'arrow',
            delay: order * 0.22,
            samples: [
              { tau: seg.start, p: { x: a.x, y: a.y } },
              { tau: seg.end, p: { x: hoop.x + (hoop.x > 47 ? -0.9 : 0.9), y: hoop.y } },
            ],
          });
          order += 1;
        }
      });
    }
  });

  const arrows = (t: number, tau: number): ArrowPath[] => {
    const out: ArrowPath[] = [];
    for (const src of sources) {
      const { set, samples } = src;
      const opacity = Math.min(prog(t, set.show + src.delay, set.show + src.delay + 0.15), 1 - prog(t, set.hide, set.hide + 0.4));
      if (opacity <= 0) continue;
      const draw = easeInOut(prog(t, set.show + src.delay, set.show + src.delay + 0.8));
      const points = partialPath(samples, draw, tau);
      if (points.length < 2) continue;
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      const done = draw >= 1;
      out.push({
        key: src.key,
        kind: src.kind,
        points,
        opacity,
        head: done || draw > 0.05 ? { at: b, angle: Math.atan2(b.y - a.y, b.x - a.x) } : null,
        cap: src.cap,
      });
    }
    return out;
  };

  const stepAt = (t: number) => {
    let found: { step: DrillStep; index: number } | null = null;
    drill.steps.forEach((step, index) => {
      if (t >= step.at) found = { step, index };
    });
    return found;
  };

  // Camera keys hold a fixed x, or 'ball' to follow a smoothed ball position kept on the court.
  const followX = (t: number, w: number) => {
    let sum = 0;
    const n = 8;
    for (let i = 0; i < n; i += 1) sum += ball(tauAt(Math.max(0, t - i * 0.12))).x;
    return clamp(sum / n, w / 2 - 5.8, 99.8 - w / 2);
  };
  const cameraAt = (t: number) => {
    const keys = drill.camera;
    if (!keys?.length) return null;
    const value = (key: (typeof keys)[number]) => {
      const w = key[3];
      return { x: key[1] === 'ball' ? followX(t, w) : key[1], y: key[2], w };
    };
    if (t <= keys[0][0]) return value(keys[0]);
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (t >= keys[i][0] && t < keys[i + 1][0]) {
        const a = value(keys[i]);
        const b = value(keys[i + 1]);
        const m = easeInOut((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
        const w = lerp(a.w, b.w, m);
        const h = (w * 9) / 16;
        return { x: clamp(lerp(a.x, b.x, m), w / 2 - 5.8, 99.8 - w / 2), y: clamp(lerp(a.y, b.y, m), h / 2 - 4.7, 54.7 - h / 2), w };
      }
    }
    return value(keys[keys.length - 1]);
  };

  return { drill, tauAt, pos, vel, facing, ball, scoreAt, roleAt, waitingAt, cameraAt, arrows, stepAt };
}

// ---------- Path helpers ----------

function directionTo(a: Vec, b: Vec): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

function pathLength(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Drops the stationary samples at either end so arrows start where the move starts. */
function trimStill(samples: { tau: number; p: Vec }[]) {
  const moved = (i: number) => i > 0 && Math.hypot(samples[i].p.x - samples[i - 1].p.x, samples[i].p.y - samples[i - 1].p.y) > 0.02;
  let a = 0;
  while (a < samples.length - 1 && !moved(a + 1)) a += 1;
  let b = samples.length - 1;
  while (b > a && !moved(b)) b -= 1;
  return samples.slice(a, b + 1);
}

/** Zig-zag offset for dribble arrows, fixed along the path so partial draws stay stable. */
function wavy(samples: { tau: number; p: Vec }[]) {
  let s = 0;
  const total = pathLength(samples.map((x) => x.p));
  return samples.map((sample, i) => {
    if (i > 0) s += Math.hypot(sample.p.x - samples[i - 1].p.x, sample.p.y - samples[i - 1].p.y);
    const prev = samples[Math.max(0, i - 1)].p;
    const next = samples[Math.min(samples.length - 1, i + 1)].p;
    const d = directionTo(prev, next);
    const envelope = Math.min(1, s / 2, (total - s) / 3);
    const off = 0.55 * Math.sin((s / 2.2) * Math.PI * 2) * Math.max(0, envelope);
    return { tau: sample.tau, p: { x: sample.p.x - d.y * off, y: sample.p.y + d.x * off } };
  });
}

/** The arrow is drawn on up to `draw` (0-1) and erased behind the player as drill time passes. */
function partialPath(samples: { tau: number; p: Vec }[], draw: number, tau: number): Vec[] {
  const n = samples.length;
  const endF = draw * (n - 1);
  let startF = 0;
  const t0 = samples[0].tau;
  const t1 = samples[n - 1].tau;
  if (tau > t0) startF = clamp((tau - t0) / (t1 - t0)) * (n - 1);
  if (startF >= endF - 1e-3) return [];
  const at = (f: number): Vec => {
    const i = Math.min(n - 2, Math.floor(f));
    const m = f - i;
    return { x: lerp(samples[i].p.x, samples[i + 1].p.x, m), y: lerp(samples[i].p.y, samples[i + 1].p.y, m) };
  };
  const points = [at(startF)];
  for (let i = Math.ceil(startF); i < endF; i += 1) if (i > startF) points.push(samples[i].p);
  points.push(at(endF));
  return points;
}
