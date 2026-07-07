"use client";

import { format } from "date-fns";
import { type WorkflowEvent, type ClientWorkflowStage } from "@/lib/pipeline/types";
import { getStageLabel, resolveAdvisorPipelineDisplayStage } from "@/lib/pipeline/status";

interface WorkflowTimelineProps {
  events: WorkflowEvent[];
  currentStage: ClientWorkflowStage;
  documentRequirementsEnabled?: boolean;
}

function getEventColor(
  stage: ClientWorkflowStage,
  currentStage: ClientWorkflowStage,
  documentRequirementsEnabled: boolean,
) {
  const displayCurrentStage = resolveAdvisorPipelineDisplayStage(
    currentStage,
    documentRequirementsEnabled,
  );
  const stageOrder: Record<ClientWorkflowStage, number> = {
    'INVITED': 1,
    'REGISTERED': 2,
    'INTAKE_IN_PROGRESS': 3,
    'INTAKE_COMPLETE': 4,
    'ASSESSMENT_IN_PROGRESS': 5,
    'ASSESSMENT_COMPLETE': 6,
    'DOCUMENTS_REQUIRED': 7,
    'COMPLETE': 8,
  };

  const eventOrder = stageOrder[stage];
  const currentOrder = stageOrder[displayCurrentStage];

  if (eventOrder <= currentOrder) {
    return 'bg-green-500'; // Completed
  }
  return 'bg-gray-300'; // Future
}

function getCurrentStageColor(
  stage: ClientWorkflowStage,
  currentStage: ClientWorkflowStage,
  documentRequirementsEnabled: boolean,
) {
  if (stage === currentStage) {
    return 'bg-primary ring-4 ring-primary/20'; // Current stage with pulse effect
  }
  return getEventColor(stage, currentStage, documentRequirementsEnabled);
}

export function WorkflowTimeline({
  events,
  currentStage,
  documentRequirementsEnabled = true,
}: WorkflowTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No workflow events recorded yet.
      </div>
    );
  }

  // Sort events newest first for display
  const sortedEvents = [...events].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      {sortedEvents.map((event, index) => (
        <div key={`${event.stage}-${event.date.getTime()}`} className="relative flex items-start space-x-4">
          {/* Timeline line */}
          {index < sortedEvents.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-16 bg-gray-200" />
          )}

          {/* Timeline dot */}
          <div className={`
            relative z-10 w-8 h-8 rounded-full flex items-center justify-center
            ${getCurrentStageColor(event.stage, currentStage, documentRequirementsEnabled)}
            ${event.stage === currentStage ? 'animate-pulse' : ''}
          `}>
            {event.stage === currentStage && (
              <div className="w-3 h-3 bg-white rounded-full" />
            )}
          </div>

          {/* Event content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-foreground">{event.label}</h3>
              <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                {getStageLabel(
                  resolveAdvisorPipelineDisplayStage(
                    event.stage,
                    documentRequirementsEnabled,
                  ),
                )}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {format(event.date, 'MMM d, yyyy h:mm a')}
            </p>

            {event.detail && (
              <p className="text-sm text-muted-foreground mt-2">
                {event.detail}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}