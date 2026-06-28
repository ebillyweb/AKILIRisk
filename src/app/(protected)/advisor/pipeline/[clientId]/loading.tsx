import { ArrowLeft, BarChart3, FileText, CheckCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ClientDetailLoading() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" className="p-0 text-sm text-muted-foreground" disabled>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Pipeline
        </Button>
        <Skeleton className="size-9 rounded-md" />
      </div>

      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-4 w-80" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-1.5 flex-1" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Workflow Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="relative flex items-start space-x-4">
                    {/* Timeline line */}
                    {index < 4 && (
                      <div className="absolute left-4 top-8 w-0.5 h-16 bg-gray-200" />
                    )}

                    {/* Timeline dot */}
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />

                    {/* Event content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Skeleton className="h-5 w-32" /> {/* Event label */}
                        <Skeleton className="h-5 w-16" /> {/* Stage badge */}
                      </div>
                      <Skeleton className="h-4 w-40" /> {/* Date */}
                      <Skeleton className="h-4 w-56" /> {/* Detail */}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Intake Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Intake Interview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index}>
                    <Skeleton className="h-4 w-16 mb-2" /> {/* Label */}
                    <Skeleton className="h-6 w-20" /> {/* Value */}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Assessment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index}>
                      <Skeleton className="h-4 w-16 mb-2" /> {/* Label */}
                      <Skeleton className="h-6 w-20" /> {/* Value */}
                    </div>
                  ))}
                </div>

                {/* Pillar Scores Skeleton */}
                <div>
                  <Skeleton className="h-4 w-20 mb-3" /> {/* "Risk Pillars" title */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" /> {/* Pillar name */}
                          <Skeleton className="h-3 w-16" /> {/* Risk level */}
                        </div>
                        <Skeleton className="h-5 w-8" /> {/* Score */}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Document Requirements */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Document Requirements
                </CardTitle>
                <Skeleton className="h-5 w-20" /> {/* Progress badge */}
              </div>
              <Skeleton className="h-2 w-full mt-4" /> {/* Progress bar */}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requirements List Skeleton */}
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-32" /> {/* Name */}
                        <Skeleton className="h-5 w-16" /> {/* Badge */}
                      </div>
                      <Skeleton className="h-3 w-48" /> {/* Description */}
                      <Skeleton className="h-3 w-24" /> {/* Date */}
                    </div>
                    <Skeleton className="w-8 h-8" /> {/* Delete button */}
                  </div>
                ))}
              </div>

              {/* Add Form Skeleton */}
              <div className="pt-4 border-t space-y-3">
                <Skeleton className="h-4 w-24" /> {/* Form label */}
                <Skeleton className="h-10 w-full" /> {/* Input */}
                <Skeleton className="h-20 w-full" /> {/* Textarea */}
                <Skeleton className="h-10 w-full" /> {/* Button */}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}