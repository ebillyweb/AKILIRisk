import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { getFamilyRiskDetailData } from '@/lib/actions/advisor-actions';
import { RiskDetailPanel } from '@/components/intelligence/RiskDetailPanel';

interface RiskDetailPageProps {
  params: Promise<{ familyId: string }>;
}

async function RiskDetailContent({ familyId }: { familyId: string }) {
  const result = await getFamilyRiskDetailData(familyId);

  if (!result.success) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Risk Detail</h2>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const { data } = result;

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold mb-2">No Risk Data Available</h2>
        <p className="text-muted-foreground">
          This family hasn&apos;t completed any personal risk profiles yet, or you don&apos;t have access to this family&apos;s data.
        </p>
      </div>
    );
  }

  return <RiskDetailPanel riskDetail={data} />;
}

export default async function RiskDetailPage({ params }: RiskDetailPageProps) {
  const { familyId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-8">
        <Link
          href="/advisor/intelligence"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Intelligence
        </Link>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Risk Intelligence
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Family Risk Detail
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Detailed risk analysis with governance recommendations and underlying assessment responses.
          </p>
        </div>
      </div>

      {/* Content with Suspense */}
      <Suspense fallback={
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading family risk detail...</p>
        </div>
      }>
        <RiskDetailContent familyId={familyId} />
      </Suspense>
    </div>
  );
}