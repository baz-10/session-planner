import { backdoorCut } from './drills/backdoor-cut';
import { boxOut } from './drills/box-out';
import { closeouts } from './drills/closeouts';
import { driveAndKick } from './drills/drive-and-kick';
import { elevenManBreak } from './drills/eleven-man-break';
import { giveAndGo } from './drills/give-and-go';
import { helpAndRecover } from './drills/help-and-recover';
import { layupLines } from './drills/layup-lines';
import { mikanDrill } from './drills/mikan-drill';
import { pickAndRoll } from './drills/pick-and-roll';
import { shellDrill } from './drills/shell-drill';
import { spotShooting } from './drills/spot-shooting';
import { threeManWeave } from './drills/three-man-weave';
import { threeOnTwoPlusOne } from './drills/three-on-two-plus-one';
import { twoOnOne } from './drills/two-on-one';
import { zigZag } from './drills/zig-zag';
import type { DrillAnimation } from './types';

// Ordered roughly as a session runs: warm-ups and finishing, shooting, transition, offence, then defence.
export const DRILL_ANIMATIONS: DrillAnimation[] = [
  mikanDrill,
  layupLines,
  threeManWeave,
  spotShooting,
  twoOnOne,
  threeOnTwoPlusOne,
  elevenManBreak,
  giveAndGo,
  backdoorCut,
  driveAndKick,
  pickAndRoll,
  zigZag,
  closeouts,
  shellDrill,
  helpAndRecover,
  boxOut,
];

export function getDrillAnimation(slug: string): DrillAnimation | undefined {
  return DRILL_ANIMATIONS.find((drill) => drill.slug === slug);
}

export * from './types';
