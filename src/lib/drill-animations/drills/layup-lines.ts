import type { BallSegment, DrillAnimation, DrillArrowSet, DrillKeyframe, DrillPhase, DrillStep } from '../types';

// Half court, attacking the right-hand hoop. Two lines: shooters on the right wing, rebounders on the
// left wing. The shooter passes to the front of the rebound line, gets it back on the run and lays it up;
// the rebounder catches it out of the net and passes to the next shooter. Shooters join the back of the
// rebound line and rebounders join the back of the shooting line. Three reps are generated from the queues.
type Vec = [number, number];
const shootSpot = (k: number): Vec => [68 - 4.5 * k, 40 + 1.2 * k];
const rebSpot = (k: number): Vec => [68 - 4.5 * k, 10 - 1.2 * k];
const LAYUP: Vec = [85.6, 28.4];
const UNDER: Vec = [85.4, 21.4];

const REPS = 3;
const FIRST = 0.8;
const PERIOD = 3.5;
const repAt = (i: number) => FIRST + i * PERIOD;
const END = repAt(REPS - 1) + 6.2;

const IDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'] as const;
type Id = (typeof IDS)[number];
const keys: Record<Id, DrillKeyframe[]> = { A1: [], A2: [], A3: [], B1: [], B2: [], B3: [] };
const at = (id: Id, t: number, [x, y]: Vec) => keys[id].push([+t.toFixed(3), +x.toFixed(2), +y.toFixed(2)]);

let shootQ: Id[] = ['A1', 'A2', 'A3'];
let rebQ: Id[] = ['B1', 'B2', 'B3'];
shootQ.forEach((id, k) => at(id, 0, shootSpot(k)));
rebQ.forEach((id, k) => at(id, 0, rebSpot(k)));

const ball: BallSegment[] = [{ type: 'hold', player: 'A1', start: 0, end: repAt(0), dribble: 'never' }];
const phases: DrillPhase[] = [];
const reps: { shooter: Id; reb: Id; next: Id | null; t: number }[] = [];
// Players walking to the back of the other line skip the next step-up and go straight to their final spot.
const busyUntil: Partial<Record<Id, number>> = {};

for (let i = 0; i < REPS; i += 1) {
  const T = repAt(i);
  const s = shootQ[0];
  const r = rebQ[0];
  phases.push({ at: i === 0 ? 0 : T - 0.1, offense: [...IDS], waiting: IDS.filter((id) => id !== s && id !== r) });

  // Shooter: pass across, cut to the rim, catch on the run, lay it up, then jog to the rebound line.
  at(s, T + 0.45, shootSpot(0));
  at(s, T + 1.15, [78.5, 32.6]);
  at(s, T + 1.65, LAYUP);
  at(s, T + 2.1, [87.2, 29.8]);
  // Wait for the rebounder to clear the rim before crossing to the other side.
  at(s, T + 3.3, [87.6, 30.6]);
  at(s, T + 3.9, [82, 22]);
  // Stay well inside the next rebounder's path to the rim.
  at(s, T + 4.6, [72, 21]);
  at(s, T + 5.3, [64, 15.5]);

  // Rebounder: catch, pass back, follow to the rim, catch it out of the net, pass to the next shooter.
  at(r, T + 0.9, rebSpot(0));
  at(r, T + 1.8, [80, 16]);
  at(r, T + 2.35, UNDER);
  at(r, T + 3.1, UNDER);
  at(r, T + 3.8, [80, 36]);
  at(r, T + 4.6, [71, 46.5]);

  ball.push(
    { type: 'pass', from: s, to: r, start: T, end: T + 0.5 },
    { type: 'hold', player: r, start: T + 0.5, end: T + 0.85, dribble: 'never' },
    { type: 'pass', from: r, to: s, start: T + 0.85, end: T + 1.3 },
    { type: 'hold', player: s, start: T + 1.3, end: T + 1.6, dribble: 'never' },
    { type: 'shot', player: s, start: T + 1.6, end: T + 2.05 },
    { type: 'rebound', to: r, start: T + 2.05, end: T + 2.45 },
  );

  // Everyone else in each line steps up one spot.
  const restShoot = shootQ.slice(1);
  const restReb = rebQ.slice(1);
  restShoot.forEach((id, k) => {
    if ((busyUntil[id] ?? 0) > T + 0.7) return;
    at(id, T + 0.7, shootSpot(k + 1));
    at(id, T + 1.4, shootSpot(k));
  });
  restReb.forEach((id, k) => {
    if ((busyUntil[id] ?? 0) > T + 1.5) return;
    at(id, T + 1.5, rebSpot(k + 1));
    at(id, T + 2.2, rebSpot(k));
  });

  const next = restShoot[0] ?? null;
  if (i < REPS - 1 && next) {
    ball.push(
      { type: 'hold', player: r, start: T + 2.45, end: T + 2.8, dribble: 'never' },
      { type: 'pass', from: r, to: next, start: T + 2.8, end: T + 3.4 },
      { type: 'hold', player: next, start: T + 3.4, end: repAt(i + 1), dribble: 'never' },
    );
  } else {
    ball.push({ type: 'hold', player: r, start: T + 2.45, end: END, dribble: 'never' });
  }
  reps.push({ shooter: s, reb: r, next, t: T });

  // Joiners take the back spot of the other line.
  shootQ = [...restShoot, r];
  rebQ = [...restReb, s];
  // They arrive after the next rep's lines have stepped up, so they take the spot one closer.
  const ahead = i < REPS - 1 ? 1 : 0;
  at(s, T + 5.9, rebSpot(rebQ.length - 1 - ahead));
  at(r, T + 5.3, shootSpot(shootQ.length - 1 - ahead));
  busyUntil[s] = T + 5.9;
  busyUntil[r] = T + 5.3;
}

