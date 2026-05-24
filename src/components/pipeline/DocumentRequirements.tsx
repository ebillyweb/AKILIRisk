"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addDocumentRequirement, removeDocumentRequirement } from "@/lib/actions/pipeline-actions";
import type { ClientDetail } from "@/lib/pipeline/types";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";

interface DocumentRequirementsProps {
  clientId: string;
  requirements: ClientDetail['documentRequirements'];
}

const documentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  required: z.boolean(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

export function DocumentRequirements({ clientId, requirements }: DocumentRequirementsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      required: true,
    },
  });

  const isRequired = watch("required");

  const mandatoryRequirements = requirements.filter((req) => req.required);
  const fulfilled = mandatoryRequirements.filter((req) => req.fulfilled).length;
  const total = mandatoryRequirements.length;
  const progressPercentage = total > 0 ? Math.round((fulfilled / total) * 100) : 0;

  const onSubmit = async (data: DocumentFormData) => {
    setIsSubmitting(true);
    try {
      const result = await addDocumentRequirement({
        clientId,
        name: data.name,
        description: data.description || undefined,
        required: data.required,
      });

      if (result.success) {
        setSuccessMessage("Document requirement added successfully");
        setErrorMessage("");
        reset({ name: "", description: "", required: true });
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.error || "Failed to add document requirement");
        setSuccessMessage("");
      }
    } catch (error) {
      setErrorMessage("Failed to add document requirement");
      setSuccessMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (requirementId: string) => {
    setDeletingId(requirementId);
    try {
      const result = await removeDocumentRequirement(requirementId);

      if (result.success) {
        setSuccessMessage("Document requirement removed successfully");
        setErrorMessage("");
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.error || "Failed to remove document requirement");
        setSuccessMessage("");
      }
    } catch (error) {
      setErrorMessage("Failed to remove document requirement");
      setSuccessMessage("");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Requirements
          </CardTitle>
          <Badge variant="outline">
            {fulfilled}/{total} required collected
          </Badge>
        </div>

        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Requirements List */}
        {requirements.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No document requirements set</p>
            <p className="text-sm">Add requirements below to track document collection.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requirements.map((requirement) => (
              <div
                key={requirement.id}
                className="p-3 border rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">{requirement.name}</h4>
                      <Badge variant={requirement.fulfilled ? "default" : "secondary"}>
                        {requirement.fulfilled ? "Fulfilled" : "Pending"}
                      </Badge>
                      {!requirement.required && (
                        <Badge variant="outline">Optional</Badge>
                      )}
                    </div>

                    {requirement.description && (
                      <p className="text-sm text-muted-foreground">
                        {requirement.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Added {format(requirement.createdAt, 'MMM d, yyyy')}
                      </span>
                      {requirement.fulfilledAt && (
                        <span>
                          Fulfilled {format(requirement.fulfilledAt, 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {requirement.fulfilled && (
                      <DocumentDownloadButton requirementId={requirement.id} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingId === requirement.id}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to remove "${requirement.name}"? This action cannot be undone.`)) {
                          handleDelete(requirement.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {!requirement.fulfilled && (
                  <DocumentUpload
                    requirementId={requirement.id}
                    requirementName={requirement.name}
                    onUploadComplete={() => router.refresh()}
                  />
                )}

                {requirement.fulfilled && requirement.fileName && (
                  <p className="text-sm text-muted-foreground truncate">
                    File: <span className="font-medium text-foreground">{requirement.fileName}</span>
                    {requirement.fileSize != null && requirement.fileSize > 0 && (
                      <span className="ml-2">({Math.round(requirement.fileSize / 1024)} KB)</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Requirement Form */}
        <div className="pt-4 border-t">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Document Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Tax returns, Bank statements"
                  {...register("name")}
                  aria-invalid={errors.name ? 'true' : 'false'}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Additional details about this requirement..."
                  rows={2}
                  {...register("description")}
                  aria-invalid={errors.description ? 'true' : 'false'}
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="required"
                  checked={isRequired}
                  onCheckedChange={(checked) =>
                    setValue("required", checked === true, { shouldValidate: true })
                  }
                />
                <Label htmlFor="required" className="font-normal cursor-pointer">
                  Required for client completion
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? "Adding..." : "Add Requirement"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}