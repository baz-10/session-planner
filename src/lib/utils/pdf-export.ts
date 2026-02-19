/**
 * PDF Export utility for session plans
 * Uses browser print functionality with custom print styles
 */

import {
  calculateActivityTimings,
  calculateCategoryAllocations,
  formatTime12Hour,
  formatDuration,
  type CategoryAllocation,
} from './time';
import type { Session, SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface SessionWithActivities extends Session {
  activities: ActivityWithCategory[];
}

interface SessionPrintOptions {
  categories?: DrillCategory[];
  drillCategoryIdsByDrillId?: Record<string, string[]>;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeColor(color: string | null | undefined, fallback = '#94a3b8'): string {
  if (!color) return fallback;
  const value = color.trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
    return value;
  }
  return fallback;
}

function formatMinutesValue(minutes: number): string {
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
}

function buildCategoryLookup(
  session: SessionWithActivities,
  categories?: DrillCategory[]
): Map<string, { name: string; color: string }> {
  const categoryLookup = new Map<string, { name: string; color: string }>();

  (categories || []).forEach((category) => {
    categoryLookup.set(category.id, {
      name: category.name,
      color: sanitizeColor(category.color),
    });
  });

  session.activities.forEach((activity) => {
    if (!activity.category_id || !activity.category) return;
    if (categoryLookup.has(activity.category_id)) return;
    categoryLookup.set(activity.category_id, {
      name: activity.category.name,
      color: sanitizeColor(activity.category.color),
    });
  });

  return categoryLookup;
}

function buildChartSegments(
  allocations: CategoryAllocation[]
): Array<{ path: string; color: string; name: string; minutes: number; percentage: number }> {
  let startAngle = 0;
  const segments: Array<{
    path: string;
    color: string;
    name: string;
    minutes: number;
    percentage: number;
  }> = [];

  allocations.forEach((allocation) => {
    if (allocation.percentage <= 0) return;

    const angle = (allocation.percentage / 100) * 360;
    const endAngle = startAngle + angle;
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    const radius = 76;
    const cx = 100;
    const cy = 100;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;
    const path =
      allocation.percentage >= 100
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    segments.push({
      path,
      color: sanitizeColor(allocation.categoryColor, '#e5e7eb'),
      name: allocation.categoryName,
      minutes: allocation.minutes,
      percentage: allocation.percentage,
    });

    startAngle = endAngle;
  });

  return segments;
}

function buildCategoryBadgesHTML(
  activity: ActivityWithCategory,
  categoryLookup: Map<string, { name: string; color: string }>,
  drillCategoryIdsByDrillId: Record<string, string[]>
): string {
  const categoryIds = new Set<string>();

  if (activity.category_id) {
    categoryIds.add(activity.category_id);
  }

  (activity.additional_category_ids || []).forEach((categoryId) => {
    if (categoryId) {
      categoryIds.add(categoryId);
    }
  });

  if (activity.drill_id && drillCategoryIdsByDrillId[activity.drill_id]) {
    drillCategoryIdsByDrillId[activity.drill_id].forEach((categoryId) => {
      if (categoryId) {
        categoryIds.add(categoryId);
      }
    });
  }

  if (categoryIds.size === 0) {
    return '-';
  }

  const badges = Array.from(categoryIds).map((categoryId) => {
    const isPrimary = Boolean(activity.category_id && activity.category_id === categoryId);
    const fallback = categoryLookup.get(categoryId);
    const label =
      (isPrimary ? activity.category?.name : undefined) || fallback?.name || 'Category';
    const color = sanitizeColor(
      (isPrimary ? activity.category?.color : undefined) || fallback?.color,
      '#94a3b8'
    );

    return `<span class="category-badge" style="background-color: ${color}">${escapeHtml(label)}</span>`;
  });

  return `<div class="category-stack">${badges.join('')}</div>`;
}

/**
 * Generate HTML content for printing a session plan
 */
export function generateSessionPrintHTML(
  session: SessionWithActivities,
  teamName: string,
  options: SessionPrintOptions = {}
): string {
  const sessionDuration = Number(session.duration) || 90;
  const timings = calculateActivityTimings(
    session.activities.map((a) => ({ id: a.id, duration: a.duration })),
    session.start_time || '17:00',
    sessionDuration
  );

  const timingMap = new Map(timings.map((t) => [t.id, t]));
  const categoryLookup = buildCategoryLookup(session, options.categories);
  const drillCategoryIdsByDrillId = options.drillCategoryIdsByDrillId || {};

  const totalAllocated = session.activities.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
  const minutesRemaining = Math.max(0, sessionDuration - totalAllocated);
  const allocations = calculateCategoryAllocations(
    session.activities,
    sessionDuration,
    categoryLookup,
    drillCategoryIdsByDrillId
  );
  const chartSegments = buildChartSegments(allocations);
  const usedCategories = allocations.filter(
    (allocation) => allocation.categoryName !== 'Min Remaining' && allocation.minutes > 0
  ).length;

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const summaryCards = [
    { label: 'Activities', value: String(session.activities.length) },
    { label: 'Allocated', value: `${formatMinutesValue(totalAllocated)} min` },
    { label: 'Remaining', value: `${formatMinutesValue(minutesRemaining)} min` },
    { label: 'Categories Used', value: String(usedCategories) },
  ];

  const summaryCardsHtml = summaryCards
    .map(
      (card) => `
        <div class="summary-card">
          <label>${card.label}</label>
          <p>${card.value}</p>
        </div>
      `
    )
    .join('');

  const legendHtml = allocations
    .map(
      (allocation) => `
      <div class="legend-row">
        <div class="legend-label">
          <span class="legend-dot" style="background-color: ${sanitizeColor(allocation.categoryColor, '#e5e7eb')}"></span>
          <span class="legend-name">${escapeHtml(allocation.categoryName)}</span>
        </div>
        <span class="legend-minutes">${formatMinutesValue(allocation.minutes)} min</span>
      </div>
    `
    )
    .join('');

  const chartPathsHtml =
    chartSegments.length > 0
      ? chartSegments
          .map(
            (segment) => `
            <path d="${segment.path}" fill="${segment.color}" stroke="#fff" stroke-width="2">
              <title>${escapeHtml(segment.name)}: ${formatMinutesValue(segment.minutes)} min (${segment.percentage.toFixed(1)}%)</title>
            </path>
          `
          )
          .join('')
      : '<circle cx="100" cy="100" r="76" fill="#e5e7eb"></circle>';

  // Escape all user-provided content
  const safeName = escapeHtml(session.name);
  const safeTeamName = escapeHtml(teamName);
  const safeLocation = escapeHtml(session.location);
  const safeDefensive = escapeHtml(session.defensive_emphasis);
  const safeOffensive = escapeHtml(session.offensive_emphasis);
  const safeQuote = escapeHtml(session.quote);
  const safeAnnouncements = escapeHtml(session.announcements);

  const activitiesHtml = session.activities
    .map((activity, index) => {
      const timing = timingMap.get(activity.id);
      const safeActivityName = escapeHtml(activity.name);
      const safeNotes = escapeHtml(activity.notes);
      const primaryColor = sanitizeColor(
        activity.category?.color ||
          (activity.category_id ? categoryLookup.get(activity.category_id)?.color : undefined),
        '#64748b'
      );
      const categoryBadgesHtml = buildCategoryBadgesHTML(
        activity,
        categoryLookup,
        drillCategoryIdsByDrillId
      );

      return `
        <tr>
          <td class="activity-number">
            <span style="background-color: ${primaryColor}">${index + 1}</span>
          </td>
          <td class="activity-name">${safeActivityName}</td>
          <td class="activity-duration">${activity.duration}</td>
          <td class="activity-total">${timing?.cumulativeMinutes || 0}</td>
          <td class="activity-time">
            ${timing ? `${formatTime12Hour(timing.startTime)} - ${formatTime12Hour(timing.endTime)}` : '-'}
          </td>
          <td class="activity-category">${categoryBadgesHtml}</td>
          <td class="activity-notes">${safeNotes || '-'}</td>
          <td class="activity-remaining">${timing?.minutesRemaining || 0}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeName} - Practice Plan</title>
  <style>
    @media print {
      @page {
        size: letter portrait;
        margin: 0.5in;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      line-height: 1.4;
      color: #1e293b;
    }

    .print-hint {
      margin-bottom: 10px;
      padding: 8px 10px;
      border: 1px solid #dbeafe;
      border-radius: 6px;
      background: #eff6ff;
      color: #1e3a5f;
      font-size: 11px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #1e3a5f;
    }

    .header-left h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 4px;
    }

    .header-left .team-name {
      font-size: 14px;
      color: #64748b;
    }

    .header-right {
      text-align: right;
    }

    .header-right .date {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .header-right .time-location {
      font-size: 12px;
      color: #64748b;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .chart-card,
    .details-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
      break-inside: avoid;
    }

    .card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e3a5f;
      margin-bottom: 10px;
    }

    .chart-layout {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .chart-svg {
      flex-shrink: 0;
    }

    .chart-legend {
      flex: 1;
      display: grid;
      gap: 4px;
    }

    .legend-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 10px;
    }

    .legend-label {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .legend-dot {
      width: 9px;
      height: 9px;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    .legend-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #334155;
    }

    .legend-minutes {
      color: #475569;
      font-weight: 500;
      white-space: nowrap;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .summary-card {
      background: #f8fafc;
      border-radius: 6px;
      padding: 8px;
    }

    .summary-card label {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 4px;
    }

    .summary-card p {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .meta-box {
      padding: 10px;
      background: #f8fafc;
      border-radius: 6px;
    }

    .meta-box label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-bottom: 4px;
    }

    .meta-box p {
      font-size: 12px;
    }

    .activity-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 16px;
    }

    .activity-table th {
      background: #1e3a5f;
      color: white;
      padding: 6px 8px;
      text-align: left;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .activity-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }

    .activity-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .activity-number {
      width: 24px;
      text-align: center;
      font-weight: 600;
    }

    .activity-number span {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      border-radius: 4px;
      color: white;
      font-size: 10px;
    }

    .activity-name {
      font-weight: 500;
    }

    .activity-duration,
    .activity-total,
    .activity-remaining {
      text-align: center;
      width: 46px;
    }

    .activity-time {
      width: 92px;
      font-size: 9px;
    }

    .activity-category {
      width: 130px;
    }

    .category-stack {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      color: white;
      white-space: nowrap;
    }

    .activity-notes {
      font-size: 9px;
      color: #64748b;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
    }

    .total-time {
      font-weight: 600;
      color: #1e3a5f;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-hint">
    This page is your print template. If the print dialog does not open automatically, use Cmd/Ctrl+P and choose Save as PDF.
  </div>
  <div class="header">
    <div class="header-left">
      <h1>${safeName}</h1>
      <div class="team-name">${safeTeamName}</div>
    </div>
    <div class="header-right">
      <div class="date">${formatDate(session.date)}</div>
      <div class="time-location">
        ${session.start_time ? formatTime12Hour(session.start_time) : ''}
        ${safeLocation ? ` • ${safeLocation}` : ''}
        ${session.duration ? ` • ${formatDuration(session.duration)}` : ''}
      </div>
    </div>
  </div>

  <div class="overview-grid">
    <div class="chart-card">
      <div class="card-title">Practice Time Allocation</div>
      <div class="chart-layout">
        <svg class="chart-svg" width="200" height="200" viewBox="0 0 200 200" aria-label="Practice allocation chart">
          ${chartPathsHtml}
          <circle cx="100" cy="100" r="38" fill="#fff"></circle>
          <text x="100" y="96" text-anchor="middle" font-size="28" font-weight="700" fill="#1e293b">${formatMinutesValue(totalAllocated)}</text>
          <text x="100" y="117" text-anchor="middle" font-size="11" fill="#64748b">min</text>
        </svg>
        <div class="chart-legend">${legendHtml}</div>
      </div>
    </div>

    <div class="details-card">
      <div class="card-title">Plan Snapshot</div>
      <div class="summary-grid">
        ${summaryCardsHtml}
      </div>
      <div class="meta-grid">
        ${
          safeDefensive
            ? `
        <div class="meta-box">
          <label>Defensive Emphasis</label>
          <p>${safeDefensive}</p>
        </div>
        `
            : ''
        }
        ${
          safeOffensive
            ? `
        <div class="meta-box">
          <label>Offensive Emphasis</label>
          <p>${safeOffensive}</p>
        </div>
        `
            : ''
        }
        ${
          safeQuote
            ? `
        <div class="meta-box">
          <label>Quote of the Day</label>
          <p>${safeQuote}</p>
        </div>
        `
            : ''
        }
      </div>
      ${
        safeAnnouncements
          ? `
      <div class="meta-box">
        <label>Session Notes</label>
        <p>${safeAnnouncements}</p>
      </div>
      `
          : ''
      }
    </div>
  </div>

  <table class="activity-table">
    <thead>
      <tr>
        <th class="activity-number">#</th>
        <th>Activity</th>
        <th class="activity-duration">Min</th>
        <th class="activity-total">Total</th>
        <th class="activity-time">Time</th>
        <th class="activity-category">Category</th>
        <th>Notes / Points of Emphasis</th>
        <th class="activity-remaining">Remaining</th>
      </tr>
    </thead>
    <tbody>
      ${activitiesHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>Generated by Session Planner</div>
    <div class="total-time">
      Total: ${formatMinutesValue(totalAllocated)} min / ${sessionDuration} min
      ${
        minutesRemaining > 0
          ? ` (${formatMinutesValue(minutesRemaining)} min remaining)`
          : ''
      }
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Open print dialog for a session plan using DOM manipulation
 */
export function printSessionPlan(
  session: SessionWithActivities,
  teamName: string,
  options: SessionPrintOptions = {}
): void {
  const html = generateSessionPrintHTML(session, teamName, options);

  // Prefer a popup window when available.
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      printWindow.focus();
      printWindow.print();
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 80);
    } else {
      printWindow.addEventListener('load', () => setTimeout(triggerPrint, 80), {
        once: true,
      });
    }
    // Fallback in case load events are swallowed by the browser.
    setTimeout(triggerPrint, 900);
    return;
  }

  // Fallback: print through a hidden iframe (helps if popup windows are blocked).
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument;
  if (!iframeWindow || !iframeDocument) {
    iframe.remove();
    alert('Unable to open print preview. Please allow pop-ups and try again.');
    return;
  }

  iframeDocument.open();
  iframeDocument.write(html);
  iframeDocument.close();

  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
    }, 500);
  };

  iframe.addEventListener(
    'load',
    () => {
      iframeWindow.focus();
      iframeWindow.print();
      cleanup();
    },
    { once: true }
  );
}

/**
 * Download session plan as PDF (using browser print to PDF)
 */
export function downloadSessionPDF(
  session: SessionWithActivities,
  teamName: string,
  options: SessionPrintOptions = {}
): void {
  // For actual PDF generation, you would use a library like jsPDF or html2pdf
  // For now, we use the print dialog which allows saving as PDF
  printSessionPlan(session, teamName, options);
}
