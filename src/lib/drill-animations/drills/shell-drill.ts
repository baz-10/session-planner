import { HOOP } from '../engine';
import type { BallSegment, DrillAnimation, DrillKeyframe, DrillMark } from '../types';

// Four attackers hold their spots and swing the ball. Each defender's spot is worked out from the
// shell rules: on the ball, one pass away (deny) or two-plus passes away (help).
type Id = 'O1' | 'O2' | 'O3' | 'O4';
const SPOTS: Record<Id, [number, number]> = {
  O4: [74, 5], // left wing
  O1: [63.5, 17.5], // left guard
  O2: [63.5, 32.5], // right guard
  O3: [74, 45], // right wing
};
const ORDER: Id[] = ['O4', 'O1', 'O2', 'O3'];
const GUARD: Record<Id, string> = { O1: 'X1', O2: 'X2', O3: 'X3', O4: 'X4' };

const HOLD = 2.4;
const PASS = 0.55;
const SEQUENCE: Id[] = ['O1', 'O2', 'O3', 'O2', 'O1', 'O4', 'O1'];
const passStart = (k: number) => HOLD + k * (HOLD + PASS);
const END = passStart(SEQUENCE.length - 1) + 1.6;

const away = (man: Id, ball: Id) => Math.abs(ORDER.indexOf(man) - ORDER.indexOf(ball));
const unit = (dx: number, dy: number) => {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
};

function defenderSpot(man: Id, ball: Id): [number, number] {
  const [mx, my] = SPOTS[man];
  const [bx, by] = SPOTS[ball];
  const [hx, hy] = unit(HOOP.x - mx, HOOP.y - my);
  const n = away(man, ball);
  if (n === 0) return [mx + hx * 3.2, my + hy * 3.2];
  if (n === 1) {
    const [ux, uy] = unit(bx - mx, by - my);
    return [mx + ux * 3.6 + hx * 2, my + uy * 3.6 + hy * 2];
  }
  // Help: off the line toward the middle of the floor, a step toward the ball side.
  const depth = n === 2 ? 0.48 : 0.58;
  const side = Math.sign(by - 25) * 1.5;
  return [mx + (HOOP.x - mx) * depth, my + (25 - my) * (n === 2 ? 0.78 : 0.95) + side];
}

const tracks: Record<string, DrillKeyframe[]> = {};
for (const id of ORDER) {
  const [x, y] = SPOTS[id];
  tracks[id] = [[0, x, y], [END, x, y]];
  const keys: DrillKeyframe[] = [];
  SEQUENCE.forEach((holder, k) => {
    const [dx, dy] = defenderSpot(id, holder);
    // Defenders move on the flight of the ball and are set by the catch.
    const arrive = k === 0 ? 0 : passStart(k - 1) + 0.75;
    keys.push([+arrive.toFixed(2), +dx.toFixed(2), +dy.toFixed(2)]);
    if (k < SEQUENCE.length - 1) keys.push([+passStart(k).toFixed(2), +dx.toFixed(2), +dy.toFixed(2)]);
  });
  tracks[GUARD[id]] = keys;
}

const ball: BallSegment[] = [];
SEQUENCE.forEach((holder, k) => {
  const start = k === 0 ? 0 : passStart(k - 1) + PASS;
  const end = k < SEQUENCE.length - 1 ? passStart(k) : END;
  ball.push({ type: 'hold', player: holder, start, end, dribble: 'never' });
  if (k < SEQUENCE.length - 1) ball.push({ type: 'pass', from: holder, to: SEQUENCE[k + 1], start: passStart(k), end: passStart(k) + PASS });
});

// Presentation clock: hold the opening spots to teach the three jobs, run, freeze on the
// ball-you-man triangle when the ball reaches the right wing, then finish the rotation.
const RUN_AT = 10;
const FREEZE_TAU = passStart(1) + 1.4;
const FREEZE_AT = RUN_AT + FREEZE_TAU;
const RESUME_AT = FREEZE_AT + 5;
const tAt = (tau: number) => (tau <= FREEZE_TAU ? RUN_AT + tau : RESUME_AT + (tau - FREEZE_TAU));
const LENGTH = tAt(END) + 1.5;

const JOB = ['On ball', 'Deny', 'Help', 'Help'] as const;
const jobTags: DrillMark[] = [];
SEQUENCE.forEach((holder, k) => {
  const from = k === 0 ? 3 : tAt(passStart(k - 1) + 0.6);
  const to = k < SEQUENCE.length - 1 ? tAt(passStart(k)) + 0.15 : LENGTH;
  for (const id of ORDER) {
    const n = Math.min(3, away(id, holder));
    jobTags.push({ kind: 'tag', player: GUARD[id], text: JOB[n], from, to, tone: n === 0 ? 'warning' : n === 1 ? 'teach' : 'success' });
  }
});

