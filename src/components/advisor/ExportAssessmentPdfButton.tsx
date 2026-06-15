import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportAssessmentPdfButtonProps {
  assessmentId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

/** Opens the advisor assessment PDF export (GET download). */
export function ExportAssessmentPdfButton({
  assessmentId,
  className,
  variant = "outline",
}: ExportAssessmentPdfButtonProps) {
  return (
    <Button asChild variant={variant} className={cn(className)}>
      <Link href={`/api/advisor/assessment/${assessmentId}/pdf`} prefetch={false}>
        <Download className="h-4 w-4" aria-hidden />
        Export PDF
      </Link>
    </Button>
  );
}
