export type PlayType = 'offense' | 'defense' | 'ato' | 'baseline' | 'sideline' | 'special';

export type CourtTemplate =
  | 'half_court'
  | 'full_court_vertical'
  | 'full_court_horizontal';

export type PlayObjectType =
  | 'offense_player'
  | 'defense_player'
  | 'ball'
  | 'cone'
  | 'text'
  | 'shape_rect'
  | 'shape_circle';

export type ActionType = 'dribble' | 'pass' | 'cut' | 'screen' | 'shot' | 'handoff';
export type AnimationTrigger = 'after_previous' | 'with_previous';

export interface Point2D {
  x: number;
  y: number;
}

export interface PlayObject {
  id: string;
  type: PlayObjectType;
  label?: string;
  position: Point2D;
  size?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string;
}

export interface PlayActionAnimation {
  trigger: AnimationTrigger;
  durationMs: number;
}

export interface PlayAction {
  id: string;
  type: ActionType;
  from: Point2D;
  to: Point2D;
  fromObjectId?: string;
  toObjectId?: string;
  animation?: PlayActionAnimation;
}

export interface PlayPhase {
  id: string;
  name: string;
  objects: PlayObject[];
  actions: PlayAction[];
  ballOwnerObjectId?: string | null;
}

export interface BasketballPlayDocument {
  schemaVersion: 1;
  courtTemplate: CourtTemplate;
  phases: PlayPhase[];
}
