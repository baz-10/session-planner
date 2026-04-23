'use client';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  COURT_TEMPLATE_ASSET,
  renderPlayDiagramSvgMarkup,
} from '@/lib/plays/play-diagram-render';
import type { BasketballPlayDocument, CourtTemplate } from '@/lib/plays/diagram-types';
import type { PlayEditorTheme } from '@/lib/plays/play-theme';

interface PlayDiagramPreviewProps {
  diagram?: BasketballPlayDocument | null;
  courtTemplate: CourtTemplate;
  theme: PlayEditorTheme;
  phaseIndex?: number;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
}

export function PlayDiagramPreview({
  diagram,
  courtTemplate,
  theme,
  phaseIndex = 0,
  fallbackSrc,
  alt,
  className,
}: PlayDiagramPreviewProps) {
  const id = useId();
  const markup = useMemo(
    () =>
      renderPlayDiagramSvgMarkup({
        diagram,
        courtTemplate,
        theme,
        phaseIndex,
        idPrefix: `play-preview-${id}`,
      }),
    [courtTemplate, diagram, id, phaseIndex, theme]
  );

  if (markup) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'h-full w-full overflow-hidden [&_svg]:h-full [&_svg]:w-full',
          className
        )}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }

  return (
    <img
      src={fallbackSrc || COURT_TEMPLATE_ASSET[courtTemplate]}
      alt={alt}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}