// Joiners from an earlier rep that are still travelling when the next rep's line moves up are folded in by
// sorting each track and dropping keys that would send a player backwards in time.
const tracks: Record<string, DrillKeyframe[]> = {};
for (const id of IDS) {
  const sorted = [...keys[id]].sort((a, b) => a[0] - b[0]);
  const clean: DrillKeyframe[] = [];
  for (const k of sorted) {
    const last = clean[clean.length - 1];
    if (last && Math.abs(last[0] - k[0]) < 1e-6) clean[clean.length - 1] = k;
    else clean.push(k);
  }
  clean.push([END, clean[clean.length - 1][1], clean[clean.length - 1][2]]);
  tracks[id] = clean;
}

// Presentation: setup hold, then real time with one quiz after the first layup.
const RUN = 4;
const tAt = (tau: number) => RUN + tau;
const LENGTH = tAt(END) + 2.5;

const arrows: DrillArrowSet[] = [
  { show: 2.2, hide: tAt(repAt(0) + 2.1), from: repAt(0), to: repAt(0) + 2.4, players: [reps[0].shooter, reps[0].reb], passes: true },
];

const steps: DrillStep[] = [
  {
    at: 0,
    chapter: 'Setup',
    title: 'Two lines',
    body: 'Shooters line up on the right wing with the ball. Rebounders line up on the left wing.',
    callout: { player: 'A1', text: 'Shooting line' },
  },
  {
    at: 1.4,
    title: 'Rebound line',
    body: 'The front rebounder gives the shooter a target and follows the shot to the rim.',
    callout: { player: 'B1', text: 'Rebound line' },
  },
  {
    at: RUN,
    chapter: 'Rep 1',
    title: 'Pass and go',
    body: 'Pass across to the front of the rebound line, then sprint to the rim.',
    callout: { player: 'A1', text: 'Pass, then cut' },
  },
  {
    at: tAt(repAt(0) + 0.85),
    title: 'Get it back on the run',
    body: 'Rebounder hits the shooter in stride. Shooter catches, two steps, lays it up.',
    callout: { player: 'B1', text: 'Lead the shooter' },
  },
  {
    at: tAt(repAt(0) + 2.1),
    title: 'Switch lines',
    body: 'The shooter jogs to the back of the rebound line. The rebounder catches it out of the net.',
    callout: { player: 'A1', text: 'To the rebound line' },
    quiz: {
      prompt: '1 just laid it up. Which line does 1 join? Tap the last player in that line.',
      answer: 'B3',
      choices: ['A3', 'B3'],
      explain: 'Shooters go to the rebound line and rebounders go to the shooting line, so everyone does both jobs.',
    },
  },
  {
    at: tAt(repAt(0) + 2.8),
    title: 'Feed the next shooter',
    body: 'The rebounder passes to the next shooter, then joins the back of the shooting line.',
    callout: { player: 'B1', text: 'Outlet to the next shooter' },
  },
  {
    at: tAt(repAt(1)),
    chapter: 'Keep it moving',
    title: 'Next pair goes',
    body: 'The lines step up and the next shooter goes straight away. No waiting.',
    callout: { player: reps[1].shooter, text: 'Next shooter' },
  },
  {
    at: tAt(repAt(2) + 2.1),
    chapter: 'Key rule',
    tone: 'success',
    title: 'Two jobs, one rhythm',
    body: 'Shoot, rebound, switch lines. Keep one ball moving and nobody standing still.',
  },
];

