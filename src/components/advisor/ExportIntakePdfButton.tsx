import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportIntakePdfButtonProps {
  interviewId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

/** Opens the advisor intake PDF export (GET download). */
export function ExportIntakePdfButton({
  interviewId,
  className,
  variant = "outline",
}: ExportIntakePdfButtonProps) {
  return (
    <Button asChild variant={variant} className={cn(className)}>
      <Link href={`/api/advisor/intake/${interviewId}/pdf`} prefetch={false}>
        <Download className="h-4 w-4" aria-hidden />
        Export PDF
      </Link>
    </Button>
  );
}
