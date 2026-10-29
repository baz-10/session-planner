import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. A passer (1) at the top and a wing (2).
//   rep 1 (tau 0-3.2):  X2 plays normal defence, so 2 V-cuts to get open on the wing.
//   rep 2 (tau 9.5-13.5): X2 overplays the pass, so 2 plants and cuts backdoor for a bounce pass and a layup.
// A half-speed replay of the backdoor follows.
const SETUP = 3.5;
const tA = (tau: number) => SETUP + tau;
const B = { start: tA(3.2) + 0.5, intro: 1.8, tau0: 9.6, read: 11.25, hold: 3 };
const tB = (tau: number) => {
  const run = B.start + B.intro + (tau - B.tau0);
  return tau <= B.read ? run : run + B.hold;
};
const REPLAY = { at: tB(13.5) + 0.4, from: 10.9, to: 12.9, rate: 0.5 };
const tReplay = (tau: number) => REPLAY.at + 0.4 + (tau - REPLAY.from) / REPLAY.rate;
const LENGTH = tReplay(REPLAY.to) + 3.2;

export const backdoorCut: DrillAnimation = {
  slug: 'backdoor-cut',
  name: 'Backdoor cut',
  category: 'Offence',
  summary:
    'Beat a defender who is denying the pass. Walk them out, plant, and cut behind them to the rim for a bounce pass and a layup.',
  level: 'Beginner',
  playerCount: '4 (passer, wing and two defenders)',
  time: '6-8 min',
  equipment: 'Half court, 1 ball per group',
  focus: ['Cutting', 'Reading the defender', 'Bounce passes', 'Finishing'],
  court: 'half',
  length: LENGTH,
  poster: 2.5,
  clock: [
    [0, 0],
    [SETUP, 0],
    [tA(3.2), 3.2],
    [B.start, 3.2],
    [B.start, B.tau0],
    [B.start + B.intro, B.tau0],
    [tB(B.read), B.read],
    [tB(B.read) + B.hold, B.read],
    [tB(13.5), 13.5],
    [REPLAY.at, 13.5],
    [REPLAY.at, REPLAY.from],
    [tReplay(REPLAY.from), REPLAY.from],
    [tReplay(REPLAY.to), REPLAY.to],
    [LENGTH, REPLAY.to],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2, name: 'Passer (1)' },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.35, name: 'Wing (2)' },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.8 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 0.95 },
  ],
  tracks: {
    O1: [[0, 64, 32], [13.5, 64, 32]],
    X1: [[0, 67.1, 31.1], [13.5, 67.1, 31.1]],
    O2: [
      [0, 79, 40], [1.2, 82, 36], [1.9, 75, 44], [3.2, 75, 44],
      [9.5, 79, 40, 'jump'], [10, 79, 40], [11.0, 75, 44], [11.3, 75.5, 44.5], [11.8, 80, 40], [12.3, 84, 33],
      [12.7, 86, 30], [13.5, 86.5, 29.5],
    ],
    X2: [
      [0, 81.5, 37.5], [1.2, 84.2, 33.8], [1.9, 77.5, 41.2], [3.2, 77.5, 41.2],
      [9.5, 81.5, 37.5, 'jump'], [10, 81.5, 37.5], [11.0, 72.8, 41.7], [11.3, 72.8, 41.7], [11.9, 74.2, 40.8],
      [12.6, 79, 37.5], [13.5, 80.5, 35],
    ],
  },
  ball: [
    { type: 'hold', player: 'O1', start: 0, end: 1.8, dribble: 'never' },
    { type: 'pass', from: 'O1', to: 'O2', start: 1.8, end: 2.25 },
    { type: 'hold', player: 'O2', start: 2.25, end: 3.2, dribble: 'never' },
    { type: 'hold', player: 'O1', start: 9.5, end: 11.8, dribble: 'never' },
    { type: 'pass', from: 'O1', to: 'O2', start: 11.8, end: 12.3, style: 'bounce' },
    { type: 'hold', player: 'O2', start: 12.3, end: 12.45 },
    { type: 'shot', player: 'O2', start: 12.45, end: 12.9 },
  ],
  arrows: [
    { show: SETUP + 0.2, hide: tA(3.2), from: 0, to: 2.25, players: ['O2'], passes: true },
    { show: B.start + 0.3, hide: tB(B.read), from: 10, to: B.read, players: ['O2', 'X2'] },
    { show: tB(B.read) + 0.1, hide: tB(13), from: B.read, to: 12.9, players: ['O2'], passes: true },
    { show: REPLAY.at + 0.1, hide: tReplay(REPLAY.to), from: REPLAY.from, to: 12.9, players: ['O2'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Passer and wing',
      body: '1 has the ball at the top. 2 starts just above the block on the wing side.',
      callout: { player: 'O2', text: 'Wing' },
    },
    {
      at: SETUP,
      chapter: 'Rep 1: V-cut',
      title: 'Walk them in',
      body: 'X2 is playing normal defence. 2 takes a couple of steps toward the basket.',
      callout: { player: 'O2', text: 'Step in' },
    },
    {
      at: tA(1.25),
      title: 'Pop out to the wing',
      body: 'Plant and push back out to the wing: a V shape.',
      callout: { player: 'O2', text: 'V-cut' },
    },
    {
      at: tA(2.25),
      tone: 'success',
      title: 'Catch on the wing',
      body: 'Catch facing the basket, ready to shoot, drive or pass.',
      callout: { player: 'O2', text: 'Triple threat' },
    },
    {
      at: B.start,
      chapter: 'Rep 2: overplayed',
      tone: 'warning',
      title: 'X2 is denying',
      body: 'This time X2 jumps into the passing lane with a hand out, so the V-cut won\'t get the ball.',
      callout: { player: 'X2', text: 'Denying' },
    },
    {
      at: tB(B.read),
      freeze: true,
      title: 'Go backdoor',
      body: 'X2 is above 2 and leaning toward the pass. 2 plants the outside foot and cuts behind X2 to the rim.',
      callout: { player: 'O2', text: 'Plant and go backdoor' },
      quiz: {
        prompt: 'X2 has a hand in the passing lane. Who should cut backdoor?',
        answer: 'O2',
        choices: ['O1', 'O2'],
        explain: 'The wing, 2. When your defender overplays the pass, cut behind them to the basket.',
      },
    },
    {
      at: tB(B.read) + B.hold,
      title: 'Bounce pass',
      body: '1 sees X2\'s back turned and throws a bounce pass ahead of the cutter.',
      callout: { player: 'O1', text: 'Bounce pass' },
    },
    {
      at: tB(12.45),
      tone: 'success',
      title: 'Layup',
      body: 'X2 is still facing the wrong way.',
      callout: { player: 'O2', text: 'Finish' },
    },
    {
      at: REPLAY.at,
      chapter: 'Slow motion',
      title: 'Plant, then go',
      body: 'Half speed: one hard plant on the outside foot, then sprint to the rim.',
      callout: { player: 'O2', text: 'Plant' },
    },
    {
      at: tReplay(REPLAY.to),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Overplayed? Go backdoor',
      body: 'If your defender is in the passing lane, cut behind them. The passer looks for it every time they see a hand in the lane.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'X2', text: 'Denying', from: B.start + B.intro, to: tB(B.read) + B.hold, tone: 'warning' },
    { kind: 'ring', player: 'O2', from: tB(B.read) + 0.1, to: tB(B.read) + B.hold },
  ],
  setup: [
    'A passer at the top of the key with a ball, and a line of wings.',
    'One defender on the wing. Add a defender on the passer once players have the timing.',
  ],
  howItRuns: [
    'The wing starts near the block and works to get open.',
    'If the defender plays normal, V-cut: step in, then pop out to the wing.',
    'If the defender overplays the pass, take them up toward the 3-point line, plant and cut backdoor.',
    'The passer throws a bounce pass ahead of the cutter for a layup.',
    'Rotate wing to defence, defence to passer, passer to the wing line.',
  ],
  coachingPoints: [
    {
      title: 'Cutter',
      points: [
        'Read the defender\'s hand and feet. Hand in the lane means backdoor.',
        'Take them high first so there is space behind them.',
        'Plant on the outside foot and sprint. No drifting.',
      ],
    },
    {
      title: 'Passer',
      points: [
        'Bounce pass, away from the defender, ahead of the cutter.',
        'A fake pass to the wing helps freeze the defender.',
        'Communicate: some teams use a word or a fist to call the backdoor.',
      ],
    },
  ],
  mistakes: [
    'Cutting backdoor from too close to the basket, with no space to cut into.',
    'Rounding the cut instead of planting hard.',
    'Throwing a chest pass that the recovering defender can tip.',
  ],
  progressions: [
    'Defender chooses to play normal or deny; the wing reads it.',
    'Add a help defender in the lane so the passer must read the help too.',
    'Run it from both wings and from the corner.',
  ],
};
