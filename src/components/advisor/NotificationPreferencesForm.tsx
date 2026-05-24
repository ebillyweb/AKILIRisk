'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { NotificationPreference } from '@prisma/client';

const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailMilestones: z.boolean(),
  emailReminders: z.boolean(),
  emailStalled: z.boolean(),
  emailRegistrations: z.boolean(),
  reminderFrequencyDays: z.number().min(1).max(30),
  quietStart: z.string().optional(),
  quietEnd: z.string().optional(),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

interface NotificationPreferencesFormProps {
  preferences: NotificationPreference;
  updatePreferencesAction: (formData: FormData) => Promise<{
    success: boolean;
    error?: string;
    fieldErrors?: any;
    data?: any;
  }>;
}

export function NotificationPreferencesForm({
  preferences,
  updatePreferencesAction
}: NotificationPreferencesFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      emailEnabled: preferences.emailEnabled,
      emailMilestones: preferences.emailMilestones,
      emailReminders: preferences.emailReminders,
      emailStalled: preferences.emailStalled,
      emailRegistrations: preferences.emailRegistrations,
      reminderFrequencyDays: preferences.reminderFrequencyDays,
      quietStart: preferences.quietStart ?? '',
      quietEnd: preferences.quietEnd ?? '',
    },
  });

  const emailEnabled = watch('emailEnabled');

  const onSubmit = async (data: PreferencesFormData) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('emailEnabled', data.emailEnabled.toString());
      formData.append('emailMilestones', data.emailMilestones.toString());
      formData.append('emailReminders', data.emailReminders.toString());
      formData.append('emailStalled', data.emailStalled.toString());
      formData.append('emailRegistrations', data.emailRegistrations.toString());
      formData.append('reminderFrequencyDays', data.reminderFrequencyDays.toString());
      formData.append('quietStart', data.quietStart?.trim() ?? '');
      formData.append('quietEnd', data.quietEnd?.trim() ?? '');

      const result = await updatePreferencesAction(formData);

      if (result.success) {
        toast.success('Notification preferences updated');
      } else {
        toast.error(result.error || 'Failed to update preferences');
      }
    } catch (error) {
      toast.error('Failed to update preferences. Please try again.');
      console.error('Error updating preferences:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-1 mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Control which notifications you receive and how often.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Master toggle */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="emailEnabled"
              {...register('emailEnabled')}
              checked={emailEnabled}
              onCheckedChange={(checked) => setValue('emailEnabled', checked as boolean)}
            />
            <Label htmlFor="emailEnabled" className="font-medium">
              Email Notifications
            </Label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            Master toggle for all email notifications
          </p>
        </div>

        {/* Category toggles */}
        <div className="space-y-4 pl-6 border-l-2 border-muted">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailRegistrations"
                {...register('emailRegistrations')}
                disabled={!emailEnabled}
                onCheckedChange={(checked) => setValue('emailRegistrations', checked as boolean)}
              />
              <Label
                htmlFor="emailRegistrations"
                className={emailEnabled ? '' : 'text-muted-foreground'}
              >
                Client Registrations
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Get notified when a client registers from your invitation
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailMilestones"
                {...register('emailMilestones')}
                disabled={!emailEnabled}
                onCheckedChange={(checked) => setValue('emailMilestones', checked as boolean)}
              />
              <Label
                htmlFor="emailMilestones"
                className={emailEnabled ? '' : 'text-muted-foreground'}
              >
                Milestone Completions
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Get notified when clients complete intake or assessment
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailReminders"
                {...register('emailReminders')}
                disabled={!emailEnabled}
                onCheckedChange={(checked) => setValue('emailReminders', checked as boolean)}
              />
              <Label
                htmlFor="emailReminders"
                className={emailEnabled ? '' : 'text-muted-foreground'}
              >
                Assessment Reminders
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Send reminder emails to clients with incomplete assessments
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="emailStalled"
                {...register('emailStalled')}
                disabled={!emailEnabled}
                onCheckedChange={(checked) => setValue('emailStalled', checked as boolean)}
              />
              <Label
                htmlFor="emailStalled"
                className={emailEnabled ? '' : 'text-muted-foreground'}
              >
                Stalled Workflow Alerts
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Get notified when client workflows stall
            </p>
          </div>
        </div>

        {/* Quiet hours (UTC) */}
        <div className="space-y-2">
          <Label className="font-medium">Quiet hours (UTC)</Label>
          <p className="text-xs text-muted-foreground">
            Email notifications are suppressed during this window. Leave blank to disable.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="quietStart" className="text-xs text-muted-foreground">
                Start
              </Label>
              <Input
                id="quietStart"
                type="time"
                {...register('quietStart')}
                disabled={isSubmitting}
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quietEnd" className="text-xs text-muted-foreground">
                End
              </Label>
              <Input
                id="quietEnd"
                type="time"
                {...register('quietEnd')}
                disabled={isSubmitting}
                className="w-32"
              />
            </div>
          </div>
        </div>

        {/* Reminder frequency */}
        <div className="space-y-2">
          <Label htmlFor="reminderFrequencyDays" className="font-medium">
            Minimum days between reminder emails
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id="reminderFrequencyDays"
              type="number"
              min="1"
              max="30"
              {...register('reminderFrequencyDays', { valueAsNumber: true })}
              disabled={isSubmitting}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          {errors.reminderFrequencyDays && (
            <p className="text-sm text-destructive">{errors.reminderFrequencyDays.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            How often reminders can be sent to clients (1-30 days)
          </p>
        </div>

        {/* Submit button */}
        <div className="pt-4">
          <Button type="submit" disabled={isSubmitting} size="sm" className="min-w-[100px]">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}