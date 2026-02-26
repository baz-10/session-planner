'use client';

import { useMemo } from 'react';
import {
  calculateCategoryAllocations,
  type CategoryAllocation,
} from '@/lib/utils/time';
import type { SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface TimeAllocationChartProps {
  activities: ActivityWithCategory[];
  totalDuration: number;
  categories?: DrillCategory[];
  drillCategoryIdsByDrillId?: Record<string, string[]>;
}

export function TimeAllocationChart({
  activities,
  totalDuration,
  categories: _categories,
  drillCategoryIdsByDrillId: _drillCategoryIdsByDrillId,
}: TimeAllocationChartProps) {
  const allocations = useMemo(() => {
    return calculateCategoryAllocations(activities, totalDuration);
  }, [activities, totalDuration]);

  // Calculate SVG pie chart segments
  const pieSegments = useMemo(() => {
    let startAngle = 0;
    const segments: Array<{
      path: string;
      color: string;
      name: string;
      percentage: number;
      minutes: number;
    }> = [];

    allocations.forEach((allocation) => {
      if (allocation.percentage <= 0) return;

      const angle = (allocation.percentage / 100) * 360;
      const endAngle = startAngle + angle;

      // Convert angles to radians
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      // Calculate arc points
      const radius = 80;
      const cx = 100;
      const cy = 100;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      // Determine if we need a large arc
      const largeArc = angle > 180 ? 1 : 0;

      // Create path
      const path =
        allocation.percentage >= 100
          ? // Full circle
            `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      segments.push({
        path,
        color: allocation.categoryColor,
        name: allocation.categoryName,
        percentage: allocation.percentage,
        minutes: allocation.minutes,
      });

      startAngle = endAngle;
    });

    return segments;
  }, [allocations]);

  const totalAllocated = activities.reduce((sum, a) => sum + a.duration, 0);
  const minutesRemaining = Math.max(0, totalDuration - totalAllocated);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">
          Practice Time Allocation Chart (By Category)
        </h3>
        <button
          onClick={() => {}}
          className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-light"
        >
          Refresh Chart
        </button>
      </div>

      <div className="flex gap-6">
        {/* Pie Chart */}
        <div className="flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {pieSegments.length > 0 ? (
              pieSegments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.path}
                  fill={segment.color}
                  stroke="#fff"
                  strokeWidth="2"
                >
                  <title>
                    {segment.name}: {segment.minutes} min ({segment.percentage.toFixed(1)}%)
                  </title>
                </path>
              ))
            ) : (
              <circle cx="100" cy="100" r="80" fill="#e5e7eb" />
            )}
            {/* Center hole for donut effect */}
            <circle cx="100" cy="100" r="40" fill="#fff" />
            {/* Center text */}
            <text
              x="100"
              y="95"
              textAnchor="middle"
              className="text-2xl font-bold"
              fill="#1e293b"
            >
              {totalAllocated}
            </text>
            <text
              x="100"
              y="115"
              textAnchor="middle"
              className="text-xs"
              fill="#64748b"
            >
              min
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {allocations.map((allocation, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: allocation.categoryColor }}
                />
                <span className="text-gray-700">{allocation.categoryName}</span>
              </div>
              <span className="text-gray-600">{allocation.minutes} Min.</span>
            </div>
          ))}

          {/* Show remaining time prominently if > 0 */}
          {minutesRemaining > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: '#e5e7eb' }}
                  />
                  <span className="text-orange-600">Min Remaining</span>
                </div>
                <span className="text-orange-600">{minutesRemaining} Min.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-light"
        >
          Print Chart
        </button>
      </div>
    </div>
  );
}
