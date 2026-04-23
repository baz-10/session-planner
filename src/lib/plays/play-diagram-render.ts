import {
  buildScreenTCapPoints,
  buildStraightPoints,
  buildWavyArrowPoints,
  getActionVisualStyle,
  type StagePoint,
} from '@/lib/plays/action-rendering';
import type {
  ActionType,
  BasketballPlayDocument,
  CourtTemplate,
  PlayAction,
  PlayObject,
  PlayObjectType,
  PlayPhase,
} from '@/lib/plays/diagram-types';
import type { PlayEditorTheme } from '@/lib/plays/play-theme';

export const COURT_TEMPLATE_ASSET: Record<CourtTemplate, string> = {
  half_court: '/courts/basketball-half-court.svg',
  full_court_vertical: '/courts/basketball-full-court-vertical.svg',
  full_court_horizontal: '/courts/basketball-full-court-horizontal.svg',
};

interface SvgMarkupOptions {
  courtTemplate: CourtTemplate;
  theme: PlayEditorTheme;
  idPrefix?: string;
}

interface DiagramSvgOptions extends SvgMarkupOptions {
  diagram: BasketballPlayDocument | null | undefined;
  phaseIndex?: number;
}

interface PlayerTokenAppearance {
  fill: string;
  stroke: string;
  strokeWidth: number;
  labelColor: string;
  haloFill?: string;
  innerStroke?: string;
  lineAccent?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeIdPrefix(prefix: string): string {
  return prefix.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getId(idPrefix: string, suffix: string): string {
  return `${sanitizeIdPrefix(idPrefix)}-${suffix}`;
}

export function getPlayerTokenAppearance(
  theme: PlayEditorTheme,
  type: PlayObjectType
): PlayerTokenAppearance {
  if (type === 'defense_player') {
    if (theme === 'hardwood') {
      return {
        fill: '#0f1f33',
        stroke: '#0f1f33',
        strokeWidth: 2,
        labelColor: '#fff8ed',
      };
    }

    if (theme === 'tactical') {
      return {
        fill: '#f97316',
        stroke: '#f97316',
        strokeWidth: 2,
        labelColor: '#ffffff',
      };
    }

    return {
      fill: '#1e3a5f',
      stroke: '#1e3a5f',
      strokeWidth: 2,
      labelColor: '#ffffff',
    };
  }

  if (type === 'offense_player') {
    if (theme === 'hardwood') {
      return {
        fill: '#fff8ed',
        stroke: '#0f1f33',
        strokeWidth: 2,
        labelColor: '#0f1f33',
        innerStroke: 'rgba(15,31,51,0.2)',
      };
    }

    if (theme === 'tactical') {
      return {
        fill: '#5eead4',
        stroke: '#14b8a6',
        strokeWidth: 2,
        labelColor: '#0b1424',
        haloFill: 'rgba(94,234,212,0.18)',
      };
    }

    return {
      fill: '#ffffff',
      stroke: '#5eead4',
      strokeWidth: 2,
      labelColor: '#1e3a5f',
    };
  }

  if (type === 'ball') {
    return {
      fill: '#f97316',
      stroke: '#7c2d12',
      strokeWidth: 1.5,
      labelColor: '#7c2d12',
      lineAccent: 'rgba(124,45,18,0.75)',
    };
  }

  return {
    fill: 'transparent',
    stroke: '#0f1f33',
    strokeWidth: 2,
    labelColor: '#0f1f33',
  };
}

function renderHalfCourtLines(
  strokeMajor: string,
  strokeMinor: string,
  widthMajor: number,
  widthMinor: number
): string {
  return `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="74" y="74" width="852" height="852" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <rect x="378.5" y="74" width="243" height="206" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <line x1="378.5" y1="280" x2="621.5" y2="280" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <path d="M 440 194 A 60 60 0 0 0 560 194" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <path d="M 378.5 280 A 121.5 121.5 0 0 0 621.5 280" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <path d="M 378.5 280 A 121.5 121.5 0 0 1 621.5 280" stroke="${strokeMinor}" stroke-width="${widthMinor}" stroke-dasharray="10 10" />
      <path d="M 170 304 A 360 360 0 0 0 830 304" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <line x1="170" y1="74" x2="170" y2="304" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <line x1="830" y1="74" x2="830" y2="304" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <line x1="365" y1="123" x2="378.5" y2="123" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="621.5" y1="123" x2="635" y2="123" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="365" y1="166" x2="378.5" y2="166" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="621.5" y1="166" x2="635" y2="166" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="365" y1="210" x2="378.5" y2="210" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="621.5" y1="210" x2="635" y2="210" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
      <line x1="460" y1="110" x2="540" y2="110" stroke="${strokeMajor}" stroke-width="${widthMajor}" />
      <circle cx="500" cy="140" r="14" stroke="${strokeMajor}" stroke-width="${widthMinor}" fill="none" />
      <path d="M 415 926 A 85 85 0 0 1 585 926" stroke="${strokeMinor}" stroke-width="${widthMinor}" />
    </g>
  `;
}

function renderHalfCourtSurface(theme: PlayEditorTheme, idPrefix: string): string {
  if (theme === 'tactical') {
    const bgId = getId(idPrefix, 't-bg');
    const gridId = getId(idPrefix, 't-grid');
    const glowId = getId(idPrefix, 't-glow');
    const hazeId = getId(idPrefix, 't-haze');

    return `
      <defs>
        <radialGradient id="${bgId}" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stop-color="#142238" />
          <stop offset="60%" stop-color="#0b1424" />
          <stop offset="100%" stop-color="#050a14" />
        </radialGradient>
        <pattern id="${gridId}" patternUnits="userSpaceOnUse" width="40" height="40">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#5eead4" stroke-width="0.6" opacity="0.08" />
        </pattern>
        <filter id="${glowId}" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="${hazeId}" cx="50%" cy="15%" r="40%">
          <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#14b8a6" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#${bgId})" />
      <rect width="1000" height="1000" fill="url(#${gridId})" />
      <rect width="1000" height="1000" fill="url(#${hazeId})" />
      <rect x="378.5" y="74" width="243" height="206" fill="#14b8a6" opacity="0.06" />
      <g filter="url(#${glowId})">
        ${renderHalfCourtLines('#5eead4', '#5eead4', 3.5, 2.2)}
      </g>
      <g stroke="#5eead4" stroke-width="2" opacity="0.7">
        <line x1="62" y1="74" x2="86" y2="74" />
        <line x1="74" y1="62" x2="74" y2="86" />
        <line x1="914" y1="74" x2="938" y2="74" />
        <line x1="926" y1="62" x2="926" y2="86" />
        <line x1="62" y1="926" x2="86" y2="926" />
        <line x1="74" y1="914" x2="74" y2="938" />
        <line x1="914" y1="926" x2="938" y2="926" />
        <line x1="926" y1="914" x2="926" y2="938" />
      </g>
    `;
  }

  if (theme === 'blueprint') {
    const bgId = getId(idPrefix, 'b-bg');
    const fineId = getId(idPrefix, 'b-fine');
    const coarseId = getId(idPrefix, 'b-coarse');
    const vignetteId = getId(idPrefix, 'b-vignette');

    return `
      <defs>
        <linearGradient id="${bgId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e3a5f" />
          <stop offset="100%" stop-color="#14243d" />
        </linearGradient>
        <pattern id="${fineId}" patternUnits="userSpaceOnUse" width="25" height="25">
          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#ffffff" stroke-width="0.4" opacity="0.1" />
        </pattern>
        <pattern id="${coarseId}" patternUnits="userSpaceOnUse" width="125" height="125">
          <path d="M 125 0 L 0 0 0 125" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.18" />
        </pattern>
        <radialGradient id="${vignetteId}" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.35" />
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#${bgId})" />
      <rect width="1000" height="1000" fill="url(#${fineId})" />
      <rect width="1000" height="1000" fill="url(#${coarseId})" />
      <rect x="378.5" y="74" width="243" height="206" fill="#ffffff" opacity="0.05" />
      ${renderHalfCourtLines('#ffffff', '#ffffff', 3.2, 2.2)}
      <g font-family="'JetBrains Mono', ui-monospace, monospace" font-size="12" fill="#ffffff" opacity="0.55">
        <text x="500" y="62" text-anchor="middle">50&apos;-0&quot;</text>
        <text x="500" y="296" text-anchor="middle">15&apos;-0&quot;</text>
        <text x="60" y="194" text-anchor="middle" transform="rotate(-90 60 194)">19&apos;-9&quot;</text>
      </g>
      <rect width="1000" height="1000" fill="url(#${vignetteId})" />
    `;
  }

  const woodBaseId = getId(idPrefix, 'h-base');
  const woodPatternId = getId(idPrefix, 'h-planks');
  const grainId = getId(idPrefix, 'h-grain');
  const spotId = getId(idPrefix, 'h-spot');
  const edgeId = getId(idPrefix, 'h-edge');

  return `
    <defs>
      <linearGradient id="${woodBaseId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e4bf82" />
        <stop offset="55%" stop-color="#d6a764" />
        <stop offset="100%" stop-color="#b58146" />
      </linearGradient>
      <pattern id="${woodPatternId}" patternUnits="userSpaceOnUse" width="54" height="1000">
        <rect width="54" height="1000" fill="url(#${woodBaseId})" />
        <rect x="0" width="1" height="1000" fill="#8e5a2a" opacity="0.55" />
        <rect x="6" width="0.8" height="1000" fill="#fff1d4" opacity="0.18" />
        <rect x="20" width="0.6" height="1000" fill="#8e5a2a" opacity="0.25" />
        <rect x="34" width="0.8" height="1000" fill="#fff1d4" opacity="0.12" />
        <rect x="46" width="0.6" height="1000" fill="#8e5a2a" opacity="0.3" />
      </pattern>
      <filter id="${grainId}">
        <feTurbulence type="fractalNoise" baseFrequency="2 0.04" numOctaves="2" seed="3" />
        <feColorMatrix values="0 0 0 0 0.35 0 0 0 0 0.22 0 0 0 0 0.10 0 0 0 0.35 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <radialGradient id="${spotId}" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="#fff6e3" stop-opacity="0.35" />
        <stop offset="55%" stop-color="#fff6e3" stop-opacity="0" />
        <stop offset="100%" stop-color="#3b1f08" stop-opacity="0.4" />
      </radialGradient>
      <linearGradient id="${edgeId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.3" />
        <stop offset="15%" stop-color="#000000" stop-opacity="0" />
        <stop offset="85%" stop-color="#000000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.35" />
      </linearGradient>
    </defs>
    <rect width="1000" height="1000" fill="url(#${woodPatternId})" />
    <rect width="1000" height="1000" fill="#000000" opacity="0.08" filter="url(#${grainId})" />
    <rect width="1000" height="1000" fill="url(#${spotId})" />
    <rect width="1000" height="1000" fill="url(#${edgeId})" />
    <rect x="378.5" y="74" width="243" height="206" fill="#0f1f33" opacity="0.55" />
    <rect x="378.5" y="74" width="243" height="206" fill="#14b8a6" opacity="0.12" />
    ${renderHalfCourtLines('#fff8ed', '#fff8ed', 4.5, 3)}
    <g opacity="0.28">
      <circle cx="500" cy="820" r="60" fill="none" stroke="#fff8ed" stroke-width="2.5" />
      <text x="500" y="828" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="22" font-weight="700" fill="#fff8ed" letter-spacing="2">TEAM</text>
    </g>
  `;
}

function buildArrowHeadMarkup(
  from: StagePoint,
  to: StagePoint,
  color: string,
  actionType: ActionType,
  pointerLength: number,
  pointerWidth: number
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  if (actionType === 'screen') {
    const screenCap = buildScreenTCapPoints(from, to, 32);
    return `<line x1="${screenCap[0]}" y1="${screenCap[1]}" x2="${screenCap[2]}" y2="${screenCap[3]}" stroke="${color}" stroke-width="4" stroke-linecap="round" />`;
  }

  const p1 = `${to.x},${to.y}`;
  const arrowSize = Math.max(pointerLength, pointerWidth);
  const p2 = `${to.x - arrowSize * Math.cos(angle - Math.PI / 7)},${to.y - arrowSize * Math.sin(angle - Math.PI / 7)}`;
  const p3 = `${to.x - arrowSize * Math.cos(angle + Math.PI / 7)},${to.y - arrowSize * Math.sin(angle + Math.PI / 7)}`;

  return `<polygon points="${p1} ${p2} ${p3}" fill="${color}" />`;
}

function renderActionMarkup(action: PlayAction): string {
  const style = getActionVisualStyle(action.type, false);
  const fromPoint = { x: action.from.x, y: action.from.y };
  const toPoint = { x: action.to.x, y: action.to.y };
  const points =
    style.mode === 'wavy_arrow'
      ? buildWavyArrowPoints(fromPoint, toPoint)
      : buildStraightPoints(fromPoint, toPoint);
  const pointsMarkup = points.join(' ');
  const dashMarkup = style.dash ? ` stroke-dasharray="${style.dash.join(' ')}"` : '';

  if (style.mode === 'screen') {
    return `
      <g>
        <polyline points="${pointsMarkup}" fill="none" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
        ${buildArrowHeadMarkup(fromPoint, toPoint, style.stroke, action.type, style.pointerLength, style.pointerWidth)}
      </g>
    `;
  }

  return `
    <g>
      <polyline points="${pointsMarkup}" fill="none" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashMarkup} />
      ${buildArrowHeadMarkup(fromPoint, toPoint, style.fill, action.type, style.pointerLength, style.pointerWidth)}
    </g>
  `;
}

function renderPlayerTokenMarkup(
  object: PlayObject,
  theme: PlayEditorTheme,
  isBallOwner: boolean
): string {
  const appearance = getPlayerTokenAppearance(theme, object.type);
  const radius = object.size || (object.type === 'ball' ? 10 : 22);
  const label =
    object.type === 'defense_player' && object.label
      ? object.label.replace(/^X/i, '') || 'X'
      : object.label || '';

  if (object.type === 'ball') {
    const lineAccent = appearance.lineAccent || 'rgba(124,45,18,0.75)';
    return `
      <g>
        <circle cx="${object.position.x}" cy="${object.position.y}" r="10" fill="${appearance.fill}" stroke="${appearance.stroke}" stroke-width="${appearance.strokeWidth}" />
        <line x1="${object.position.x - 6.5}" y1="${object.position.y}" x2="${object.position.x + 6.5}" y2="${object.position.y}" stroke="${lineAccent}" stroke-width="1.6" />
        <line x1="${object.position.x}" y1="${object.position.y - 6.5}" x2="${object.position.x}" y2="${object.position.y + 6.5}" stroke="${lineAccent}" stroke-width="1.6" />
      </g>
    `;
  }

  const highlight = isBallOwner
    ? `<circle cx="${object.position.x}" cy="${object.position.y}" r="${radius + 12}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="5 4" />`
    : '';
  const halo = appearance.haloFill
    ? `<circle cx="${object.position.x}" cy="${object.position.y}" r="30" fill="${appearance.haloFill}" />`
    : '';
  const innerStroke = appearance.innerStroke
    ? `<circle cx="${object.position.x}" cy="${object.position.y}" r="${Math.max(
        5,
        radius - 4
      )}" fill="none" stroke="${appearance.innerStroke}" stroke-width="1.5" />`
    : '';

  return `
    <g>
      ${highlight}
      ${halo}
      <circle cx="${object.position.x}" cy="${object.position.y}" r="${radius}" fill="${appearance.fill}" stroke="${appearance.stroke}" stroke-width="${appearance.strokeWidth}" />
      ${innerStroke}
      <text x="${object.position.x}" y="${object.position.y + 7}" text-anchor="middle" font-family="'DM Sans', Arial, sans-serif" font-size="22" font-weight="700" fill="${appearance.labelColor}">${escapeXml(
        label
      )}</text>
    </g>
  `;
}

function renderObjectMarkup(
  object: PlayObject,
  theme: PlayEditorTheme,
  isBallOwner: boolean
): string {
  if (
    object.type === 'offense_player' ||
    object.type === 'defense_player' ||
    object.type === 'ball'
  ) {
    return renderPlayerTokenMarkup(object, theme, isBallOwner);
  }

  if (object.type === 'cone') {
    const size = object.size || 18;
    return `
      <polygon
        points="${object.position.x},${object.position.y - size} ${object.position.x - size},${object.position.y + size} ${object.position.x + size},${object.position.y + size}"
        fill="#f59e0b"
        stroke="#7c2d12"
        stroke-width="2"
      />
    `;
  }

  if (object.type === 'text') {
    return `
      <text
        x="${object.position.x}"
        y="${object.position.y}"
        font-family="'DM Sans', Arial, sans-serif"
        font-size="22"
        font-weight="700"
        fill="${theme === 'hardwood' ? '#0f1f33' : '#ffffff'}"
      >${escapeXml(object.label || 'TEXT')}</text>
    `;
  }

  if (object.type === 'shape_rect') {
    const width = object.width || 110;
    const height = object.height || 70;
    return `
      <rect
        x="${object.position.x - width / 2}"
        y="${object.position.y - height / 2}"
        width="${width}"
        height="${height}"
        fill="none"
        stroke="${theme === 'hardwood' ? '#0f1f33' : '#ffffff'}"
        stroke-width="2"
        rx="10"
      />
    `;
  }

  if (object.type === 'shape_circle') {
    return `
      <circle
        cx="${object.position.x}"
        cy="${object.position.y}"
        r="${object.size || 42}"
        fill="none"
        stroke="${theme === 'hardwood' ? '#0f1f33' : '#ffffff'}"
        stroke-width="2"
      />
    `;
  }

  return '';
}

function getPhase(
  diagram: BasketballPlayDocument | null | undefined,
  phaseIndex = 0
): PlayPhase | null {
  if (!diagram?.phases?.length) {
    return null;
  }

  return diagram.phases[Math.max(0, Math.min(phaseIndex, diagram.phases.length - 1))] || null;
}

export function renderCourtSurfaceSvgMarkup({
  courtTemplate,
  theme,
  idPrefix = 'court-surface',
}: SvgMarkupOptions): string | null {
  if (courtTemplate !== 'half_court') {
    return null;
  }

  return `
    <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      ${renderHalfCourtSurface(theme, idPrefix)}
    </svg>
  `;
}

export function getCourtSurfaceImageSource({
  courtTemplate,
  theme,
  idPrefix = 'court-surface',
}: SvgMarkupOptions): string {
  if (courtTemplate !== 'half_court') {
    return COURT_TEMPLATE_ASSET[courtTemplate];
  }

  const markup = renderCourtSurfaceSvgMarkup({
    courtTemplate,
    theme,
    idPrefix,
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup || '')}`;
}

export function renderPlayDiagramSvgMarkup({
  diagram,
  courtTemplate,
  theme,
  phaseIndex = 0,
  idPrefix = 'play-diagram',
}: DiagramSvgOptions): string | null {
  if (courtTemplate !== 'half_court') {
    return null;
  }

  const phase = getPhase(diagram, phaseIndex);
  const phaseMarkup = phase
    ? `
      <g>
        ${phase.actions.map((action) => renderActionMarkup(action)).join('')}
        ${phase.objects
          .map((object) =>
            renderObjectMarkup(object, theme, phase.ballOwnerObjectId === object.id)
          )
          .join('')}
      </g>
    `
    : '';

  return `
    <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      ${renderHalfCourtSurface(theme, idPrefix)}
      ${phaseMarkup}
    </svg>
  `;
}

export function createPlayDiagramDataUrl(
  options: DiagramSvgOptions
): string | null {
  const markup = renderPlayDiagramSvgMarkup(options);

  if (!markup) {
    return null;
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