export const shellDrill: DrillAnimation = {
  slug: 'shell-drill',
  name: 'Shell drill',
  category: 'Defence',
  summary:
    'The foundation of team defence: four defenders learn where to stand as the ball moves, on the ball, one pass away and in help.',
  level: 'Beginner to intermediate',
  playerCount: '8 (4 on 4)',
  time: '10-12 min',
  equipment: 'Half court, 1 ball',
  focus: ['Help defence', 'Positioning', 'Communication', 'Closeouts'],
  court: 'half',
  length: LENGTH,
  poster: 3.6,
  clock: [
    [0, 0],
    [RUN_AT, 0],
    [FREEZE_AT, FREEZE_TAU],
    [RESUME_AT, FREEZE_TAU],
    [tAt(END), END],
    [LENGTH, END],
  ],
  players: [
    ...ORDER.map((id, i) => ({ id, team: 'offense' as const, label: id.slice(1), enterAt: 0.2 + i * 0.12 })),
    ...ORDER.map((id, i) => ({ id: GUARD[id], team: 'defense' as const, label: GUARD[id], enterAt: 0.9 + i * 0.12 })),
  ],
  tracks,
  ball,
  arrows: [
    { show: RUN_AT + 0.4, hide: FREEZE_AT, from: passStart(0), to: passStart(1) + 0.8, players: ['X4', 'X1', 'X2', 'X3'], passes: true },
  ],
  steps: [
    { at: 0, chapter: 'Setup', title: 'Four on four', body: 'Attackers on the four perimeter spots: two guards and two wings. Each defender takes a player.' },
    { at: 3, chapter: 'Three jobs', title: 'Your job depends on the ball', body: 'Every defender is on the ball, one pass away or two passes away.' },
    { at: 4.6, tone: 'warning', title: 'On ball: pressure', body: 'Arm\'s length away, between your player and the basket. No easy pass, no straight drive.' },
    { at: 6.4, title: 'One pass away: deny', body: 'A step toward the ball, hand in the passing lane. Make the next pass hard.' },
    { at: 8.2, tone: 'success', title: 'Two passes away: help', body: 'Sink to the middle of the floor, on the split line, ready to stop a drive.' },
    { at: RUN_AT, chapter: 'Swing the ball', title: 'Move on the flight of the ball', body: 'Every pass changes every job. Defenders move while the ball is in the air, not after the catch.' },
    {
      at: FREEZE_AT,
      freeze: true,
      title: 'See ball and player',
      body: 'X4 is two-plus passes away. Point one hand at the ball and one at your player: the ball-you-player triangle.',
    },
    { at: RESUME_AT, title: 'Jump to the ball', body: 'On a skip or a swing, the help defenders sprint back out to deny or close out.' },
    { at: tAt(passStart(4)), title: 'Talk every pass', body: '"Ball!" from the on-ball defender, "Deny!" and "Help!" from the others.' },
  ],
  marks: [
    { kind: 'ring', player: 'X1', from: 4.6, to: 6.3, tone: 'warning' },
    { kind: 'ring', player: 'X4', from: 6.4, to: 8.1 },
    { kind: 'ring', player: 'X2', from: 6.5, to: 8.1 },
    { kind: 'ring', player: 'X3', from: 8.2, to: 9.9, tone: 'success' },
    { kind: 'lane', y1: 24.2, y2: 25.8, text: 'Split line', from: 8.2, to: 12 },
    { kind: 'triangle', players: ['O3', 'X4', 'O4'], text: 'Ball · you · player', from: FREEZE_AT + 0.3, to: RESUME_AT },
    ...jobTags,
  ],
  setup: [
    'Four attackers on the perimeter: two guards above the arc and two wings.',
    'Four defenders, one on each attacker. Start with the ball at a guard spot.',
  ],
  howItRuns: [
    'The offence passes around the perimeter, holding each catch for two seconds. No dribbling to start.',
    'The defence moves to its new positions on every pass.',
    'Coach freezes the drill to check spacing. Progress to live play after the rotations are solid.',
    'Rotate offence to defence every 60-90 seconds.',
  ],
  coachingPoints: [
    {
      title: 'Positioning',
      points: [
        'On ball: between your player and the basket, arm\'s length away.',
        'One pass away: one step toward the ball, hand in the lane.',
        'Two passes away: on the split line, able to see ball and player.',
      ],
    },
    {
      title: 'Habits',
      points: [
        'Move while the pass is in the air.',
        'Talk on every pass so teammates know who has the ball.',
        'Close out short, with high hands and choppy feet.',
      ],
    },
  ],
  mistakes: [
    'Help defenders staying glued to their player instead of sinking to the middle.',
    'Watching the ball and losing sight of their own player.',
    'Moving after the catch, which is always one beat too late.',
    'Silent defence. If nobody talks, nobody knows who is helping.',
  ],
  progressions: [
    'Allow one dribble penetration: help stops the drive, everyone rotates.',
    'Add skip passes to force long closeouts.',
    'Add cuts: the passer cuts to the basket and the defender jumps to the ball.',
    'Play it live: first team to three stops wins.',
  ],
};