export const layupLines: DrillAnimation = {
  slug: 'layup-lines',
  name: 'Layup lines',
  category: 'Warm-up',
  summary: 'The classic team warm-up: pass, cut, catch on the run and lay it up, then switch lines. Everyone shoots and everyone rebounds.',
  level: 'Beginner',
  playerCount: '6+ (two lines)',
  time: '5-8 min',
  equipment: 'One basket, 1-2 balls',
  focus: ['Warm-up', 'Layups', 'Passing on the move', 'Rebounding'],
  court: 'half',
  length: LENGTH,
  poster: 1.9,
  clock: [
    [0, 0],
    [RUN, 0],
    [tAt(END), END],
    [LENGTH, END],
  ],
  phases,
  players: [
    { id: 'A1', team: 'offense', label: '1', enterAt: 0.2, name: 'Shooter 1' },
    { id: 'A2', team: 'offense', label: '2', enterAt: 0.3, name: 'Shooter 2' },
    { id: 'A3', team: 'offense', label: '3', enterAt: 0.4, name: 'Shooter 3' },
    { id: 'B1', team: 'offense', label: '4', enterAt: 0.6, name: 'Rebounder 4' },
    { id: 'B2', team: 'offense', label: '5', enterAt: 0.7, name: 'Rebounder 5' },
    { id: 'B3', team: 'offense', label: '6', enterAt: 0.8, name: 'Rebounder 6' },
  ],
  tracks,
  ball,
  arrows,
  steps,
  marks: [
    { kind: 'label', x: 60, y: 47.5, text: 'Shooting line', from: 0.6, to: RUN + 0.5 },
    { kind: 'label', x: 60, y: 2.5, text: 'Rebound line', from: 1.4, to: RUN + 0.5 },
  ],
  setup: [
    'Two lines at the wings, just outside the three-point line.',
    'Shooting line on the right with the ball, rebound line on the left.',
  ],
  howItRuns: [
    'The front shooter passes to the front rebounder and cuts to the rim.',
    'The rebounder passes back on the run and the shooter lays it up.',
    'The rebounder catches it out of the net and passes to the next shooter.',
    'Shooter joins the back of the rebound line; rebounder joins the back of the shooting line.',
  ],
  coachingPoints: [
    {
      title: 'Shooter',
      points: [
        'Pass, then sprint. Don\'t admire the pass.',
        'Show a target hand and catch on the run.',
        'Right side: left foot, right hand, use the backboard.',
      ],
    },
    {
      title: 'Rebounder',
      points: [
        'Lead the shooter: pass to where they\'re going.',
        'Follow the shot and catch it before it hits the floor.',
        'Call the next shooter\'s name before you pass.',
      ],
    },
  ],
  mistakes: [
    'Shooter jogging, so the rebounder passes to a standing target.',
    'Travelling: too many steps after the catch.',
    'Rebounder waiting for the ball to bounce.',
    'Players going back to the same line instead of switching.',
  ],
  progressions: [
    'Switch sides so shooters finish with the left hand.',
    'Add a second ball so the lines run faster.',
    'Finish with a jump stop and pump fake instead of a layup.',
    'Count makes in a row as a team; start again after a miss.',
  ],
};
