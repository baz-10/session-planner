'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePlays } from '@/hooks/use-plays';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from '@/components/ui/toast';
import { validateBasketballPlayDocument } from '@/lib/plays/diagram-validation';
import {
  CORE_PLAY_TEMPLATES,
  getTemplateById,
  type PlayTemplate,
} from '@/lib/plays/templates';
import type {
  ActionType,
  AnimationTrigger,
  BasketballPlayDocument,
  CourtTemplate,
  PlayAction,
  PlayActionAnimation,
  PlayObject,
  PlayObjectType,
  PlayPhase,
  PlayType,
} from '@/lib/plays/diagram-types';
import {
  buildScreenTCapPoints,
  buildStraightPoints,
  buildWavyArrowPoints,
  getActionVisualStyle,
} from '@/lib/plays/action-rendering';
import {
  compilePlayPlayback,
  DEFAULT_ACTION_DURATION_MS,
  getPhaseActionWarnings,
  getTransitionFrame,
} from '@/lib/plays/play-animation';
import {
  Arrow,
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from 'react-konva/lib/ReactKonvaCore';
import 'konva/lib/shapes/Arrow';
import 'konva/lib/shapes/Circle';
import 'konva/lib/shapes/Image';
import 'konva/lib/shapes/Line';
import 'konva/lib/shapes/Rect';
import 'konva/lib/shapes/Text';

const NORMALIZED_SIZE = 1000;
const DESKTOP_STAGE_SIZE = 720;
const MOBILE_STAGE_SIZE = 340;
const PLAYBACK_SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

const COURT_TEMPLATE_ASSET: Record<CourtTemplate, string> = {
  half_court: '/courts/basketball-half-court.svg',
  full_court_vertical: '/courts/basketball-full-court-vertical.svg',
  full_court_horizontal: '/courts/basketball-full-court-horizontal.svg',
};

type ToastVariant = NonNullable<ToastProps['variant']>;

interface EditorToast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface PlayEditorProps {
  playId?: string;
  initialTemplateId?: string;
}

interface EditablePlayState {
  id?: string;
  name: string;
  description: string;
  playType: PlayType;
  courtTemplate: CourtTemplate;
  tagsInput: string;
  diagram: BasketballPlayDocument;
  version: number;
  thumbnailDataUrl: string | null;
}

interface PlaybackState {
  isPlaying: boolean;
  phaseIndex: number;
  elapsedMs: number;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(NORMALIZED_SIZE, value));
}

function cloneObject(object: PlayObject): PlayObject {
  return {
    ...object,
    id: uid('obj'),
    position: { ...object.position },
  };
}

function cloneAction(action: PlayAction, objectIdMap: Record<string, string>, clearActions = false): PlayAction {
  return {
    ...action,
    id: uid('act'),
    from: { ...action.from },
    to: { ...action.to },
    fromObjectId: action.fromObjectId ? objectIdMap[action.fromObjectId] : undefined,
    toObjectId: action.toObjectId ? objectIdMap[action.toObjectId] : undefined,
    animation: action.animation
      ? {
          trigger: action.animation.trigger,
          durationMs: action.animation.durationMs,
        }
      : undefined,
    ...(clearActions ? { type: 'cut' as ActionType } : {}),
  };
}

function createEmptyPhase(name = 'Phase'): PlayPhase {
  return {
    id: uid('phase'),
    name,
    objects: [],
    actions: [],
    ballOwnerObjectId: undefined,
  };
}

function stageToNormalized(stageCoord: number, stageSize: number): number {
  return clamp((stageCoord / stageSize) * NORMALIZED_SIZE);
}

function normalizedToStage(normCoord: number, stageSize: number): number {
  return (normCoord / NORMALIZED_SIZE) * stageSize;
}

function parseTags(tagsInput: string): string[] {
  return Array.from(new Set(tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean)));
}

function ensureActionAnimation(action: PlayAction): PlayActionAnimation {
  return {
    trigger: action.animation?.trigger || 'after_previous',
    durationMs: Math.max(120, action.animation?.durationMs || DEFAULT_ACTION_DURATION_MS),
  };
}

function isPlayerObjectType(type: PlayObjectType): boolean {
  return type === 'offense_player' || type === 'defense_player';
}

function formatObjectLabel(object: PlayObject): string {
  return object.label || object.type;
}

function cloneDiagram(diagram: BasketballPlayDocument): BasketballPlayDocument {
  return {
    schemaVersion: 1,
    courtTemplate: diagram.courtTemplate,
    phases: diagram.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      ballOwnerObjectId: phase.ballOwnerObjectId,
      objects: phase.objects.map((object) => ({
        ...object,
        position: { ...object.position },
      })),
      actions: phase.actions.map((action) => ({
        ...action,
        from: { ...action.from },
        to: { ...action.to },
        animation: action.animation
          ? {
              trigger: action.animation.trigger,
              durationMs: action.animation.durationMs,
            }
          : undefined,
      })),
    })),
  };
}

function normalizeDiagram(
  candidate: unknown,
  fallbackCourtTemplate: CourtTemplate
): BasketballPlayDocument {
  const validation = validateBasketballPlayDocument(candidate);
  if (validation.valid) {
    return cloneDiagram(candidate as BasketballPlayDocument);
  }

  return {
    schemaVersion: 1,
    courtTemplate: fallbackCourtTemplate,
    phases: [createEmptyPhase('Phase 1')],
  };
}

function defaultStateFromTemplate(template: PlayTemplate): EditablePlayState {
  return {
    name: template.name,
    description: template.description,
    playType: template.playType,
    courtTemplate: template.courtTemplate,
    tagsInput: template.tags.join(', '),
    diagram: cloneDiagram(template.diagram),
    version: 1,
    thumbnailDataUrl: null,
  };
}

