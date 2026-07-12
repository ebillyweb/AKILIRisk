"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { updatePlatformAdvisorFeatureFlags } from "@/lib/admin/platform-settings-actions";
import { FieldHelp } from "@/components/ui/field-help";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AdminAdvisorFeatureFlagsFormProps {
  initialGovernanceDashboard: boolean;
  initialRiskIntelligence: boolean;
  initialWorkflowTasks: boolean;
  initialWorkflowFollowUps: boolean;
  initialMonitoring: boolean;
}

export function AdminAdvisorFeatureFlagsForm({
  initialGovernanceDashboard,
  initialRiskIntelligence,
  initialWorkflowTasks,
  initialWorkflowFollowUps,
  initialMonitoring,
}: AdminAdvisorFeatureFlagsFormProps) {
  const router = useRouter();
  const [gov, setGov] = useState(initialGovernanceDashboard);
  const [risk, setRisk] = useState(initialRiskIntelligence);
  const [tasks, setTasks] = useState(initialWorkflowTasks);
  const [followUps, setFollowUps] = useState(initialWorkflowFollowUps);
  const [monitoring, setMonitoring] = useState(initialMonitoring);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setGov(initialGovernanceDashboard);
    setRisk(initialRiskIntelligence);
    setTasks(initialWorkflowTasks);
    setFollowUps(initialWorkflowFollowUps);
    setMonitoring(initialMonitoring);
  }, [
    initialGovernanceDashboard,
    initialRiskIntelligence,
    initialWorkflowTasks,
    initialWorkflowFollowUps,
    initialMonitoring,
  ]);

  function persist(
    nextGov: boolean,
    nextRisk: boolean,
    nextTasks: boolean,
    nextFollowUps: boolean,
    nextMonitoring: boolean,
  ) {
    startTransition(async () => {
      const result = await updatePlatformAdvisorFeatureFlags({
        advisorGovernanceDashboardEnabled: nextGov,
        advisorRiskIntelligenceEnabled: nextRisk,
        advisorWorkflowTasksEnabled: nextTasks,
        advisorWorkflowFollowUpsEnabled: nextFollowUps,
        advisorMonitoringEnabled: nextMonitoring,
      });
      if (result.success) {
        setGov(nextGov);
        setRisk(nextRisk);
        setTasks(nextTasks);
        setFollowUps(nextFollowUps);
        setMonitoring(nextMonitoring);
        toast.success("Feature flags updated");
        router.refresh();
      } else {
        toast.error(result.error ?? "Update failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="flag-governance-dashboard"
          checked={gov}
          disabled={pending}
          onCheckedChange={(v) => {
            const checked = v === true;
            persist(checked, risk, tasks, followUps, monitoring);
          }}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="flag-governance-dashboard" className="text-sm font-medium leading-none">
              Advisor governance dashboard
            </Label>
            <FieldHelp helpKey="flag-governance-dashboard" triggerLabel="Governance dashboard" />
          </div>
          <p className="text-sm text-muted-foreground">
            Family Portfolio, metrics, and analytics under{" "}
            <code className="text-xs">/advisor/dashboard</code> and{" "}
            <code className="text-xs">/advisor/analytics</code>. When off, nav links are hidden and routes redirect to
            Clients.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="flag-risk-intelligence"
          checked={risk}
          disabled={pending}
          onCheckedChange={(v) => {
            const checked = v === true;
            persist(gov, checked, tasks, followUps, monitoring);
          }}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="flag-risk-intelligence" className="text-sm font-medium leading-none">
              Advisor risk intelligence
            </Label>
            <FieldHelp helpKey="flag-risk-intelligence" triggerLabel="Risk intelligence" />
          </div>
          <p className="text-sm text-muted-foreground">
            Portfolio risk views under <code className="text-xs">/advisor/intelligence</code>. When off, nav links are
            hidden and routes redirect to Clients.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="flag-workflow-tasks"
          checked={tasks}
          disabled={pending}
          onCheckedChange={(v) => {
            const checked = v === true;
            persist(gov, risk, checked, followUps, monitoring);
          }}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="flag-workflow-tasks" className="text-sm font-medium leading-none">
              Advisor workflow tasks
            </Label>
            <FieldHelp helpKey="flag-workflow-tasks" triggerLabel="Workflow tasks" />
          </div>
          <p className="text-sm text-muted-foreground">
            Shows <span className="font-medium text-foreground">Tasks</span> in the advisor Workflow nav. Leave off until
            the tasks workspace is ready.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="flag-workflow-follow-ups"
          checked={followUps}
          disabled={pending}
          onCheckedChange={(v) => {
            const checked = v === true;
            persist(gov, risk, tasks, checked, monitoring);
          }}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="flag-workflow-follow-ups" className="text-sm font-medium leading-none">
              Advisor workflow follow-ups
            </Label>
            <FieldHelp helpKey="flag-workflow-follow-ups" triggerLabel="Workflow follow-ups" />
          </div>
          <p className="text-sm text-muted-foreground">
            Shows <span className="font-medium text-foreground">Follow-ups</span> in the advisor Workflow nav. Leave off
            until the follow-ups workspace is ready.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id="flag-monitoring"
          checked={monitoring}
          disabled={pending}
          onCheckedChange={(v) => {
            const checked = v === true;
            persist(gov, risk, tasks, followUps, checked);
          }}
        />
        <div className="grid gap-1">
          <div className="flex items-center gap-1">
            <Label htmlFor="flag-monitoring" className="text-sm font-medium leading-none">
              Advisor pipeline monitoring
            </Label>
            <FieldHelp helpKey="flag-monitoring" triggerLabel="Pipeline monitoring" />
          </div>
          <p className="text-sm text-muted-foreground">
            Adds a <span className="font-medium text-foreground">Monitoring</span> chevron to the
            client pipeline journey rail after report. Leave off until the monitoring workspace is
            ready.
          </p>
        </div>
      </div>
    </div>
  );
}
