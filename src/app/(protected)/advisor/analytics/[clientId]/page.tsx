import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

import { getFamilyAnalyticsData } from '@/lib/actions/advisor-actions';
import { GovernanceTrendChart } from '@/components/analytics/GovernanceTrendChart';
import { CategoryBreakdownChart } from '@/components/analytics/CategoryBreakdownChart';
import { AssessmentComparisonView } from '@/components/analytics/AssessmentComparisonView';
import { TrendIndicator } from '@/components/analytics/TrendIndicator';

interface AnalyticsPageProps {
  params: Promise<{ clientId: string }>;
}

async function AnalyticsContent({ clientId }: { clientId: string }) {
  const result = await getFamilyAnalyticsData(clientId);

  if (!result.success) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Analytics</h2>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const { data } = result;

  if (!data || data.assessments.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold mb-2">No Completed Assessments Yet</h2>
        <p className="text-muted-foreground">
          This family hasn&apos;t completed any personal risk profiles. Analytics will appear after the first assessment is completed.
        </p>
      </div>
    );
  }

  const latestAssessment = data.assessments[data.assessments.length - 1];

  return (
    <div className="space-y-6">
      {/* Latest assessment summary */}
      <section className="p-6 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Latest Assessment Summary</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-3xl font-bold">{latestAssessment.overallScore.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground ml-1">/ 3 avg</span>
          </div>
          <TrendIndicator direction={latestAssessment.trendDirection} />
          <div className="text-sm text-muted-foreground">
            {data.assessments.length} assessment{data.assessments.length !== 1 ? 's' : ''} completed
          </div>
          <div className="text-sm text-muted-foreground">
            Last: {format(new Date(latestAssessment.completedAt), 'MMM d, yyyy')}
          </div>
        </div>
      </section>

      {/* Governance trend chart */}
      <section>
        <GovernanceTrendChart data={data.trendData} />
      </section>

      {/* Category breakdown chart */}
      <section>
        <CategoryBreakdownChart data={data.latestBreakdown} />
      </section>

      {/* Assessment comparison */}
      <section>
        <div className="p-6 border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Assessment Comparison</h2>
          <AssessmentComparisonView assessments={data.assessments} />
        </div>
      </section>
    </div>
  );
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { clientId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-8">
        <Link
          href="/advisor/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Family Analytics
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Governance Trends
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Track governance score trends, category performance, and risk indicators across assessment periods.
          </p>
        </div>
      </div>

      {/* Content with Suspense */}
      <Suspense fallback={
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      }>
        <AnalyticsContent clientId={clientId} />
      </Suspense>
    </div>
  );
}