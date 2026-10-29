import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. 2-on-2: 1 has the ball on the right wing, 2 is at the left guard spot.
// 1 beats X1 on a baseline drive, X2 steps across to help, 1 kicks it out to 2, and X2 closes out
// while X1 recovers to 1. The recovery is then replayed at half speed.
const SETUP = 4.5;
const HELP_TAU = 2.4;
const RECOVER_TAU = 4.1;
const HOLD = 3;
const tAt = (tau: number) => (tau <= HELP_TAU ? SETUP + tau : SETUP + tau + HOLD);
const SLOW = { start: tAt(RECOVER_TAU) + HOLD + 0.4, rate: 0.5 };
const slowT = (tau: number) => SLOW.start + (tau - HELP_TAU) / SLOW.rate;
const LENGTH = slowT(RECOVER_TAU) + 3.1;

export const helpAndRecover: DrillAnimation = {
  slug: 'help-and-recover',
  name: 'Help and recover',
  category: 'Defence',
  summary:
    'Two-on-two team defence. The help defender steps across to stop a drive, then sprints back out to close out on their own player when the ball is kicked out.',
  level: 'Intermediate',
  playerCount: '4 (2 on 2)',
  time: '8-10 min',
  equipment: 'Half court, 1 ball',
  focus: ['Help defence', 'Closeouts', 'Recovering', 'Communication'],
  court: 'half',
  length: LENGTH,
  poster: 2.4,
  clock: [
    [0, 0],
    [SETUP, 0],
    [tAt(HELP_TAU), HELP_TAU],
    [tAt(HELP_TAU) + HOLD, HELP_TAU],
    [tAt(RECOVER_TAU), RECOVER_TAU],
    [tAt(RECOVER_TAU) + HOLD, RECOVER_TAU],
    [tAt(RECOVER_TAU) + HOLD, HELP_TAU],
    [SLOW.start, HELP_TAU],
    [slowT(RECOVER_TAU), RECOVER_TAU],
    [LENGTH, RECOVER_TAU],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2 },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.35 },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.8 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 0.95 },
  ],
  tracks: {
    O1: [[0, 76, 42], [1.0, 76, 42], [1.6, 82, 43.5], [2.2, 85.5, 38], [2.5, 85.8, 37], [5.5, 85.8, 37]],
    O2: [[0, 63, 20], [2.6, 63, 20], [3.0, 62.5, 19.5], [5.5, 62.5, 19.5]],
    X1: [[0, 77.8, 39.6], [1.0, 77.8, 39.6], [1.6, 79.5, 41], [2.2, 82.5, 40.5], [2.6, 83, 39.3], [3.3, 82.8, 36.5], [5.5, 82.8, 36.5]],
    X2: [[0, 72, 25], [1.3, 72, 25], [2.1, 82.5, 33.5], [2.4, 83.5, 34.5], [2.6, 83.5, 34.5], [3.3, 70, 24.5], [3.8, 66, 22], [4.1, 65.2, 21.6], [5.5, 65.2, 21.6]],
  },
  ball: [
    { type: 'hold', player: 'O1', start: 0, end: 2.5 },
    { type: 'pass', from: 'O1', to: 'O2', start: 2.5, end: 3.0 },
    { type: 'hold', player: 'O2', start: 3.0, end: 5.5, dribble: 'never' },
  ],
  arrows: [
    { show: 2.4, hide: tAt(1.0), from: 1.0, to: 2.5, players: ['O1'] },
    { show: tAt(HELP_TAU) + 0.1, hide: tAt(HELP_TAU) + HOLD, from: 1.3, to: 2.4, players: ['X2'] },
    { show: tAt(HELP_TAU) + HOLD - 0.4, hide: tAt(RECOVER_TAU), from: 2.5, to: RECOVER_TAU, players: ['X2', 'X1'], passes: true },
    { show: SLOW.start - 0.3, hide: slowT(RECOVER_TAU), from: 2.5, to: RECOVER_TAU, players: ['X2'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Two on two',
      body: '1 has the ball on the right wing. 2 is at the left guard spot. X1 and X2 guard them.',
      callout: { player: 'O1', text: 'Ball on the wing' },
    },
    {
      at: 2.2,
      title: 'On ball and in help',
      body: 'X1 pressures the ball. X2 sinks off 2 towards the middle, ready to help.',
      callout: { player: 'X2', text: 'Help side' },
    },
    {
      at: SETUP,
      chapter: 'The drive',
      title: '1 beats X1 baseline',
      body: '1 attacks the baseline and gets past X1.',
      callout: { player: 'O1', text: 'Baseline drive' },
    },
    {
      at: tAt(1.4),
      tone: 'warning',
      title: 'Drive is coming',
      body: 'X1 is beaten. Somebody has to stop the ball.',
      callout: { player: 'X1', text: 'Beaten' },
      quiz: {
        prompt: '1 has beaten X1 to the baseline. Who helps?',
        answer: 'X2',
        choices: ['X1', 'X2', 'O2'],
        explain: 'X2, the help defender, steps across to stop the ball before it gets to the rim. X1 chases to recover.',
      },
    },
    {
      at: tAt(HELP_TAU),
      freeze: true,
      title: 'Help: stop the ball',
      body: 'X2 steps in front of the drive outside the restricted area, feet set, and calls "help!"',
      callout: { player: 'X2', text: 'Help!' },
    },
    {
      at: tAt(HELP_TAU) + HOLD,
      title: 'The kick-out',
      body: '1 picks up the ball and kicks it out to 2, who X2 has left open.',
      callout: { player: 'O1', text: 'Kick out' },
    },
    {
      at: tAt(RECOVER_TAU),
      freeze: true,
      tone: 'success',
      title: 'Recover: close out',
      body: 'X2 sprints back to 2 on the flight of the pass and closes out with a high hand. X1 recovers to 1.',
      callout: { player: 'X2', text: 'Close out, high hand' },
    },
    {
      at: SLOW.start,
      chapter: 'Slow motion',
      title: 'The recovery at half speed',
      body: 'X2 leaves as soon as the ball leaves 1\'s hands, sprints, then chops their feet to arrive under control.',
      callout: { player: 'X2', text: 'Go on the pass' },
    },
    {
      at: slowT(RECOVER_TAU),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Help, then recover',
      body: 'Stop the ball first, then get back to your own player before they can shoot.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'X1', text: 'On ball', from: 2.2, to: SETUP + 0.4 },
    { kind: 'tag', player: 'X2', text: 'Help', from: 2.4, to: SETUP + 0.4 },
    { kind: 'ring', player: 'X2', from: tAt(HELP_TAU), to: tAt(HELP_TAU) + HOLD },
    { kind: 'tag', player: 'X1', text: 'Recover', from: tAt(RECOVER_TAU) + 0.2, to: tAt(RECOVER_TAU) + HOLD },
  ],
  setup: [
    'Two attackers: one on the wing with the ball, one at the opposite guard spot.',
    'Two defenders. The defender away from the ball starts in help, sagged towards the middle.',
  ],
  howItRuns: [
    'The ball handler drives baseline or middle.',
    'The help defender steps across to stop the drive.',
    'The driver kicks the ball out to the open teammate.',
    'The help defender closes out; the beaten defender recovers to their own player.',
    'Play it out live, then rotate.',
  ],
  coachingPoints: [
    {
      title: 'Help',
      points: [
        'Start in help: sink towards the middle so you can see ball and player.',
        'Stop the ball outside the restricted area, with your feet set.',
        'Call "help!" loudly so your teammate knows to recover.',
      ],
    },
    {
      title: 'Recover',
      points: [
        'Go on the flight of the pass, not when the catch is made.',
        'Sprint, then chop your feet and close out with a high hand.',
        'The beaten defender sprints to recover, then takes their own player back.',
      ],
    },
  ],
  mistakes: [
    'Help defender staying glued to their player, so the drive gets to the rim.',
    'Helping too late, inside the restricted area, and giving up a foul.',
    'Recovering slowly and leaving the shooter wide open.',
    'Beaten defender giving up on the play instead of chasing.',
  ],
  progressions: [
    'Let the driver choose baseline or middle.',
    'Add a third pair so the help comes from the weak side.',
    'After the kick-out, play it live to a shot.',
    'Score it: a stop is one point for the defence.',
  ],
};
