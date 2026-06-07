"use client";

/**
 * TemplateList Component
 *
 * Per-pillar policy downloads (Word + PDF) with individual and bulk options.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Download, FileType } from "lucide-react";
import { TEMPLATE_REGISTRY, TemplateId } from "@/lib/templates/types";
import toast from "react-hot-toast";

type PolicyFormat = "docx" | "pdf";

interface TemplateListProps {
  assessmentId: string;
  /** Advisor pipeline: same API; server applies co-branding when configured (US-63). */
  variant?: "client" | "advisor";
}

interface DownloadState {
  templateId: TemplateId;
  format: PolicyFormat;
}

export function TemplateList({
  assessmentId,
  variant = "client",
}: TemplateListProps) {
  const [downloading, setDownloading] = useState<DownloadState | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const downloadTemplate = async (templateId: TemplateId, format: PolicyFormat) => {
    try {
      setDownloading({ templateId, format });

      const response = await fetch(
        `/api/templates/${assessmentId}?template=${templateId}&format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Failed to generate template: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const template = TEMPLATE_REGISTRY.find((t) => t.id === templateId);
      const ext = format === "pdf" ? "pdf" : "docx";
      a.download = `${template?.name.replace(/\s+/g, "-").toLowerCase()}-${assessmentId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${template?.name} (${format.toUpperCase()}) downloaded`);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download template"
      );
    } finally {
      setDownloading(null);
    }
  };

  const downloadAllTemplates = async (format: PolicyFormat) => {
    try {
      setDownloadingAll(true);

      for (let i = 0; i < TEMPLATE_REGISTRY.length; i++) {
        const template = TEMPLATE_REGISTRY[i];
        await downloadTemplate(template.id, format);

        if (i < TEMPLATE_REGISTRY.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      toast.success(`All templates (${format.toUpperCase()}) downloaded`);
    } catch (error) {
      console.error("Error downloading all templates:", error);
      toast.error("Failed to download all templates");
    } finally {
      setDownloadingAll(false);
    }
  };

  const isBusy = (templateId: TemplateId, format: PolicyFormat) =>
    downloading?.templateId === templateId && downloading.format === format;

  const anyDownloading = downloading !== null || downloadingAll;

  return (
    <div className="@container space-y-5">
      <div className="flex flex-col gap-3 @sm:flex-row @sm:items-center @sm:justify-between">
        <p className="editorial-kicker">
          {variant === "advisor"
            ? "Per-pillar policy documents"
            : "Governance Policy Templates"}
        </p>
        <div className="flex flex-col gap-2 @sm:flex-row @sm:flex-wrap">
          <Button
            onClick={() => downloadAllTemplates("docx")}
            disabled={anyDownloading}
            variant="outline"
            size="sm"
            className="w-full @sm:w-auto"
          >
            {downloadingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                All Word
              </>
            )}
          </Button>
          <Button
            onClick={() => downloadAllTemplates("pdf")}
            disabled={anyDownloading}
            variant="outline"
            size="sm"
            className="w-full @sm:w-auto"
          >
            {downloadingAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <FileType className="mr-2 h-4 w-4" />
                All PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
        {TEMPLATE_REGISTRY.map((template) => (
          <Card
            key={template.id}
            className="gap-4 rounded-2xl bg-background/55 py-4"
          >
            <CardHeader className="gap-2 px-4 pb-0 sm:px-5">
              <div className="min-w-0 space-y-2">
                <CardTitle className="text-base leading-snug break-words">
                  {template.name}
                </CardTitle>
                <Badge variant="secondary" className="w-fit text-[11px] uppercase tracking-wide">
                  {template.category.replace(/-/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-5">
              <p className="text-sm leading-snug text-muted-foreground">
                {template.description}
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => downloadTemplate(template.id, "docx")}
                  disabled={anyDownloading}
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                >
                  {isBusy(template.id, "docx") ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Word (.docx)
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => downloadTemplate(template.id, "pdf")}
                  disabled={anyDownloading}
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                >
                  {isBusy(template.id, "pdf") ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileType className="mr-2 h-4 w-4" />
                      PDF
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
