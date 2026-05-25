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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="editorial-kicker">
          {variant === "advisor"
            ? "Per-pillar policy documents"
            : "Governance Policy Templates"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => downloadAllTemplates("docx")}
            disabled={anyDownloading}
            variant="outline"
            size="sm"
          >
            {downloadingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                All Word
              </>
            )}
          </Button>
          <Button
            onClick={() => downloadAllTemplates("pdf")}
            disabled={anyDownloading}
            variant="outline"
            size="sm"
          >
            {downloadingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <FileType className="w-4 h-4 mr-2" />
                All PDF
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {TEMPLATE_REGISTRY.map((template) => (
          <Card key={template.id} className="bg-background/55">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-lg leading-tight">
                    {template.name}
                  </CardTitle>
                  <Badge variant="secondary" className="w-fit text-xs">
                    {template.category.replace(/-/g, " ")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {template.description}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => downloadTemplate(template.id, "docx")}
                  disabled={anyDownloading}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {isBusy(template.id, "docx") ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Word (.docx)
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => downloadTemplate(template.id, "pdf")}
                  disabled={anyDownloading}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {isBusy(template.id, "pdf") ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileType className="w-4 h-4 mr-2" />
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
