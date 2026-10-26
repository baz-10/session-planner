import { closeouts } from './drills/closeouts';
import { elevenManBreak } from './drills/eleven-man-break';
import { pickAndRoll } from './drills/pick-and-roll';
import { shellDrill } from './drills/shell-drill';
import { threeManWeave } from './drills/three-man-weave';
import { threeOnTwoPlusOne } from './drills/three-on-two-plus-one';
import type { DrillAnimation } from './types';

export const DRILL_ANIMATIONS: DrillAnimation[] = [threeOnTwoPlusOne, elevenManBreak, threeManWeave, pickAndRoll, shellDrill, closeouts];

export function getDrillAnimation(slug: string): DrillAnimation | undefined {
  return DRILL_ANIMATIONS.find((drill) => drill.slug === slug);
}

export * from './types';
