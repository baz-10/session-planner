/**
 * PDF Export utility for session plans
 * Uses browser print functionality with custom print styles
 */

import {
  calculateActivityTimings,
  formatTime12Hour,
  formatDuration,
} from './time';
import type { Session, SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface SessionWithActivities extends Session {
  activities: ActivityWithCategory[];
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

/**
 * Generate HTML content for printing a session plan
 */
export function generateSessionPrintHTML(
  session: SessionWithActivities,
  teamName: string
): string {
  const timings = calculateActivityTimings(
    session.activities.map((a) => ({ id: a.id, duration: a.duration })),
    session.start_time || '17:00',
    session.duration || 90
  );

  const timingMap = new Map(timings.map((t) => [t.id, t]));

  const totalAllocated = session.activities.reduce((sum, a) => sum + a.duration, 0);

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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
      const categoryColor = activity.category?.color || '#94a3b8';
      const safeCategoryName = escapeHtml(activity.category?.name);
      const safeActivityName = escapeHtml(activity.name);
      const safeNotes = escapeHtml(activity.notes);

      return `
        <tr>
          <td class="activity-number">
            <span style="background-color: ${categoryColor}">${index + 1}</span>
          </td>
          <td class="activity-name">${safeActivityName}</td>
          <td class="activity-duration">${activity.duration}</td>
          <td class="activity-total">${timing?.cumulativeMinutes || 0}</td>
          <td class="activity-time">
            ${timing ? `${formatTime12Hour(timing.startTime)} - ${formatTime12Hour(timing.endTime)}` : '-'}
          </td>
          <td class="activity-category">
            ${
              activity.category
                ? `<span class="category-badge" style="background-color: ${activity.category.color}">${safeCategoryName}</span>`
                : '-'
            }
          </td>
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
        size: letter landscape;
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
      font-size: 11px;
      line-height: 1.4;
      color: #1e293b;
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

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
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
      margin-bottom: 16px;
    }

    .activity-table th {
      background: #1e3a5f;
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .activity-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    .activity-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .activity-number {
      width: 30px;
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
      width: 60px;
    }

    .activity-time {
      width: 100px;
      font-size: 10px;
    }

    .activity-category {
      width: 100px;
    }

    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      color: white;
    }

    .activity-notes {
      font-size: 10px;
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
    }
  </style>
</head>
<body>
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
  <div class="meta-box" style="margin-bottom: 16px;">
    <label>Announcements</label>
    <p>${safeAnnouncements}</p>
  </div>
  `
      : ''
  }

  <table class="activity-table">
    <thead>
      <tr>
        <th class="activity-number">#</th>
        <th>Activity</th>
        <th class="activity-duration">Min</th>
        <th class="activity-total">Total</th>
        <th class="activity-time">Time</th>
        <th class="activity-category">Category</th>
        <th>Notes</th>
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
      Total: ${totalAllocated} min / ${session.duration || 90} min
      ${
        session.duration && totalAllocated < session.duration
          ? ` (${session.duration - totalAllocated} min remaining)`
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
  teamName: string
): void {
  const html = generateSessionPrintHTML(session, teamName);

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    // Use DOM manipulation instead of document.write
    printWindow.document.open();
    const doc = printWindow.document;

    // Parse the HTML and append to body
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, 'text/html');

    // Copy head content
    while (doc.head.firstChild) {
      doc.head.removeChild(doc.head.firstChild);
    }
    Array.from(parsed.head.children).forEach((child) => {
      doc.head.appendChild(doc.importNode(child, true));
    });

    // Copy body content
    while (doc.body.firstChild) {
      doc.body.removeChild(doc.body.firstChild);
    }
    Array.from(parsed.body.children).forEach((child) => {
      doc.body.appendChild(doc.importNode(child, true));
    });

    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

/**
 * Download session plan as PDF (using browser print to PDF)
 */
export function downloadSessionPDF(
  session: SessionWithActivities,
  teamName: string
): void {
  // For actual PDF generation, you would use a library like jsPDF or html2pdf
  // For now, we use the print dialog which allows saving as PDF
  printSessionPlan(session, teamName);
}
