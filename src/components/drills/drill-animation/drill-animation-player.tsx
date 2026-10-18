'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Gauge, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  HOOP,
  clamp,
  compileDrill,
  prog,
  spring,
  windowOpacity,
  type ArrowPath,
  type CompiledDrill,
  type Vec,
} from '@/lib/drill-animations/engine';
import type { DrillAnimation, DrillMark, DrillTone } from '@/lib/drill-animations/types';
import {
  PLAY_EDITOR_THEME_OPTIONS,
  PLAY_EDITOR_THEME_STORAGE_KEY,
  normalizePlayEditorTheme,
  type PlayEditorTheme,
} from '@/lib/plays/play-theme';
import { getPlayerTokenAppearance } from '@/lib/plays/play-diagram-render';
import { DrillCourt, DrillRim } from './drill-court';

const TOKEN_R = 1.35;
const VIEW = {
  full: { x: -3, y: -3.125, w: 100, h: 56.25 },
  half: { x: 40.5, y: -2.5, w: 56.5, h: 55 },
};

const TONE_FILL: Record<DrillTone, string> = {
  teach: '#0f766e',
  warning: '#d97706',
  success: '#16a34a',
};

const ARROW_STYLE: Record<ArrowPath['kind'], { stroke: string; dash?: string; width: number }> = {
  cut: { stroke: '#fbbf24', width: 0.32 },
  dribble: { stroke: '#5eead4', width: 0.3 },
  pass: { stroke: '#5eead4', dash: '0.75 0.6', width: 0.3 },
  shot: { stroke: '#c81e1e', dash: '0.5 0.45', width: 0.34 },
  defense: { stroke: '#fb7185', dash: '1.1 0.5', width: 0.3 },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pts = (points: Vec[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

interface DrillAnimationPlayerProps {
  drill: DrillAnimation;
  className?: string;
}

export function DrillAnimationPlayer({ drill, className }: DrillAnimationPlayerProps) {
  const compiled = useMemo(() => compileDrill(drill), [drill]);
  const idPrefix = useId().replace(/:/g, '');
  const [t, setT] = useState(drill.poster ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 0.5>(1);
  const [theme, setTheme] = useState<PlayEditorTheme>('hardwood');
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    try {
      setTheme(normalizePlayEditorTheme(window.localStorage.getItem(PLAY_EDITOR_THEME_STORAGE_KEY)));
    } catch {
      // Storage can be unavailable (private mode); the default theme is fine.
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(drill.length, tRef.current + ((now - last) / 1000) * speed);
      last = now;
      setT(next);
      if (next >= drill.length) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, drill.length]);

  const togglePlay = useCallback(() => {
    if (!playing && tRef.current >= drill.length - 0.05) setT(0);
    setPlaying((p) => !p);
  }, [playing, drill.length]);

  const seek = (value: number) => setT(clamp(value, 0, drill.length));

  const changeTheme = (value: PlayEditorTheme) => {
    setTheme(value);
    try {
      window.localStorage.setItem(PLAY_EDITOR_THEME_STORAGE_KEY, value);
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  };

  const current = compiled.stepAt(t);
  const chapters = drill.steps.filter((s) => s.chapter);
  const activeChapter = [...chapters].reverse().find((s) => t >= s.at);
  const view = VIEW[drill.court];

  return (
    <div className={cn('grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="space-y-3">
        <div
          className={cn(
            'relative overflow-hidden rounded-xl bg-[#0f1f33] shadow-card',
            drill.court === 'half' && 'mx-auto max-w-[min(100%,72vh)]'
          )}
          style={{ aspectRatio: `${view.w} / ${view.h}` }}
          tabIndex={0}
          role="img"
          aria-label={`Animated diagram: ${drill.name}. ${current?.step.title ?? ''}`}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              togglePlay();
            }
          }}
        >
          <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            <CourtScene compiled={compiled} t={t} theme={theme} idPrefix={idPrefix} />
          </svg>

          {current?.step.freeze && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              <Pause className="h-3 w-3" aria-hidden="true" />
              Paused on a coaching point
            </div>
          )}

          {!playing && t === (drill.poster ?? 0) && (
            <button
              type="button"
              onClick={() => {
                setT(0);
                setPlaying(true);
              }}
              className="absolute inset-0 grid place-items-center bg-[#0f1f33]/30 transition-colors hover:bg-[#0f1f33]/40 focus-visible:outline-none"
              aria-label={`Play ${drill.name}`}
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-modal ring-8 ring-accent/25">
                <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
          <Button size="icon-sm" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setT(0);
              setPlaying(true);
            }}
            aria-label="Restart"
          >
            <RotateCcw />
          </Button>
          <input
            type="range"
            min={0}
            max={drill.length}
            step={0.01}
            value={t}
            onChange={(e) => {
              setPlaying(false);
              seek(+e.target.value);
            }}
            aria-label="Seek"
            className="min-w-[120px] flex-1 accent-accent"
          />
          <span className="min-w-[76px] text-right font-mono text-xs tabular-nums text-gray-500">
            {fmt(t)} / {fmt(drill.length)}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
            aria-label={`Playback speed ${speed}x`}
          >
            <Gauge />
            {speed}x
          </Button>
          <select
            value={theme}
            onChange={(e) => changeTheme(normalizePlayEditorTheme(e.target.value))}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Court theme"
          >
            {PLAY_EDITOR_THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <aside className="space-y-3">
        <StepCard compiled={compiled} t={t} />
        <MeterCard compiled={compiled} t={t} />
        <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Jump to</p>
          <ol className="space-y-0.5">
            {chapters.map((step) => {
              const active = step === activeChapter;
              return (
                <li key={step.at}>
                  <button
                    type="button"
                    onClick={() => {
                      seek(step.at + 0.01);
                      setPlaying(true);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      active ? 'bg-accent/10 font-medium text-primary' : 'text-gray-600 hover:bg-gray-50'
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="font-mono text-xs tabular-nums text-gray-400">{fmt(step.at)}</span>
                    {step.chapter}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function StepCard({ compiled, t }: { compiled: CompiledDrill; t: number }) {
  const current = compiled.stepAt(t);
  if (!current) return null;
  const { step, index } = current;
  const tone = step.tone ?? 'teach';
  return (
    <div
      key={index}
      className={cn(
        'animate-fade-in rounded-lg border bg-white p-4 shadow-sm',
        tone === 'warning' ? 'border-yellow-300' : tone === 'success' ? 'border-green-300' : 'border-gray-200'
      )}
      aria-live="polite"
    >
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          tone === 'warning' ? 'text-yellow-700' : tone === 'success' ? 'text-green-700' : 'text-accent-dark'
        )}
      >
        Step {index + 1} of {compiled.drill.steps.length}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-primary">{step.title}</h3>
      {step.body && <p className="mt-1 text-sm leading-relaxed text-gray-600">{step.body}</p>}
    </div>
  );
}

function MeterCard({ compiled, t }: { compiled: CompiledDrill; t: number }) {
  const meter = compiled.drill.meters?.find((m) => t >= m.from && t < m.to);
  if (!meter) return null;
  const tau = compiled.tauAt(t);
  const stopAt = meter.resolveAt ?? meter.end;
  const remaining = clamp(meter.end - Math.max(meter.start, Math.min(tau, stopAt)), 0, meter.end - meter.start);
  const frac = remaining / (meter.end - meter.start);
  const resolved = tau >= stopAt;
  const ok = meter.outcome !== 'fail';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{meter.label}</p>
        <p className="font-mono text-lg font-semibold tabular-nums text-primary">{remaining.toFixed(1)}s</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn('h-full rounded-full', frac > 0.35 ? 'bg-accent' : frac > 0 ? 'bg-warning' : 'bg-error')}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      {resolved && meter.outcomeText && (
        <p className={cn('mt-2 animate-fade-in text-sm font-semibold', ok ? 'text-green-700' : 'text-red-600')}>
          {meter.outcomeText}
        </p>
      )}
    </div>
  );
}

// ---------- Court scene (all positions in feet) ----------

function CourtScene({
  compiled,
  t,
  theme,
  idPrefix,
}: {
  compiled: CompiledDrill;
  t: number;
  theme: PlayEditorTheme;
  idPrefix: string;
}) {
  const { drill } = compiled;
  const tau = compiled.tauAt(t);
  const ball = compiled.ball(tau);
  const scoredAt = compiled.scoreAt(tau);
  const ripple = scoredAt === null ? 0 : 1 - prog(tau, scoredAt, scoredAt + 0.8);
  const arrows = compiled.arrows(t, tau);
  const visible = drill.players.filter((p) => t >= (p.enterAt ?? 0));

  return (
    <g>
      <DrillCourt theme={theme} idPrefix={idPrefix} />
      <DrillRim x={94 - HOOP.x} y={HOOP.y} ripple={0} />

      {drill.marks.filter((m) => m.kind === 'lane').map((m, i) => (
        <MarkView key={`lane-${i}`} mark={m} compiled={compiled} t={t} tau={tau} />
      ))}

      {arrows.map((a) => (
        <ArrowView key={a.key} arrow={a} theme={theme} />
      ))}

      {visible.map((p) => (
        <Trail key={`trail-${p.id}`} compiled={compiled} id={p.id} tau={tau} team={p.team} theme={theme} />
      ))}

      {drill.marks.filter((m) => m.kind === 'triangle' || m.kind === 'link' || m.kind === 'ring').map((m, i) => (
        <MarkView key={`under-${i}`} mark={m} compiled={compiled} t={t} tau={tau} />
      ))}

      {visible.map((p) => (
        <PlayerToken key={p.id} compiled={compiled} player={p} t={t} tau={tau} theme={theme} holder={ball.holder === p.id} />
      ))}

      <BallView x={ball.x} y={ball.y} h={ball.h} />
      <DrillRim x={HOOP.x} y={HOOP.y} ripple={ripple} />
      {scoredAt !== null && (
        <text
          x={HOOP.x - 3}
          y={HOOP.y - 2.5 - 2 * prog(tau, scoredAt, scoredAt + 1.2)}
          textAnchor="middle"
          fontSize={2}
          fontWeight={800}
          fill="#fbbf24"
          stroke="#0f1f33"
          strokeWidth={0.12}
          paintOrder="stroke"
          opacity={1 - prog(tau, scoredAt + 0.9, scoredAt + 1.5)}
          style={{ fontFamily: 'Outfit, DM Sans, sans-serif' }}
        >
          +2
        </text>
      )}

      {drill.marks.filter((m) => m.kind === 'tag' || m.kind === 'label').map((m, i) => (
        <MarkView key={`over-${i}`} mark={m} compiled={compiled} t={t} tau={tau} />
      ))}
    </g>
  );
}

function ArrowView({ arrow, theme }: { arrow: ArrowPath; theme: PlayEditorTheme }) {
  const style = ARROW_STYLE[arrow.kind];
  const head = arrow.head;
  const s = 0.95;
  return (
    <g opacity={arrow.opacity}>
      {theme === 'hardwood' && (
        <polyline points={pts(arrow.points)} fill="none" stroke="#0f1f33" strokeOpacity={0.35} strokeWidth={style.width + 0.22} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={style.dash} />
      )}
      <polyline points={pts(arrow.points)} fill="none" stroke={style.stroke} strokeWidth={style.width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={style.dash} />
      {head && (
        <path
          d={`M${s} 0 L${-s * 0.7} ${-s * 0.7} L${-s * 0.35} 0 L${-s * 0.7} ${s * 0.7} Z`}
          transform={`translate(${head.at.x.toFixed(2)} ${head.at.y.toFixed(2)}) rotate(${((head.angle * 180) / Math.PI).toFixed(1)})`}
          fill={style.stroke}
          stroke={theme === 'hardwood' ? 'rgba(15,31,51,0.35)' : 'none'}
          strokeWidth={0.1}
        />
      )}
    </g>
  );
}

function tokenColors(theme: PlayEditorTheme, team: 'offense' | 'defense') {
  const look = getPlayerTokenAppearance(theme, team === 'offense' ? 'offense_player' : 'defense_player');
  // Blueprint defence tokens match the court colour, so give them a light outline here.
  const stroke = theme === 'blueprint' && team === 'defense' ? '#ffffff' : look.stroke;
  return { ...look, stroke };
}

function Trail({
  compiled,
  id,
  tau,
  team,
  theme,
}: {
  compiled: CompiledDrill;
  id: string;
  tau: number;
  team: 'offense' | 'defense';
  theme: PlayEditorTheme;
}) {
  const points: Vec[] = [];
  for (let k = 10; k >= 0; k -= 1) {
    const p = compiled.pos(id, tau - k * 0.05);
    const prev = points[points.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > 4) points.length = 0; // a jump cut, not a run
    points.push(p);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length < 2 || Math.hypot(last.x - first.x, last.y - first.y) < 1) return null;
  const color = team === 'offense' ? (theme === 'hardwood' ? '#0f1f33' : '#5eead4') : theme === 'tactical' ? '#f97316' : theme === 'hardwood' ? '#0f1f33' : '#ffffff';
  return <polyline points={pts(points)} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={TOKEN_R * 1.3} strokeLinecap="round" strokeLinejoin="round" />;
}

function PlayerToken({
  compiled,
  player,
  t,
  tau,
  theme,
  holder,
}: {
  compiled: CompiledDrill;
  player: DrillAnimation['players'][number];
  t: number;
  tau: number;
  theme: PlayEditorTheme;
  holder: boolean;
}) {
  const p = compiled.pos(player.id, tau);
  const v = compiled.vel(player.id, tau);
  const f = compiled.facing(player.id, tau);
  const look = tokenColors(theme, player.team);
  const speed = Math.hypot(v.x, v.y);
  const moveAngle = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const faceAngle = (Math.atan2(f.y, f.x) * 180) / Math.PI;
  const stretch = clamp(speed * 0.007, 0, 0.12); // squash and stretch along the run
  const enter = t - (player.enterAt ?? 0);
  const pop = spring(enter, 2.2, 0.5);
  const ball = compiled.ball(tau);
  const stance = player.team === 'defense' ? clamp((8 - Math.hypot(ball.x - p.x, ball.y - p.y)) / 3) : 0;
  const label = player.team === 'defense' ? player.label.replace(/^X/i, '') || 'X' : player.label;

  return (
    <g transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${pop.toFixed(3)})`} opacity={clamp(enter / 0.12)}>
      <ellipse cx={0.25} cy={0.4} rx={TOKEN_R} ry={TOKEN_R * 0.9} fill="#000" opacity={0.18} />
      {holder && <circle r={TOKEN_R + 0.75} fill="none" stroke="#f59e0b" strokeWidth={0.18} strokeDasharray="0.45 0.35" />}
      {look.haloFill && <circle r={TOKEN_R + 0.55} fill={look.haloFill} />}
      <g transform={`rotate(${faceAngle.toFixed(1)})`}>
        {stance > 0 && (
          <g opacity={stance}>
            <line x1={0.5} y1={-1.95} x2={0.5} y2={1.95} stroke={look.fill} strokeWidth={0.36} strokeLinecap="round" />
            <circle cx={0.5} cy={-2} r={0.32} fill={look.fill} stroke={look.stroke} strokeWidth={0.08} />
            <circle cx={0.5} cy={2} r={0.32} fill={look.fill} stroke={look.stroke} strokeWidth={0.08} />
          </g>
        )}
        <path d={`M${TOKEN_R + 0.6} 0 L${TOKEN_R + 0.05} -0.5 L${TOKEN_R + 0.05} 0.5 Z`} fill={look.stroke} />
      </g>
      <g transform={`rotate(${moveAngle.toFixed(1)}) scale(${(1 + stretch).toFixed(3)} ${(1 / (1 + stretch)).toFixed(3)}) rotate(${(-moveAngle).toFixed(1)})`}>
        <circle r={TOKEN_R} fill={look.fill} stroke={look.stroke} strokeWidth={0.14} />
        {look.innerStroke && <circle r={TOKEN_R - 0.3} fill="none" stroke={look.innerStroke} strokeWidth={0.1} />}
      </g>
      <text
        y={0.45}
        textAnchor="middle"
        fontSize={1.3}
        fontWeight={700}
        fill={look.labelColor}
        style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}

function BallView({ x, y, h }: { x: number; y: number; h: number }) {
  const r = 0.62 * (1 + h * 0.035);
  const contact = h < 0.35 ? 1 - h / 0.35 : 0; // squash as it hits the floor
  const sx = 1 + 0.14 * contact;
  const sy = 1 - 0.14 * contact;
  return (
    <g>
      <circle cx={x} cy={y} r={0.6} fill="#000" opacity={0.28 * (1 - clamp(h / 16))} />
      <g transform={`translate(${x.toFixed(2)} ${(y - h * 0.32).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        <circle r={r} fill="#f97316" stroke="#7c2d12" strokeWidth={0.1} />
        <line x1={-r * 0.7} y1={0} x2={r * 0.7} y2={0} stroke="rgba(124,45,18,0.75)" strokeWidth={0.08} />
        <line x1={0} y1={-r * 0.7} x2={0} y2={r * 0.7} stroke="rgba(124,45,18,0.75)" strokeWidth={0.08} />
      </g>
    </g>
  );
}

function Pill({ x, y, text, tone = 'teach', scale = 1 }: { x: number; y: number; text: string; tone?: DrillTone; scale?: number }) {
  const label = text.toUpperCase();
  const w = label.length * 0.62 + 1.4;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`}>
      <rect x={-w / 2} y={-0.85} width={w} height={1.7} rx={0.85} fill={TONE_FILL[tone]} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.08} />
      <text
        y={0.36}
        textAnchor="middle"
        fontSize={0.95}
        fontWeight={700}
        fill="#ffffff"
        letterSpacing={0.06}
        style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}
      >
        {label}
      </text>
    </g>
  );
}

function MarkView({ mark, compiled, t, tau }: { mark: DrillMark; compiled: CompiledDrill; t: number; tau: number }) {
  const opacity = windowOpacity(t, mark.from, mark.to, 0.25);
  if (opacity <= 0) return null;
  const pop = spring(t - mark.from, 2.4, 0.5);

  switch (mark.kind) {
    case 'tag': {
      const p = compiled.pos(mark.player, tau);
      return (
        <g opacity={opacity}>
          <Pill x={p.x} y={p.y - TOKEN_R - 1.5} text={mark.text} tone={mark.tone} scale={pop} />
        </g>
      );
    }
    case 'label':
      return (
        <g opacity={opacity}>
          <Pill x={mark.x} y={mark.y} text={mark.text} tone={mark.tone} scale={pop} />
        </g>
      );
    case 'ring': {
      const p = compiled.pos(mark.player, tau);
      const r = (TOKEN_R + 1) * pop + 0.25 * Math.sin(t * 6);
      return <circle cx={p.x} cy={p.y} r={Math.max(0, r)} fill="none" stroke={TONE_FILL[mark.tone ?? 'teach']} strokeWidth={0.28} opacity={opacity} />;
    }
    case 'link': {
      const a = compiled.pos(mark.a, tau);
      const b = compiled.pos(mark.b, tau);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const draw = clamp(pop);
      return (
        <g opacity={opacity}>
          <line x1={a.x} y1={a.y} x2={a.x + (b.x - a.x) * draw} y2={a.y + (b.y - a.y) * draw} stroke="#ffffff" strokeWidth={0.22} strokeDasharray="0.6 0.45" strokeLinecap="round" />
          {mark.text && <Pill x={m.x} y={m.y - 2} text={mark.text} tone={mark.tone} scale={pop} />}
        </g>
      );
    }
    case 'lane':
      return (
        <g opacity={opacity * 0.9}>
          <rect x={0.4} y={mark.y1} width={93.2 * clamp(pop)} height={mark.y2 - mark.y1} rx={0.8} fill="#ffffff" fillOpacity={0.1} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={0.12} strokeDasharray="0.6 0.5" />
          <text
            x={Math.max(1.4, compiled.drill.court === 'half' ? 48 : 1.4)}
            y={(mark.y1 + mark.y2) / 2 + 0.35}
            fontSize={1}
            fontWeight={700}
            fill="#ffffff"
            opacity={0.85}
            letterSpacing={0.08}
            style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}
          >
            {mark.text.toUpperCase()}
          </text>
        </g>
      );
    case 'triangle': {
      const [a, b, c] = mark.players.map((id) => compiled.pos(id, tau));
      // Label sits beside the triangle so it never covers the help defenders inside it.
      const labelAt = { x: Math.min(a.x, b.x, c.x) - 6, y: (a.y + b.y + c.y) / 3 };
      return (
        <g opacity={opacity}>
          <polygon points={pts([a, b, c])} fill="#14b8a6" fillOpacity={0.18} stroke="#5eead4" strokeWidth={0.22} strokeDasharray="0.6 0.4" strokeLinejoin="round" />
          {mark.text && <Pill x={labelAt.x} y={labelAt.y} text={mark.text} scale={pop} />}
        </g>
      );
    }
  }
}

/** A still frame of the drill for cards and thumbnails. */
export function DrillAnimationPoster({ drill, theme = 'tactical', className }: { drill: DrillAnimation; theme?: PlayEditorTheme; className?: string }) {
  const compiled = useMemo(() => compileDrill(drill), [drill]);
  const idPrefix = useId().replace(/:/g, '');
  const view = VIEW[drill.court];
  const still = drill.poster ?? 0;
  return (
    <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className={className} aria-hidden="true" preserveAspectRatio={drill.court === 'half' ? 'xMaxYMid slice' : 'xMidYMid slice'}>
      <CourtScene compiled={compiled} t={still} theme={theme} idPrefix={idPrefix} />
    </svg>
  );
}