export function PlayEditor({ playId, initialTemplateId }: PlayEditorProps) {
  const router = useRouter();
  const stageRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  const { currentTeam, teamMemberships } = useAuth();
  const { getPlay, createPlay, updatePlay, isLoading } = usePlays();

  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionType, setSelectedActionType] = useState<ActionType>('cut');
  const [isMobile, setIsMobile] = useState(false);
  const [templateToLoad, setTemplateToLoad] = useState('');
  const [toasts, setToasts] = useState<EditorToast[]>([]);
  const [courtImage, setCourtImage] = useState<HTMLImageElement | null>(null);
  const [courtImageStatus, setCourtImageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playbackSpeed, setPlaybackSpeed] = useState<(typeof PLAYBACK_SPEED_OPTIONS)[number]>(1);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    phaseIndex: 0,
    elapsedMs: 0,
  });

  const [play, setPlay] = useState<EditablePlayState>(() =>
    defaultStateFromTemplate(getTemplateById(initialTemplateId))
  );

  const stageSize = isMobile ? MOBILE_STAGE_SIZE : DESKTOP_STAGE_SIZE;

  const membership = teamMemberships.find((item) => item.team.id === currentTeam?.id);
  const canEdit = membership?.role === 'coach' || membership?.role === 'admin';
  const isPlaybackPreviewing =
    playbackState.isPlaying || playbackState.elapsedMs > 0;
  const editingEnabled = canEdit && !isMobile && !isPlaybackPreviewing;
  const readOnlyMessage = !canEdit
    ? 'You can view this play, but only coaches/admins can edit plays.'
    : isMobile
    ? 'Mobile view is read-only in V1. Open on desktop to edit this play.'
    : isPlaybackPreviewing
    ? 'Playback preview is active. Pause or jump phases to resume editing.'
    : null;

  const safeActivePhaseIndex = Math.max(
    0,
    Math.min(activePhaseIndex, Math.max(0, play.diagram.phases.length - 1))
  );
  const activePhase = play.diagram.phases[safeActivePhaseIndex] || play.diagram.phases[0];

  const compiledPlayback = useMemo(
    () => compilePlayPlayback(play.diagram, playbackSpeed),
    [play.diagram, playbackSpeed]
  );
  const activeTransition = compiledPlayback.transitions[playbackState.phaseIndex];
  const playbackFrame = useMemo(() => {
    if (!activeTransition) {
      return null;
    }
    return getTransitionFrame(activeTransition, playbackState.elapsedMs);
  }, [activeTransition, playbackState.elapsedMs]);

  const displayPhaseIndex = isPlaybackPreviewing
    ? Math.min(playbackState.phaseIndex, play.diagram.phases.length - 1)
    : safeActivePhaseIndex;
  const displayPhase = play.diagram.phases[displayPhaseIndex] || play.diagram.phases[0];

  const displayPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    const sourcePhase = displayPhase || activePhase;
    if (!sourcePhase) {
      return map;
    }

    for (const object of sourcePhase.objects) {
      map[object.id] = { ...object.position };
    }

    if (playbackFrame) {
      for (const [objectId, position] of Object.entries(playbackFrame.positions)) {
        map[objectId] = { ...position };
      }
    }

    return map;
  }, [displayPhase, activePhase, playbackFrame]);

  const currentBallOwnerObjectId = playbackFrame
    ? playbackFrame.ballOwnerObjectId
    : compiledPlayback.phaseStartOwners[displayPhaseIndex] || null;
  const phaseWarnings = useMemo(
    () => (activePhase ? getPhaseActionWarnings(activePhase) : []),
    [activePhase]
  );
  const canAnimate = play.diagram.phases.length > 1 && compiledPlayback.transitions.length > 0;
  const navigationPhaseIndex = isPlaybackPreviewing
    ? playbackState.phaseIndex
    : safeActivePhaseIndex;
  const isFirstPhase = navigationPhaseIndex <= 0;
  const isLastPhase = navigationPhaseIndex >= play.diagram.phases.length - 1;

  const allTags = useMemo(() => parseTags(play.tagsInput), [play.tagsInput]);
  const selectedObject = useMemo(
    () => activePhase?.objects.find((object) => object.id === selectedObjectId) || null,
    [activePhase, selectedObjectId]
  );
  const selectedAction = useMemo(
    () => activePhase?.actions.find((action) => action.id === selectedActionId) || null,
    [activePhase, selectedActionId]
  );

  const showToast = useCallback(
    (title: string, description: string | undefined, variant: ToastVariant) => {
      const id = uid('toast');
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3500);
    },
    []
  );

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 768);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const image = new window.Image();
    let cancelled = false;

    setCourtImageStatus('loading');
    image.onload = () => {
      if (cancelled) return;
      setCourtImage(image);
      setCourtImageStatus('ready');
    };
    image.onerror = () => {
      if (cancelled) return;
      console.error('Failed to load court template:', COURT_TEMPLATE_ASSET[play.courtTemplate]);
      setCourtImage(null);
      setCourtImageStatus('error');
    };
    image.src = COURT_TEMPLATE_ASSET[play.courtTemplate];

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [play.courtTemplate]);

  useEffect(() => {
    let cancelled = false;

    if (!playId) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const data = await getPlay(playId);
      if (cancelled) return;

      if (!data) {
        setLoadError('Play not found or you do not have access to it.');
        return;
      }

      setPlay({
        id: data.id,
        name: data.name,
        description: data.description || '',
        playType: data.play_type,
        courtTemplate: data.court_template,
        tagsInput: (data.tags || []).join(', '),
        diagram: normalizeDiagram(data.diagram, data.court_template),
        version: data.version,
        thumbnailDataUrl: data.thumbnail_data_url,
      });
      setActivePhaseIndex(0);
      setHasUnsavedChanges(false);
      setPlaybackState({
        isPlaying: false,
        phaseIndex: 0,
        elapsedMs: 0,
      });
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTsRef.current = null;
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [playId, getPlay]);

  const markChanged = useCallback(() => {
    setHasUnsavedChanges(true);
    setPlaybackState((prev) => ({
      ...prev,
      isPlaying: false,
      elapsedMs: 0,
      phaseIndex: safeActivePhaseIndex,
    }));
    lastFrameTsRef.current = null;
  }, [safeActivePhaseIndex]);

  const stopAnimationLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTsRef.current = null;
  }, []);

  const jumpToPhase = useCallback(
    (nextPhaseIndex: number) => {
      const clampedIndex = Math.max(
        0,
        Math.min(nextPhaseIndex, Math.max(0, play.diagram.phases.length - 1))
      );
      setActivePhaseIndex(clampedIndex);
      setPlaybackState({
        isPlaying: false,
        phaseIndex: clampedIndex,
        elapsedMs: 0,
      });
      stopAnimationLoop();
    },
    [play.diagram.phases.length, stopAnimationLoop]
  );

  const startPlayback = useCallback(
    (fromPhaseIndex: number) => {
      const clampedIndex = Math.max(
        0,
        Math.min(fromPhaseIndex, Math.max(0, play.diagram.phases.length - 1))
      );
      setActivePhaseIndex(clampedIndex);
      setPlaybackState({
        isPlaying: true,
        phaseIndex: clampedIndex,
        elapsedMs: 0,
      });
      lastFrameTsRef.current = null;
    },
    [play.diagram.phases.length]
  );

  const togglePlayback = useCallback(() => {
    if (play.diagram.phases.length <= 1) {
      return;
    }

    setPlaybackState((prev) => {
      const hasReachedEnd =
        prev.phaseIndex >= play.diagram.phases.length - 1;
      if (hasReachedEnd) {
        return {
          isPlaying: true,
          phaseIndex: 0,
          elapsedMs: 0,
        };
      }

      return {
        ...prev,
        isPlaying: !prev.isPlaying,
      };
    });
    lastFrameTsRef.current = null;
  }, [play.diagram.phases.length]);

  useEffect(() => {
    if (!playbackState.isPlaying) {
      stopAnimationLoop();
      return;
    }

    const step = (timestamp: number) => {
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = timestamp;
      }
      const deltaMs = timestamp - lastFrameTsRef.current;
      lastFrameTsRef.current = timestamp;

      setPlaybackState((prev) => {
        if (!prev.isPlaying) {
          return prev;
        }

        const transitions = compiledPlayback.transitions;
        if (!transitions.length) {
          return {
            isPlaying: false,
            phaseIndex: Math.max(0, play.diagram.phases.length - 1),
            elapsedMs: 0,
          };
        }

        if (prev.phaseIndex >= play.diagram.phases.length - 1) {
          return {
            isPlaying: false,
            phaseIndex: play.diagram.phases.length - 1,
            elapsedMs: 0,
          };
        }

        let nextPhaseIndex = prev.phaseIndex;
        let nextElapsed = prev.elapsedMs + deltaMs;

        while (nextPhaseIndex < transitions.length) {
          const transitionDuration = transitions[nextPhaseIndex].timeline.totalDurationMs;
          if (nextElapsed <= transitionDuration) {
            break;
          }

          nextElapsed -= transitionDuration;
          nextPhaseIndex += 1;
        }

        if (nextPhaseIndex >= transitions.length) {
          return {
            isPlaying: false,
            phaseIndex: play.diagram.phases.length - 1,
            elapsedMs: 0,
          };
        }

        return {
          isPlaying: true,
          phaseIndex: nextPhaseIndex,
          elapsedMs: nextElapsed,
        };
      });

      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => stopAnimationLoop();
  }, [
    compiledPlayback.transitions,
    play.diagram.phases.length,
    playbackState.isPlaying,
    stopAnimationLoop,
  ]);

  useEffect(() => {
    if (!isPlaybackPreviewing) {
      return;
    }
    if (playbackState.phaseIndex !== safeActivePhaseIndex) {
      setActivePhaseIndex(playbackState.phaseIndex);
    }
  }, [isPlaybackPreviewing, playbackState.phaseIndex, safeActivePhaseIndex]);

  useEffect(() => {
    if (safeActivePhaseIndex !== activePhaseIndex) {
      setActivePhaseIndex(safeActivePhaseIndex);
    }
  }, [activePhaseIndex, safeActivePhaseIndex]);

  useEffect(() => {
    const maxIndex = Math.max(0, play.diagram.phases.length - 1);
    if (playbackState.phaseIndex > maxIndex) {
      setPlaybackState({
        isPlaying: false,
        phaseIndex: maxIndex,
        elapsedMs: 0,
      });
      stopAnimationLoop();
    }
  }, [play.diagram.phases.length, playbackState.phaseIndex, stopAnimationLoop]);

  const updateActivePhase = useCallback(
    (nextPhase: PlayPhase) => {
      setPlay((prev) => {
        const phases = prev.diagram.phases.map((phase, index) =>
          index === safeActivePhaseIndex ? nextPhase : phase
        );

        return {
          ...prev,
          diagram: {
            ...prev.diagram,
            phases,
          },
        };
      });
      markChanged();
    },
    [markChanged, safeActivePhaseIndex]
  );

  const updatePhaseName = useCallback(
    (index: number, name: string) => {
      setPlay((prev) => ({
        ...prev,
        diagram: {
          ...prev.diagram,
          phases: prev.diagram.phases.map((phase, phaseIndex) =>
            phaseIndex === index ? { ...phase, name } : phase
          ),
        },
      }));
      markChanged();
    },
    [markChanged]
  );

  const addObject = useCallback(
    (type: PlayObjectType, label?: string) => {
      if (!activePhase || !editingEnabled) return;

      const baseObject: PlayObject = {
        id: uid('obj'),
        type,
        label,
        position: {
          x: 500 + (activePhase.objects.length % 5) * 50 - 100,
          y: 650 - (activePhase.objects.length % 3) * 70,
        },
        size: 20,
      };

      if (type === 'text') {
        baseObject.label = label || 'TEXT';
      }

      if (type === 'shape_rect') {
        baseObject.width = 100;
        baseObject.height = 60;
      }

      if (type === 'shape_circle') {
        baseObject.size = 40;
      }

      const shouldSetInitialOwner =
        (type === 'offense_player' || type === 'defense_player') &&
        activePhase.ballOwnerObjectId === undefined &&
        !activePhase.objects.some((object) =>
          object.type === 'offense_player' || object.type === 'defense_player'
        );

      updateActivePhase({
        ...activePhase,
        objects: [...activePhase.objects, baseObject],
        ballOwnerObjectId: shouldSetInitialOwner
          ? baseObject.id
          : activePhase.ballOwnerObjectId,
      });
      setSelectedObjectId(baseObject.id);
    },
    [activePhase, editingEnabled, updateActivePhase]
  );

  const addAction = useCallback(
    (type: ActionType) => {
      if (!activePhase || !editingEnabled) return;

      const sourceObject =
        activePhase.objects.find((obj) => obj.id === selectedObjectId) || activePhase.objects[0];

      if (!sourceObject) {
        showToast('Add a player first', 'Place an object on court before creating an action.', 'warning');
        return;
      }

      const nextAction: PlayAction = {
        id: uid('act'),
        type,
        from: { ...sourceObject.position },
        to: {
          x: clamp(sourceObject.position.x + 140),
          y: clamp(sourceObject.position.y - 80),
        },
        fromObjectId: sourceObject.id,
        toObjectId:
          type === 'pass' || type === 'handoff'
            ? activePhase.objects.find(
                (object) =>
                  isPlayerObjectType(object.type) &&
                  object.id !== sourceObject.id
              )?.id
            : undefined,
        animation: {
          trigger: 'after_previous',
          durationMs: DEFAULT_ACTION_DURATION_MS,
        },
      };

      updateActivePhase({
        ...activePhase,
        actions: [...activePhase.actions, nextAction],
      });
      setSelectedActionId(nextAction.id);
      setSelectedActionType(type);
    },
    [activePhase, editingEnabled, selectedObjectId, showToast, updateActivePhase]
  );

  const removeSelectedObject = useCallback(() => {
    if (!activePhase || !selectedObjectId || !editingEnabled) return;

    updateActivePhase({
      ...activePhase,
      objects: activePhase.objects.filter((object) => object.id !== selectedObjectId),
      actions: activePhase.actions.filter(
        (action) => action.fromObjectId !== selectedObjectId && action.toObjectId !== selectedObjectId
      ),
      ballOwnerObjectId:
        activePhase.ballOwnerObjectId === selectedObjectId
          ? undefined
          : activePhase.ballOwnerObjectId,
    });
    setSelectedObjectId(null);
  }, [activePhase, selectedObjectId, editingEnabled, updateActivePhase]);

  const removeSelectedAction = useCallback(() => {
    if (!activePhase || !selectedActionId || !editingEnabled) return;

    updateActivePhase({
      ...activePhase,
      actions: activePhase.actions.filter((action) => action.id !== selectedActionId),
    });
    setSelectedActionId(null);
  }, [activePhase, selectedActionId, editingEnabled, updateActivePhase]);

  useEffect(() => {
    if (!editingEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (selectedObjectId) {
        event.preventDefault();
        removeSelectedObject();
        return;
      }

      if (selectedActionId) {
        event.preventDefault();
        removeSelectedAction();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingEnabled, selectedObjectId, selectedActionId, removeSelectedObject, removeSelectedAction]);

  const duplicatePhase = useCallback(
    (clearActions = false) => {
      if (!activePhase || !editingEnabled) return;

      const objectIdMap: Record<string, string> = {};
      const objects = activePhase.objects.map((object) => {
        const copy = cloneObject(object);
        objectIdMap[object.id] = copy.id;
        return copy;
      });

      const actions = clearActions
        ? []
        : activePhase.actions.map((action) => cloneAction(action, objectIdMap));
      const nextBallOwnerObjectId =
        typeof activePhase.ballOwnerObjectId === 'string'
          ? objectIdMap[activePhase.ballOwnerObjectId] || undefined
          : activePhase.ballOwnerObjectId;

      const nextPhase: PlayPhase = {
        id: uid('phase'),
        name: `Phase ${play.diagram.phases.length + 1}`,
        objects,
        actions,
        ballOwnerObjectId: nextBallOwnerObjectId,
      };

      setPlay((prev) => ({
        ...prev,
        diagram: {
          ...prev.diagram,
          phases: [...prev.diagram.phases, nextPhase],
        },
      }));
      setActivePhaseIndex(play.diagram.phases.length);
      setPlaybackState({
        isPlaying: false,
        phaseIndex: play.diagram.phases.length,
        elapsedMs: 0,
      });
      stopAnimationLoop();
      markChanged();
    },
    [
      activePhase,
      editingEnabled,
      markChanged,
      play.diagram.phases.length,
      stopAnimationLoop,
    ]
  );

  const addEmptyPhase = useCallback(() => {
    if (!editingEnabled) return;

    const nextPhase = createEmptyPhase(`Phase ${play.diagram.phases.length + 1}`);
    setPlay((prev) => ({
      ...prev,
      diagram: {
        ...prev.diagram,
        phases: [...prev.diagram.phases, nextPhase],
      },
    }));
    setActivePhaseIndex(play.diagram.phases.length);
    setPlaybackState({
      isPlaying: false,
      phaseIndex: play.diagram.phases.length,
      elapsedMs: 0,
    });
    stopAnimationLoop();
    markChanged();
  }, [editingEnabled, markChanged, play.diagram.phases.length, stopAnimationLoop]);

  const removePhase = useCallback(
    (index: number) => {
      if (!editingEnabled || play.diagram.phases.length <= 1) return;

      setPlay((prev) => ({
        ...prev,
        diagram: {
          ...prev.diagram,
          phases: prev.diagram.phases.filter((_, phaseIndex) => phaseIndex !== index),
        },
      }));
      const nextPhaseIndex = Math.max(
        0,
        Math.min(safeActivePhaseIndex, play.diagram.phases.length - 2)
      );
      setActivePhaseIndex(nextPhaseIndex);
      setPlaybackState({
        isPlaying: false,
        phaseIndex: nextPhaseIndex,
        elapsedMs: 0,
      });
      stopAnimationLoop();
      markChanged();
    },
    [
      editingEnabled,
      markChanged,
      play.diagram.phases.length,
      safeActivePhaseIndex,
      stopAnimationLoop,
    ]
  );

  const setTemplate = useCallback(
    (templateId: string) => {
      if (!editingEnabled) return;
      const template = getTemplateById(templateId);
      setPlay((prev) => ({
        ...prev,
        playType: template.playType,
        courtTemplate: template.courtTemplate,
        tagsInput: template.tags.join(', '),
        diagram: cloneDiagram(template.diagram),
      }));
      setActivePhaseIndex(0);
      setSelectedObjectId(null);
      setSelectedActionId(null);
      setTemplateToLoad('');
      setPlaybackState({
        isPlaying: false,
        phaseIndex: 0,
        elapsedMs: 0,
      });
      stopAnimationLoop();
      markChanged();
      showToast('Template loaded', `${template.name} has been applied to this play.`, 'info');
    },
    [editingEnabled, markChanged, showToast, stopAnimationLoop]
  );

  const handleObjectDrag = useCallback(
    (objectId: string, stageX: number, stageY: number) => {
      if (!activePhase || !editingEnabled) return;

      const updated = activePhase.objects.map((object) =>
        object.id === objectId
          ? {
              ...object,
              position: {
                x: stageToNormalized(stageX, stageSize),
                y: stageToNormalized(stageY, stageSize),
              },
            }
          : object
      );

      updateActivePhase({
        ...activePhase,
        objects: updated,
      });
    },
    [activePhase, editingEnabled, stageSize, updateActivePhase]
  );

  const handleActionDrag = useCallback(
    (actionId: string, key: 'from' | 'to', stageX: number, stageY: number) => {
      if (!activePhase || !editingEnabled) return;

      const updated = activePhase.actions.map((action) =>
        action.id === actionId
          ? {
              ...action,
              [key]: {
                x: stageToNormalized(stageX, stageSize),
                y: stageToNormalized(stageY, stageSize),
              },
            }
          : action
      );

      updateActivePhase({
        ...activePhase,
        actions: updated,
      });
    },
    [activePhase, editingEnabled, stageSize, updateActivePhase]
  );

  const updateSelectedObject = useCallback(
    (updates: Partial<PlayObject>) => {
      if (!activePhase || !selectedObjectId || !editingEnabled) return;

      updateActivePhase({
        ...activePhase,
        objects: activePhase.objects.map((object) =>
          object.id === selectedObjectId ? { ...object, ...updates } : object
        ),
      });
    },
    [activePhase, selectedObjectId, editingEnabled, updateActivePhase]
  );

  const updateSelectedAction = useCallback(
    (updates: Partial<PlayAction>) => {
      if (!activePhase || !selectedActionId || !editingEnabled) return;

      updateActivePhase({
        ...activePhase,
        actions: activePhase.actions.map((action) =>
          action.id === selectedActionId ? { ...action, ...updates } : action
        ),
      });
    },
    [activePhase, selectedActionId, editingEnabled, updateActivePhase]
  );

  const updateActionById = useCallback(
    (actionId: string, updates: Partial<PlayAction>) => {
      if (!activePhase || !editingEnabled) return;

      updateActivePhase({
        ...activePhase,
        actions: activePhase.actions.map((action) =>
          action.id === actionId ? { ...action, ...updates } : action
        ),
      });
    },
    [activePhase, editingEnabled, updateActivePhase]
  );

  const updateActionAnimation = useCallback(
    (
      actionId: string,
      updates: Partial<PlayActionAnimation>
    ) => {
      if (!activePhase || !editingEnabled) return;

      updateActivePhase({
        ...activePhase,
        actions: activePhase.actions.map((action) => {
          if (action.id !== actionId) {
            return action;
          }

          const existing = ensureActionAnimation(action);
          return {
            ...action,
            animation: {
              ...existing,
              ...updates,
              durationMs: Math.max(
                120,
                Number((updates.durationMs ?? existing.durationMs)) || existing.durationMs
              ),
            },
          };
        }),
      });
    },
    [activePhase, editingEnabled, updateActivePhase]
  );

  const moveActionInTimeline = useCallback(
    (actionId: string, direction: -1 | 1) => {
      if (!activePhase || !editingEnabled) return;
      const currentIndex = activePhase.actions.findIndex((action) => action.id === actionId);
      if (currentIndex < 0) return;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= activePhase.actions.length) return;

      const reordered = [...activePhase.actions];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);

      updateActivePhase({
        ...activePhase,
        actions: reordered,
      });
    },
    [activePhase, editingEnabled, updateActivePhase]
  );

  const setPhaseBallOwner = useCallback(
    (value: string) => {
      if (!activePhase || !editingEnabled) return;

      let nextValue: string | null | undefined = undefined;
      if (value === '__none__') {
        nextValue = null;
      } else if (value !== '__carry__') {
        nextValue = value;
      }

      updateActivePhase({
        ...activePhase,
        ballOwnerObjectId: nextValue,
      });
    },
    [activePhase, editingEnabled, updateActivePhase]
  );

  const handlePlayFullAnimation = useCallback(() => {
    if (play.diagram.phases.length <= 1) {
      showToast('Add more phases', 'Create at least two phases to run full animation.', 'warning');
      return;
    }
    startPlayback(0);
  }, [play.diagram.phases.length, showToast, startPlayback]);

  const handleRestartPlayback = useCallback(() => {
    if (playbackState.phaseIndex >= play.diagram.phases.length) {
      jumpToPhase(0);
      return;
    }
    setPlaybackState((prev) => ({
      ...prev,
      elapsedMs: 0,
      isPlaying: false,
    }));
    lastFrameTsRef.current = null;
  }, [jumpToPhase, play.diagram.phases.length, playbackState.phaseIndex]);

  const handlePreviousPhase = useCallback(() => {
    jumpToPhase((isPlaybackPreviewing ? playbackState.phaseIndex : safeActivePhaseIndex) - 1);
  }, [
    jumpToPhase,
    isPlaybackPreviewing,
    playbackState.phaseIndex,
    safeActivePhaseIndex,
  ]);

  const handleNextPhase = useCallback(() => {
    jumpToPhase((isPlaybackPreviewing ? playbackState.phaseIndex : safeActivePhaseIndex) + 1);
  }, [
    jumpToPhase,
    isPlaybackPreviewing,
    playbackState.phaseIndex,
    safeActivePhaseIndex,
  ]);

  const save = useCallback(async () => {
    if (!play.name.trim()) {
      showToast('Play name required', 'Add a name before saving this play.', 'warning');
      return;
    }

    const validateResult = validateBasketballPlayDocument(play.diagram);
    if (!validateResult.valid) {
      showToast('Diagram is invalid', validateResult.error, 'error');
      return;
    }

    setIsSaving(true);

    let thumbnailDataUrl = play.thumbnailDataUrl;
    try {
      thumbnailDataUrl =
        stageRef.current?.toDataURL({ pixelRatio: 0.5, mimeType: 'image/png' }) || play.thumbnailDataUrl;
    } catch (error) {
      console.error('Unable to generate play thumbnail:', error);
      showToast('Preview image unavailable', 'Saved play without refreshing thumbnail image.', 'warning');
    }

    if (play.id) {
      const nextVersion = hasUnsavedChanges ? play.version + 1 : play.version;
      const result = await updatePlay(play.id, {
        name: play.name.trim(),
        description: play.description.trim() || null,
        play_type: play.playType,
        court_template: play.courtTemplate,
        tags: allTags,
        diagram: play.diagram,
        thumbnail_data_url: thumbnailDataUrl,
        version: nextVersion,
      });

      setIsSaving(false);

      if (!result.success) {
        showToast('Save failed', result.error || 'Failed to save play', 'error');
        return;
      }

      setPlay((prev) => ({
        ...prev,
        version: nextVersion,
        thumbnailDataUrl,
      }));
      setHasUnsavedChanges(false);
      showToast('Play saved', 'Your updates are now available in the play library.', 'success');
      return;
    }

    const result = await createPlay({
      name: play.name.trim(),
      description: play.description.trim() || undefined,
      play_type: play.playType,
      court_template: play.courtTemplate,
      tags: allTags,
      diagram: play.diagram,
      thumbnail_data_url: thumbnailDataUrl,
      version: 1,
    });

    setIsSaving(false);

    if (!result.success || !result.play) {
      showToast('Create failed', result.error || 'Failed to create play', 'error');
      return;
    }

    setHasUnsavedChanges(false);
    showToast('Play created', 'Opening your new play.', 'success');
    router.replace(`/dashboard/plays/${result.play.id}`);
  }, [
    play,
    updatePlay,
    createPlay,
    hasUnsavedChanges,
    allTags,
    router,
    showToast,
  ]);

  if (loadError) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6 text-red-700">
        {loadError}
      </div>
    );
  }

  if (!activePhase) {
    return null;
  }

  return (
    <ToastProvider>
      <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{play.id ? 'Edit Play' : 'Create Play'}</h1>
          <p className="text-sm text-gray-600">
            Build multi-phase basketball diagrams and attach snapshots to session activities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && <span className="text-sm text-orange-600">Unsaved changes</span>}
          <button
            onClick={save}
            disabled={isSaving || isLoading || !canEdit || isMobile || playbackState.isPlaying}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : play.id ? 'Save Play' : 'Create Play'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Name</label>
          <input
            value={play.name}
            onChange={(event) => {
              setPlay((prev) => ({ ...prev, name: event.target.value }));
              markChanged();
            }}
            disabled={!editingEnabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Trans Pin into Thumbs Side"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Play Type</label>
          <select
            value={play.playType}
            onChange={(event) => {
              setPlay((prev) => ({ ...prev, playType: event.target.value as PlayType }));
              markChanged();
            }}
            disabled={!editingEnabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="offense">Offense</option>
            <option value="defense">Defense</option>
            <option value="ato">ATO</option>
            <option value="baseline">Baseline</option>
            <option value="sideline">Sideline</option>
            <option value="special">Special</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Court Template</label>
          <select
            value={play.courtTemplate}
            onChange={(event) => {
              const value = event.target.value as CourtTemplate;
              setPlay((prev) => ({
                ...prev,
                courtTemplate: value,
                diagram: { ...prev.diagram, courtTemplate: value },
              }));
              markChanged();
            }}
            disabled={!editingEnabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="half_court">Half Court</option>
            <option value="full_court_vertical">Full Court Vertical</option>
            <option value="full_court_horizontal">Full Court Horizontal</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Tags</label>
          <input
            value={play.tagsInput}
            onChange={(event) => {
              setPlay((prev) => ({ ...prev, tagsInput: event.target.value }));
              markChanged();
            }}
            disabled={!editingEnabled}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="horns, ato"
          />
        </div>
        <div className="lg:col-span-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</label>
          <textarea
            value={play.description}
            onChange={(event) => {
              setPlay((prev) => ({ ...prev, description: event.target.value }));
              markChanged();
            }}
            disabled={!editingEnabled}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
            placeholder="Quick coaching context for this set."
          />
        </div>
      </div>

      {readOnlyMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          {readOnlyMessage}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">
        <aside className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Phases</h2>
            <span className="text-xs text-gray-500">{play.diagram.phases.length}</span>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {play.diagram.phases.map((phase, index) => (
              <div
                key={phase.id}
                className={`border rounded-md p-2 ${
                  index === safeActivePhaseIndex ? 'border-primary bg-primary/5' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => jumpToPhase(index)}
                  className="w-full text-left"
                >
                  <div className="text-xs text-gray-500 mb-1">Phase {index + 1}</div>
                </button>
                {editingEnabled ? (
                  <input
                    value={phase.name}
                    onChange={(event) => updatePhaseName(index, event.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{phase.name}</p>
                )}
                {editingEnabled && play.diagram.phases.length > 1 && (
                  <button
                    onClick={() => removePhase(index)}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    Delete phase
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => duplicatePhase(true)}
              disabled={!editingEnabled}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              title="Carry forward objects, clear actions"
            >
              Next
            </button>
            <button
              onClick={() => duplicatePhase(false)}
              disabled={!editingEnabled}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Clone
            </button>
            <button
              onClick={addEmptyPhase}
              disabled={!editingEnabled}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Empty
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Load Core Template</label>
            <select
              disabled={!editingEnabled}
              value={templateToLoad}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                setTemplate(value);
              }}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">Choose template...</option>
              {CORE_PLAY_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <div className="bg-slate-100 rounded-lg border border-gray-300 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs text-gray-600">
              {editingEnabled
                ? 'Click to select. Drag objects/actions to reposition.'
                : isPlaybackPreviewing
                ? 'Playback preview mode'
                : 'Read-only preview mode'}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-600">
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200">
                Phase {displayPhaseIndex + 1}
              </span>
              {editingEnabled && (
                <span className="px-2 py-0.5 rounded bg-white border border-gray-200">Delete/Backspace removes selection</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              onClick={togglePlayback}
              disabled={!canAnimate}
              className="px-2.5 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {playbackState.isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={handlePlayFullAnimation}
              disabled={!canAnimate}
              className="px-2.5 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Play Full Animation
            </button>
            <button
              onClick={handleRestartPlayback}
              disabled={!canAnimate}
              className="px-2.5 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Restart
            </button>
            <button
              onClick={handlePreviousPhase}
              disabled={isFirstPhase}
              className="px-2 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={handleNextPhase}
              disabled={isLastPhase}
              className="px-2 py-1.5 text-xs border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="text-[11px] text-gray-600 uppercase tracking-wide">Speed</label>
              <select
                value={playbackSpeed}
                onChange={(event) =>
                  setPlaybackSpeed(
                    Number(event.target.value) as (typeof PLAYBACK_SPEED_OPTIONS)[number]
                  )
                }
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              >
                {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Stage
              width={stageSize}
              height={stageSize}
              ref={stageRef}
              className="rounded-md shadow-inner border border-amber-200"
              onMouseDown={() => {
                if (!editingEnabled) return;
                setSelectedObjectId(null);
                setSelectedActionId(null);
              }}
            >
              <Layer>
                {courtImage ? (
                  <KonvaImage
                    image={courtImage}
                    x={0}
                    y={0}
                    width={stageSize}
                    height={stageSize}
                    listening={false}
                  />
                ) : (
                  <>
                    <Rect x={0} y={0} width={stageSize} height={stageSize} fill="#dfb981" />
                    <Rect
                      x={0}
                      y={0}
                      width={stageSize}
                      height={stageSize}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: 0, y: stageSize }}
                      fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.12)', 1, 'rgba(102,68,32,0.12)']}
                    />
                    <Text
                      x={stageSize * 0.3}
                      y={stageSize * 0.48}
                      text={courtImageStatus === 'error' ? 'Court Template Unavailable' : 'Loading Court Template...'}
                      fontSize={stageSize * 0.03}
                      fill="rgba(255, 249, 235, 0.8)"
                      listening={false}
                    />
                  </>
                )}
              </Layer>

              <Layer>
                {activePhase.actions.map((action) => {
                  const fromX = normalizedToStage(action.from.x, stageSize);
                  const fromY = normalizedToStage(action.from.y, stageSize);
                  const toX = normalizedToStage(action.to.x, stageSize);
                  const toY = normalizedToStage(action.to.y, stageSize);
                  const selected = selectedActionId === action.id;
                  const style = getActionVisualStyle(action.type, selected);
                  const fromPoint = { x: fromX, y: fromY };
                  const toPoint = { x: toX, y: toY };
                  const pathPoints =
                    style.mode === 'wavy_arrow'
                      ? buildWavyArrowPoints(fromPoint, toPoint)
                      : buildStraightPoints(fromPoint, toPoint);
                  const screenCapPoints = buildScreenTCapPoints(fromPoint, toPoint);

                  return (
                    <Fragment key={action.id}>
                      {style.mode === 'screen' ? (
                        <>
                          <Line
                            points={pathPoints}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            lineCap="round"
                            lineJoin="round"
                            onClick={(event) => {
                              event.cancelBubble = true;
                              setSelectedActionId(action.id);
                              setSelectedActionType(action.type);
                            }}
                          />
                          <Line
                            points={screenCapPoints}
                            stroke={style.stroke}
                            strokeWidth={style.strokeWidth}
                            lineCap="round"
                            lineJoin="round"
                            onClick={(event) => {
                              event.cancelBubble = true;
                              setSelectedActionId(action.id);
                              setSelectedActionType(action.type);
                            }}
                          />
                        </>
                      ) : (
                        <Arrow
                          points={pathPoints}
                          stroke={style.stroke}
                          fill={style.fill}
                          strokeWidth={style.strokeWidth}
                          pointerLength={style.pointerLength}
                          pointerWidth={style.pointerWidth}
                          dash={style.dash}
                          lineCap="round"
                          lineJoin="round"
                          onClick={(event) => {
                            event.cancelBubble = true;
                            setSelectedActionId(action.id);
                            setSelectedActionType(action.type);
                          }}
                        />
                      )}
                      {editingEnabled && (
                        <>
                          <Circle
                            x={fromX}
                            y={fromY}
                            radius={selected ? 6 : 5}
                            fill={selected ? '#2563eb' : '#111827'}
                            draggable
                            onDragEnd={(event) =>
                              handleActionDrag(action.id, 'from', event.target.x(), event.target.y())
                            }
                          />
                          <Circle
                            x={toX}
                            y={toY}
                            radius={selected ? 6 : 5}
                            fill={selected ? '#2563eb' : '#111827'}
                            draggable
                            onDragEnd={(event) =>
                              handleActionDrag(action.id, 'to', event.target.x(), event.target.y())
                            }
                          />
                        </>
                      )}
                    </Fragment>
                  );
                })}

              {activePhase.objects.map((object) => {
                const displayPosition = displayPositions[object.id] || object.position;
                const x = normalizedToStage(displayPosition.x, stageSize);
                const y = normalizedToStage(displayPosition.y, stageSize);
                const selected = selectedObjectId === object.id;

                if (object.type === 'shape_rect') {
                  const width = object.width || 110;
                  const height = object.height || 70;
                  return (
                    <Rect
                      key={object.id}
                      x={x - width / 2}
                      y={y - height / 2}
                      width={width}
                      height={height}
                      stroke={selected ? '#2563eb' : '#111827'}
                      strokeWidth={selected ? 3 : 2}
                      fillEnabled={false}
                      draggable={editingEnabled}
                      onDragEnd={(event) => handleObjectDrag(object.id, event.target.x() + width / 2, event.target.y() + height / 2)}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        setSelectedObjectId(object.id);
                      }}
                    />
                  );
                }

                if (object.type === 'shape_circle') {
                  return (
                    <Circle
                      key={object.id}
                      x={x}
                      y={y}
                      radius={object.size || 42}
                      stroke={selected ? '#2563eb' : '#111827'}
                      strokeWidth={selected ? 3 : 2}
                      fillEnabled={false}
                      draggable={editingEnabled}
                      onDragEnd={(event) => handleObjectDrag(object.id, event.target.x(), event.target.y())}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        setSelectedObjectId(object.id);
                      }}
                    />
                  );
                }

                if (object.type === 'cone') {
                  const size = object.size || 18;
                  return (
                    <Line
                      key={object.id}
                      points={[x, y - size, x - size, y + size, x + size, y + size]}
                      closed
                      stroke={selected ? '#2563eb' : '#111827'}
                      fill="#eab308"
                      strokeWidth={2}
                      draggable={editingEnabled}
                      onDragEnd={(event) => handleObjectDrag(object.id, event.target.x(), event.target.y())}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        setSelectedObjectId(object.id);
                      }}
                    />
                  );
                }

                if (object.type === 'text') {
                  return (
                    <Text
                      key={object.id}
                      x={x}
                      y={y}
                      text={object.label || 'TEXT'}
                      fontSize={18}
                      fontStyle={selected ? 'bold' : 'normal'}
                      fill="#111827"
                      draggable={editingEnabled}
                      onDragEnd={(event) => handleObjectDrag(object.id, event.target.x(), event.target.y())}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        setSelectedObjectId(object.id);
                      }}
                    />
                  );
                }

                const radius = object.size || 20;
                const isOffense = object.type === 'offense_player';
                const isDefense = object.type === 'defense_player';
                const isBall = object.type === 'ball';
                const isBallOwner =
                  currentBallOwnerObjectId === object.id &&
                  (isOffense || isDefense);
                const displayLabel =
                  isDefense && object.label ? object.label.replace(/^X/i, '') || 'X' : object.label;
                const tokenStroke = isDefense ? '#7f1d1d' : isBall ? '#7c2d12' : '#0f172a';
                const tokenFill = isDefense ? '#fff5f5' : isBall ? '#fb923c' : '#fff8dc';
                const labelColor = isDefense ? '#991b1b' : isBall ? '#7c2d12' : '#111827';
                const labelSize = isBall ? Math.max(10, Math.round(radius * 0.62)) : Math.max(12, Math.round(radius * 0.75));

                return (
                  <Fragment key={object.id}>
                    {isBallOwner && (
                      <Circle
                        x={x}
                        y={y}
                        radius={radius + 12}
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dash={[5, 4]}
                        listening={false}
                      />
                    )}
                    {selected && (
                      <Circle
                        x={x}
                        y={y}
                        radius={radius + 6}
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="rgba(37, 99, 235, 0.16)"
                        listening={false}
                      />
                    )}
                    <Circle
                      x={x}
                      y={y}
                      radius={radius}
                      fill={tokenFill}
                      stroke={tokenStroke}
                      strokeWidth={isDefense ? 2.5 : 3}
                      shadowColor="rgba(15, 23, 42, 0.22)"
                      shadowBlur={5}
                      shadowOffsetY={1}
                      draggable={editingEnabled}
                      onDragEnd={(event) => handleObjectDrag(object.id, event.target.x(), event.target.y())}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        setSelectedObjectId(object.id);
                      }}
                    />
                    {(isOffense || isDefense) && (
                      <Circle
                        x={x}
                        y={y}
                        radius={Math.max(5, radius - 4)}
                        stroke={isDefense ? 'rgba(185, 28, 28, 0.38)' : 'rgba(15, 23, 42, 0.22)'}
                        strokeWidth={1.5}
                        listening={false}
                      />
                    )}
                    {isDefense && (
                      <>
                        <Line
                          points={[x - radius * 0.52, y - radius * 0.52, x + radius * 0.52, y + radius * 0.52]}
                          stroke="rgba(185, 28, 28, 0.32)"
                          strokeWidth={1.8}
                          listening={false}
                        />
                        <Line
                          points={[x + radius * 0.52, y - radius * 0.52, x - radius * 0.52, y + radius * 0.52]}
                          stroke="rgba(185, 28, 28, 0.32)"
                          strokeWidth={1.8}
                          listening={false}
                        />
                      </>
                    )}
                    {isBall && (
                      <>
                        <Line
                          points={[x - radius * 0.65, y, x + radius * 0.65, y]}
                          stroke="rgba(124, 45, 18, 0.75)"
                          strokeWidth={1.6}
                          listening={false}
                        />
                        <Line
                          points={[x, y - radius * 0.65, x, y + radius * 0.65]}
                          stroke="rgba(124, 45, 18, 0.75)"
                          strokeWidth={1.6}
                          listening={false}
                        />
                      </>
                    )}
                    {displayLabel && (
                      <Text
                        x={x - radius}
                        y={y - radius}
                        width={radius * 2}
                        height={radius * 2}
                        align="center"
                        verticalAlign="middle"
                        text={displayLabel}
                        fontSize={labelSize}
                        fontStyle={isOffense ? '700' : '600'}
                        fill={labelColor}
                        listening={false}
                      />
                    )}
                  </Fragment>
                );
              })}
              </Layer>
            </Stage>
          </div>

          {!isMobile && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Animation Timeline (Phase {safeActivePhaseIndex + 1})
                </h3>
                <div className="flex items-center gap-2">
                  {phaseWarnings.length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                      {phaseWarnings.length} warning{phaseWarnings.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">
                    Legacy default: After Previous
                  </span>
                </div>
              </div>

              {activePhase.actions.length === 0 ? (
                <div className="text-xs text-gray-500 py-1">
                  Add actions to this phase to build animation steps.
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {activePhase.actions.map((action, index) => {
                    const animation = ensureActionAnimation(action);
                    const sourceObject = activePhase.objects.find(
                      (object) => object.id === action.fromObjectId
                    );
                    const targetObject = activePhase.objects.find(
                      (object) => object.id === action.toObjectId
                    );
                    const requiresTarget =
                      action.type === 'pass' || action.type === 'handoff';

                    return (
                      <div
                        key={action.id}
                        className={`rounded border p-2 space-y-2 ${
                          selectedActionId === action.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedActionId(action.id);
                              setSelectedActionType(action.type);
                            }}
                            className="text-left text-xs text-gray-700 hover:text-gray-900"
                          >
                            <span className="font-semibold mr-1">#{index + 1}</span>
                            <span className="capitalize">{action.type}</span>
                            {sourceObject && (
                              <span className="text-gray-500">
                                {' '}
                                {formatObjectLabel(sourceObject)}
                              </span>
                            )}
                            {targetObject && (
                              <span className="text-gray-500">
                                {' '}
                                to {formatObjectLabel(targetObject)}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveActionInTimeline(action.id, -1)}
                              disabled={!editingEnabled || index === 0}
                              className="px-1.5 py-0.5 text-[11px] border border-gray-300 rounded disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveActionInTimeline(action.id, 1)}
                              disabled={
                                !editingEnabled ||
                                index === activePhase.actions.length - 1
                              }
                              className="px-1.5 py-0.5 text-[11px] border border-gray-300 rounded disabled:opacity-50"
                            >
                              Down
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <label className="text-[11px] text-gray-600 space-y-1">
                            <span className="block uppercase tracking-wide">Trigger</span>
                            <select
                              value={animation.trigger}
                              disabled={!editingEnabled}
                              onChange={(event) =>
                                updateActionAnimation(action.id, {
                                  trigger: event.target.value as AnimationTrigger,
                                })
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="after_previous">After Previous</option>
                              <option value="with_previous">With Previous</option>
                            </select>
                          </label>

                          <label className="text-[11px] text-gray-600 space-y-1">
                            <span className="block uppercase tracking-wide">Duration (ms)</span>
                            <input
                              type="number"
                              min={120}
                              max={12000}
                              value={Math.round(animation.durationMs)}
                              disabled={!editingEnabled}
                              onChange={(event) =>
                                updateActionAnimation(action.id, {
                                  durationMs: Number(event.target.value),
                                })
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                            />
                          </label>

                          {requiresTarget ? (
                            <label className="text-[11px] text-gray-600 space-y-1">
                              <span className="block uppercase tracking-wide">Target Player</span>
                              <select
                                value={action.toObjectId || ''}
                                disabled={!editingEnabled}
                                onChange={(event) =>
                                  updateActionById(action.id, {
                                    toObjectId: event.target.value || undefined,
                                  })
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                              >
                                <option value="">Select target...</option>
                                {activePhase.objects
                                  .filter((object) => isPlayerObjectType(object.type))
                                  .map((object) => (
                                    <option key={object.id} value={object.id}>
                                      {formatObjectLabel(object)}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          ) : (
                            <div className="text-[11px] text-gray-500 uppercase tracking-wide flex items-center">
                              Visual action
                            </div>
                          )}
                        </div>

                        {requiresTarget && !action.toObjectId && (
                          <div className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                            Missing target: possession stays with current owner.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="bg-white rounded-lg border border-gray-200 p-3 space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Add Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['dribble', 'pass', 'cut', 'screen', 'shot', 'handoff'] as ActionType[]).map((actionType) => (
                <button
                  key={actionType}
                  onClick={() => addAction(actionType)}
                  disabled={!editingEnabled}
                  title={`Add a ${actionType} action from selected object`}
                  className={`px-2 py-1.5 text-xs rounded border ${
                    selectedActionType === actionType
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-gray-300 text-gray-700'
                  } disabled:opacity-50`}
                >
                  {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Add Players</h2>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Offense</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={`o-${number}`}
                  onClick={() => addObject('offense_player', String(number))}
                  disabled={!editingEnabled}
                  title={`Add offense player ${number}`}
                  className="h-8 w-8 rounded-full border-[2.5px] border-slate-900 bg-amber-50 text-xs font-semibold text-slate-900 shadow-sm disabled:opacity-50"
                >
                  {number}
                </button>
              ))}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Defense</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={`x-${number}`}
                  onClick={() => addObject('defense_player', `X${number}`)}
                  disabled={!editingEnabled}
                  title={`Add defense player X${number}`}
                  className="h-8 w-8 rounded-full border-[2.5px] border-red-800 bg-red-50 text-[11px] font-semibold text-red-800 shadow-sm disabled:opacity-50"
                >
                  X{number}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Add Misc</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addObject('ball', 'B')}
                disabled={!editingEnabled}
                title="Add ball marker"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-50"
              >
                Ball
              </button>
              <button
                onClick={() => addObject('cone')}
                disabled={!editingEnabled}
                title="Add cone marker"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-50"
              >
                Cone
              </button>
              <button
                onClick={() => addObject('text', 'TEXT')}
                disabled={!editingEnabled}
                title="Add text annotation"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-50"
              >
                Text
              </button>
              <button
                onClick={() => addObject('shape_rect')}
                disabled={!editingEnabled}
                title="Add rectangle"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-50"
              >
                Rect
              </button>
              <button
                onClick={() => addObject('shape_circle')}
                disabled={!editingEnabled}
                title="Add circle"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-50"
              >
                Circle
              </button>
            </div>
          </section>

          <section className="space-y-2 border-t border-gray-200 pt-3">
            <h2 className="text-sm font-semibold text-gray-900">Selection</h2>
            <div className="text-xs text-gray-600">
              {selectedObject
                ? `Object: ${selectedObject.label || selectedObject.type}`
                : 'Object: none'}
            </div>
            <div className="text-xs text-gray-600">
              {selectedAction
                ? `Action: ${selectedAction.type}`
                : 'Action: none'}
            </div>

            <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Phase Ball Owner</div>
              <select
                value={
                  activePhase.ballOwnerObjectId === undefined
                    ? '__carry__'
                    : activePhase.ballOwnerObjectId === null
                    ? '__none__'
                    : activePhase.ballOwnerObjectId
                }
                disabled={!editingEnabled}
                onChange={(event) => setPhaseBallOwner(event.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              >
                <option value="__carry__">Carry / Auto</option>
                <option value="__none__">None</option>
                {activePhase.objects
                  .filter((object) => isPlayerObjectType(object.type))
                  .map((object) => (
                    <option key={object.id} value={object.id}>
                      {formatObjectLabel(object)}
                    </option>
                  ))}
              </select>
            </div>

            {selectedObject && editingEnabled && (
              <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Object Settings</div>
                <input
                  value={selectedObject.label || ''}
                  onChange={(event) => updateSelectedObject({ label: event.target.value || undefined })}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  placeholder="Label"
                />
                {selectedObject.type !== 'shape_rect' && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-gray-500">Size</div>
                    <input
                      type="range"
                      min={10}
                      max={70}
                      value={selectedObject.size || 20}
                      onChange={(event) =>
                        updateSelectedObject({ size: Number(event.target.value) })
                      }
                      className="w-full"
                    />
                  </div>
                )}
                {selectedObject.type === 'shape_rect' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={20}
                      max={260}
                      value={selectedObject.width || 110}
                      onChange={(event) =>
                        updateSelectedObject({ width: Number(event.target.value) || 110 })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                      placeholder="Width"
                    />
                    <input
                      type="number"
                      min={20}
                      max={220}
                      value={selectedObject.height || 70}
                      onChange={(event) =>
                        updateSelectedObject({ height: Number(event.target.value) || 70 })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                      placeholder="Height"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedAction && editingEnabled && (
              <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Action Settings</div>
                <select
                  value={selectedAction.type}
                  onChange={(event) =>
                    updateSelectedAction({ type: event.target.value as ActionType })
                  }
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="dribble">Dribble</option>
                  <option value="pass">Pass</option>
                  <option value="cut">Cut</option>
                  <option value="screen">Screen</option>
                  <option value="shot">Shot</option>
                  <option value="handoff">Handoff</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-gray-600 space-y-1">
                    <span className="block uppercase tracking-wide">Trigger</span>
                    <select
                      value={ensureActionAnimation(selectedAction).trigger}
                      onChange={(event) =>
                        updateActionAnimation(selectedAction.id, {
                          trigger: event.target.value as AnimationTrigger,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="after_previous">After Previous</option>
                      <option value="with_previous">With Previous</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-gray-600 space-y-1">
                    <span className="block uppercase tracking-wide">Duration</span>
                    <input
                      type="number"
                      min={120}
                      max={12000}
                      value={Math.round(ensureActionAnimation(selectedAction).durationMs)}
                      onChange={(event) =>
                        updateActionAnimation(selectedAction.id, {
                          durationMs: Number(event.target.value),
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                    />
                  </label>
                </div>
                {(selectedAction.type === 'pass' || selectedAction.type === 'handoff') && (
                  <label className="text-[11px] text-gray-600 space-y-1">
                    <span className="block uppercase tracking-wide">Target Player</span>
                    <select
                      value={selectedAction.toObjectId || ''}
                      onChange={(event) =>
                        updateSelectedAction({
                          toObjectId: event.target.value || undefined,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="">Select target...</option>
                      {activePhase.objects
                        .filter((object) => isPlayerObjectType(object.type))
                        .map((object) => (
                          <option key={object.id} value={object.id}>
                            {formatObjectLabel(object)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={removeSelectedObject}
                disabled={!editingEnabled || !selectedObjectId}
                className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded disabled:opacity-50"
                title="Remove selected object (Delete)"
              >
                Remove Object
              </button>
              <button
                onClick={removeSelectedAction}
                disabled={!editingEnabled || !selectedActionId}
                className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded disabled:opacity-50"
                title="Remove selected action (Delete)"
              >
                Remove Action
              </button>
            </div>
          </section>

          <section className="space-y-1 border-t border-gray-200 pt-3">
            <h2 className="text-sm font-semibold text-gray-900">Version</h2>
            <p className="text-xs text-gray-600">Current version: {play.version}</p>
            <p className="text-xs text-gray-600">Tags: {allTags.join(', ') || 'none'}</p>
          </section>
        </aside>
      </div>
      </div>

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          defaultOpen
          duration={3200}
          onOpenChange={(open) => {
            if (!open) {
              setToasts((prev) => prev.filter((item) => item.id !== toast.id));
            }
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
