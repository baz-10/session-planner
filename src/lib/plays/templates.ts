import type {
  BasketballPlayDocument,
  CourtTemplate,
  PlayObject,
  PlayPhase,
  PlayType,
} from './diagram-types';

export interface PlayTemplate {
  id: string;
  name: string;
  description: string;
  playType: PlayType;
  courtTemplate: CourtTemplate;
  tags: string[];
  diagram: BasketballPlayDocument;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function offense(label: string, x: number, y: number): PlayObject {
  return {
    id: uid('obj'),
    type: 'offense_player',
    label,
    position: { x, y },
    size: 18,
  };
}

function defense(label: string, x: number, y: number): PlayObject {
  return {
    id: uid('obj'),
    type: 'defense_player',
    label,
    position: { x, y },
    size: 18,
  };
}

function basePhase(name = 'Phase 1', objects: PlayObject[] = []): PlayPhase {
  return {
    id: uid('phase'),
    name,
    objects,
    actions: [],
  };
}

function makeDoc(courtTemplate: CourtTemplate, phases: PlayPhase[]): BasketballPlayDocument {
  return {
    schemaVersion: 1,
    courtTemplate,
    phases,
  };
}

const halfCourtSpacing = [
  offense('1', 780, 720),
  offense('2', 830, 180),
  offense('3', 170, 180),
  offense('4', 350, 530),
  offense('5', 650, 530),
];

const halfCourtDefense = [
  defense('X1', 740, 680),
  defense('X2', 800, 230),
  defense('X3', 220, 230),
  defense('X4', 390, 490),
  defense('X5', 610, 490),
];

const fullCourtSpacing = [
  offense('1', 500, 850),
  offense('2', 840, 740),
  offense('3', 160, 740),
  offense('4', 330, 530),
  offense('5', 670, 530),
];

function fromObjects(
  id: string,
  name: string,
  description: string,
  playType: PlayType,
  courtTemplate: CourtTemplate,
  tags: string[],
  objects: PlayObject[]
): PlayTemplate {
  return {
    id,
    name,
    description,
    playType,
    courtTemplate,
    tags,
    diagram: makeDoc(courtTemplate, [basePhase('Phase 1', objects)]),
  };
}

export const CORE_PLAY_TEMPLATES: PlayTemplate[] = [
  fromObjects('empty', 'Empty', 'Blank court to draw from scratch.', 'offense', 'half_court', ['empty'], []),
  fromObjects('traditional', 'Traditional', 'Classic balanced half-court alignment.', 'offense', 'half_court', ['traditional'], halfCourtSpacing),
  fromObjects('five_out', '5 Out', 'Perimeter spacing with no low-post anchor.', 'offense', 'half_court', ['5-out', 'spacing'], [
    offense('1', 500, 770),
    offense('2', 850, 220),
    offense('3', 150, 220),
    offense('4', 260, 520),
    offense('5', 740, 520),
  ]),
  fromObjects('princeton', 'Princeton Offense', 'High-post and split-action start.', 'offense', 'half_court', ['princeton'], [
    offense('1', 500, 760),
    offense('2', 820, 220),
    offense('3', 180, 220),
    offense('4', 420, 430),
    offense('5', 580, 430),
  ]),
  fromObjects('box', 'Box', 'Box alignment for baseline/sideline entries.', 'ato', 'half_court', ['box', 'ato'], [
    offense('1', 500, 760),
    offense('2', 360, 380),
    offense('3', 640, 380),
    offense('4', 360, 560),
    offense('5', 640, 560),
  ]),
  fromObjects('one_four_low', '1-4 Low', 'One guard high, four players low.', 'offense', 'half_court', ['1-4-low'], [
    offense('1', 500, 760),
    offense('2', 270, 600),
    offense('3', 730, 600),
    offense('4', 380, 520),
    offense('5', 620, 520),
  ]),
  fromObjects('horns', 'Horns', 'Two elbows with strong-side/weak-side options.', 'offense', 'half_court', ['horns'], [
    offense('1', 500, 760),
    offense('2', 840, 220),
    offense('3', 160, 220),
    offense('4', 400, 460),
    offense('5', 600, 460),
  ]),
  fromObjects('one_four_high', '1-4 High', 'One guard and four across the free throw line extended.', 'offense', 'half_court', ['1-4-high'], [
    offense('1', 500, 760),
    offense('2', 220, 430),
    offense('3', 780, 430),
    offense('4', 380, 460),
    offense('5', 620, 460),
  ]),
  fromObjects('flex', 'Flex', 'Flex continuity spacing as starting shell.', 'offense', 'half_court', ['flex'], halfCourtSpacing),
  fromObjects('zone_2_3', '2-3 Zone', 'Two top defenders, three along baseline line.', 'defense', 'half_court', ['2-3-zone', 'zone'], [
    defense('X1', 420, 400),
    defense('X2', 580, 400),
    defense('X3', 220, 540),
    defense('X4', 500, 560),
    defense('X5', 780, 540),
  ]),
  fromObjects('zone_3_2', '3-2 Zone', 'Three up top, two low defenders.', 'defense', 'half_court', ['3-2-zone', 'zone'], [
    defense('X1', 300, 430),
    defense('X2', 500, 390),
    defense('X3', 700, 430),
    defense('X4', 380, 570),
    defense('X5', 620, 570),
  ]),
  fromObjects('zone_1_3_1', '1-3-1 Zone', 'Point defender with middle three and baseline rover.', 'defense', 'half_court', ['1-3-1-zone', 'zone'], [
    defense('X1', 500, 380),
    defense('X2', 280, 470),
    defense('X3', 500, 490),
    defense('X4', 720, 470),
    defense('X5', 500, 620),
  ]),
  fromObjects('full_court_vertical', 'Full Court Vertical', 'Full-court vertical setup.', 'offense', 'full_court_vertical', ['full-court'], fullCourtSpacing),
  fromObjects('full_court_horizontal', 'Full Court Horizontal', 'Full-court horizontal setup.', 'offense', 'full_court_horizontal', ['full-court'], [
    offense('1', 500, 500),
    offense('2', 740, 300),
    offense('3', 740, 700),
    offense('4', 300, 320),
    offense('5', 300, 680),
  ]),
  fromObjects('traditional_defended', 'Traditional vs Man', 'Traditional offense with matching defenders.', 'offense', 'half_court', ['man', 'traditional'], [
    ...halfCourtSpacing,
    ...halfCourtDefense,
  ]),
];

export function getTemplateById(templateId?: string): PlayTemplate {
  if (!templateId) {
    return CORE_PLAY_TEMPLATES[0];
  }

  return CORE_PLAY_TEMPLATES.find((template) => template.id === templateId) || CORE_PLAY_TEMPLATES[0];
}
