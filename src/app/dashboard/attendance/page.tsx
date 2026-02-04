'use client';

import { AttendanceStats } from '@/components/events';

export default function AttendancePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Attendance</h1>
        <p className="text-text-secondary">Track and analyze team attendance over time</p>
      </div>

      <AttendanceStats />
    </div>
  );
}
