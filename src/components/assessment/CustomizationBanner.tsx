'use client';

import { Card, CardContent } from '@/components/ui/card';
import { scopeEmphasisLabel } from '@/lib/assessment/customization';
import { Shield, Clock, Target } from 'lucide-react';

interface CustomizationBannerProps {
  advisorName?: string;
  focusAreaCount: number;
  /** Included assessment domains — used so focus copy stays aligned with progress. */
  includedPillarCount: number;
  estimatedMinutes: number;
}

/**
 * CustomizationBanner Component
 *
 * Displays a styled banner when assessment is customized by an advisor.
 * Shows advisor name, scope/emphasis count, and estimated completion time.
 * Uses editorial design patterns for clean, minimal display.
 */
export function CustomizationBanner({
  advisorName,
  focusAreaCount,
  includedPillarCount,
  estimatedMinutes,
}: CustomizationBannerProps) {
  const advisorDisplayName = advisorName || 'your advisor';
  const scopeLabel = scopeEmphasisLabel(focusAreaCount, includedPillarCount);

  return (
    <Card className="bg-blue-50/80 border-blue-200/60 shadow-sm">
      <CardContent className="flex items-start gap-4 pt-6">
        <div className="rounded-full bg-blue-100 p-2">
          <Shield className="h-5 w-5 text-blue-600" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className="editorial-kicker text-blue-700">Assessment Customized</p>
            <p className="font-medium text-blue-900">
              Your assessment has been customized by {advisorDisplayName}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>{scopeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Estimated {estimatedMinutes} minutes</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
