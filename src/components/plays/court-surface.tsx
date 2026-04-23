'use client';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  COURT_TEMPLATE_ASSET,
  renderCourtSurfaceSvgMarkup,
} from '@/lib/plays/play-diagram-render';
import type { CourtTemplate } from '@/lib/plays/diagram-types';
import type { PlayEditorTheme } from '@/lib/plays/play-theme';

interface CourtSurfaceProps {
  theme: PlayEditorTheme;
  courtTemplate: CourtTemplate;
  className?: string;
}

export function CourtSurface({
  theme,
  courtTemplate,
  className,
}: CourtSurfaceProps) {
  const id = useId();
  const markup = useMemo(
    () =>
      renderCourtSurfaceSvgMarkup({
        courtTemplate,
        theme,
        idPrefix: `court-surface-${id}`,
      }),
    [courtTemplate, id, theme]
  );

  if (!markup) {
    return (
      <img
        src={COURT_TEMPLATE_ASSET[courtTemplate]}
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn('h-full w-full [&_svg]:h-full [&_svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
