"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";

import { updateEnterpriseReminderEmailPolicyAction } from "@/lib/actions/reminder-email-policy-actions";
import type { EnterpriseReminderEmailPolicy } from "@/lib/enterprise/enterprise-reminder-email-policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type EnterpriseReminderEmailPolicyFormProps = {
  initialPolicy: EnterpriseReminderEmailPolicy;
};

export function EnterpriseReminderEmailPolicyForm({
  initialPolicy,
}: EnterpriseReminderEmailPolicyFormProps) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await updateEnterpriseReminderEmailPolicyAction(policy);
      if (result.success) {
        toast.success("Reminder email settings saved");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Automated reminder emails</h3>
          <p className="text-sm text-muted-foreground">
            Control firm-wide automated emails sent to clients and advisors when
            workflows stall or documents are overdue.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enterprise-client-reminders"
                checked={policy.clientReminderEmailsEnabled}
                onCheckedChange={(checked) =>
                  setPolicy((current) => ({
                    ...current,
                    clientReminderEmailsEnabled: checked === true,
                  }))
                }
              />
              <Label htmlFor="enterprise-client-reminders">Client reminder emails</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Send assessment and document reminder emails to clients with incomplete
              intake, assessment, or outstanding document requests.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enterprise-advisor-reminders"
                checked={policy.advisorReminderEmailsEnabled}
                onCheckedChange={(checked) =>
                  setPolicy((current) => ({
                    ...current,
                    advisorReminderEmailsEnabled: checked === true,
                  }))
                }
              />
              <Label htmlFor="enterprise-advisor-reminders">Advisor workflow alerts</Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Email team members when a client workflow has been inactive for an extended
              period.
            </p>
          </div>
        </div>

        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" />
              Save reminder settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
