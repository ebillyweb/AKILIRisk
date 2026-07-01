'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AssessmentDomainsSelector } from '@/components/advisor/AssessmentDomainsSelector';
import { EmphasisAreasSelector } from '@/components/advisor/EmphasisAreasSelector';
import type { AdvisorAssessmentDomainPickerData } from '@/lib/advisor/assessment-domain-option';
import type { ClientLimitSnapshot } from '@/lib/billing/client-limit';
import { resolveDefaultAssessmentDomainSelection } from '@/lib/advisor/assessment-domain-option';
import { sendInvitation } from '@/lib/actions/invitations';
import { buildDefaultInvitationPersonalMessage } from '@/lib/schemas/invitation';
import { Loader2 } from 'lucide-react';
import { ShareableInvitationLinkAlert } from './ShareableInvitationLinkAlert';

const formSchema = z
  .object({
    clientEmail: z.string().email('Valid email required'),
    clientName: z.string().optional(),
    personalMessage: z.string().max(2000, 'Message too long').optional(),
    intakeWaived: z.boolean().optional(),
    includedPillars: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.intakeWaived) return;
    if (!data.includedPillars?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one assessment domain',
        path: ['includedPillars'],
      });
    }
  });

type FormData = z.infer<typeof formSchema>;

interface InviteClientFormProps {
  firmName: string | null;
  assessmentDomainPicker: AdvisorAssessmentDomainPickerData;
  clientLimitStatus: ClientLimitSnapshot | null;
  skipIntakeEnabled?: boolean;
}

export function InviteClientForm({
  firmName,
  assessmentDomainPicker,
  clientLimitStatus,
  skipIntakeEnabled = true,
}: InviteClientFormProps) {
  const assessmentDomains = assessmentDomainPicker.domains;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ url: string; emailSent: boolean; reason?: string } | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedEmphasis, setSelectedEmphasis] = useState<string[]>([]);
  const [messageEdited, setMessageEdited] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientEmail: '',
      clientName: '',
      personalMessage: '',
      intakeWaived: false,
      includedPillars: [],
      focusAreas: [],
    },
  });

  const personalMessage = watch('personalMessage');
  const intakeWaived = watch('intakeWaived');
  const messageLength = personalMessage?.length || 0;

  const suggestedPersonalMessage = useMemo(
    () =>
      buildDefaultInvitationPersonalMessage(
        firmName,
        intakeWaived && selectedDomains.length > 0 ? selectedDomains : undefined,
      ),
    [firmName, intakeWaived, selectedDomains],
  );

  useEffect(() => {
    if (!messageEdited) {
      setValue('personalMessage', suggestedPersonalMessage);
    }
  }, [messageEdited, setValue, suggestedPersonalMessage]);

  useEffect(() => {
    if (!intakeWaived) {
      setSelectedDomains([]);
      setSelectedEmphasis([]);
      setValue('includedPillars', []);
      setValue('focusAreas', []);
      return;
    }
    if (selectedDomains.length === 0 && assessmentDomains.length > 0) {
      const defaults = resolveDefaultAssessmentDomainSelection({
        availableDomainIds: assessmentDomains.map((d) => d.id),
      });
      setSelectedDomains(defaults);
      setValue('includedPillars', defaults, { shouldValidate: true });
    }
  }, [intakeWaived, assessmentDomains, selectedDomains.length, setValue]);

  const handleDomainsChange = (domains: string[]) => {
    setSelectedDomains(domains);
    setValue('includedPillars', domains, { shouldValidate: true });
    if (selectedEmphasis.some((id) => !domains.includes(id))) {
      const next = selectedEmphasis.filter((id) => domains.includes(id));
      setSelectedEmphasis(next);
      setValue('focusAreas', next, { shouldValidate: true });
    }
  };

  const handleEmphasisChange = (areas: string[]) => {
    setSelectedEmphasis(areas);
    setValue('focusAreas', areas, { shouldValidate: true });
  };

  const resetForm = () => {
    reset();
    setSelectedDomains([]);
    setSelectedEmphasis([]);
    setMessageEdited(false);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('clientEmail', data.clientEmail);
      if (data.clientName) formData.append('clientName', data.clientName);
      if (data.personalMessage?.trim()) {
        formData.append('personalMessage', data.personalMessage.trim());
      }
      if (data.intakeWaived) {
        formData.append('intakeWaived', 'true');
        formData.append('includedPillars', JSON.stringify(data.includedPillars ?? []));
        if (data.focusAreas?.length) {
          formData.append('focusAreas', JSON.stringify(data.focusAreas));
        }
      }

      const result = await sendInvitation(formData);

      if (result.success) {
        const { emailSent, emailNotSentReason, url } = result.data as typeof result.data & { emailSent?: boolean; emailNotSentReason?: string };
        if (emailSent !== false) {
          toast.success(`Invitation sent to ${data.clientEmail}`);
          resetForm();
          router.refresh();
        } else {
          setCreatedLink({ url, emailSent: false, reason: emailNotSentReason });
          resetForm();
          toast.error('Invitation created but email was not sent. Copy the link below to share with your client.', { duration: 6000 });
        }
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to send invitation. Please try again.');
      console.error('Error sending invitation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldLabelClassName = 'text-sm font-semibold text-foreground';
  const fieldHintClassName = 'text-xs leading-5 text-muted-foreground';
  const errorClassName = 'text-sm text-destructive';

  const atClientLimit = clientLimitStatus ? !clientLimitStatus.canAddClient : false;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-2 mb-6">
        <h2 className="text-xl font-semibold tracking-[-0.03em]">Send New Invitation</h2>
        <p className="text-sm text-muted-foreground">
          Invite a client to complete their personal risk profile with personalized messaging.
        </p>
      </div>

      {atClientLimit ? (
        <p className="text-sm text-muted-foreground">
          New invitations are unavailable until you upgrade or free up an active client slot.
        </p>
      ) : (
      <>
      {createdLink && !createdLink.emailSent && (
        <ShareableInvitationLinkAlert
          url={createdLink.url}
          reason={createdLink.reason}
          onDismiss={() => {
            setCreatedLink(null);
            router.refresh();
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="clientEmail" className={fieldLabelClassName}>
              Client Email *
            </label>
            <p className={fieldHintClassName}>
              The email address where the invitation will be sent.
            </p>
            <Input
              id="clientEmail"
              type="email"
              {...register('clientEmail')}
              placeholder="client@example.com"
              aria-invalid={!!errors.clientEmail}
              disabled={isSubmitting}
            />
            {errors.clientEmail && <p className={errorClassName}>{errors.clientEmail.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="clientName" className={fieldLabelClassName}>
              Client Name
            </label>
            <p className={fieldHintClassName}>
              Optional - helps personalize the invitation email.
            </p>
            <Input
              id="clientName"
              {...register('clientName')}
              placeholder="John Doe"
              aria-invalid={!!errors.clientName}
              disabled={isSubmitting}
            />
            {errors.clientName && <p className={errorClassName}>{errors.clientName.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="personalMessage" className={fieldLabelClassName}>
            Personal Message
          </label>
          <p className={fieldHintClassName}>
            Optional. Updates automatically when you select assessment domains, or edit your own message.
          </p>
          <Textarea
            id="personalMessage"
            {...register('personalMessage', {
              onChange: () => setMessageEdited(true),
            })}
            placeholder={suggestedPersonalMessage}
            rows={4}
            aria-invalid={!!errors.personalMessage}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center">
            {errors.personalMessage && <p className={errorClassName}>{errors.personalMessage.message}</p>}
            <p className="text-xs text-muted-foreground ml-auto">
              {messageLength}/2000 characters
            </p>
          </div>
        </div>

        {skipIntakeEnabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="intakeWaived"
              type="checkbox"
              {...register('intakeWaived')}
              disabled={isSubmitting}
              className="h-4 w-4"
            />
            <label htmlFor="intakeWaived" className="text-sm">
              Skip intake — allow the client to go straight to the assessment after signing up
            </label>
          </div>

          {intakeWaived ? (
            <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Choose which assessment domains to include. The client can start only after
                these are set.
              </p>
              <AssessmentDomainsSelector
                domains={assessmentDomains}
                selectedDomains={selectedDomains}
                onChange={handleDomainsChange}
                disabled={isSubmitting}
                platformTotal={assessmentDomainPicker.platformTotal}
                inactiveDomains={assessmentDomainPicker.inactiveDomains}
              />
              <EmphasisAreasSelector
                domains={assessmentDomains}
                includedDomains={selectedDomains}
                selectedEmphasis={selectedEmphasis}
                onChange={handleEmphasisChange}
                disabled={isSubmitting}
              />
              {errors.includedPillars ? (
                <p className={errorClassName}>{errors.includedPillars.message}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || (intakeWaived && selectedDomains.length < 1)}
            size="lg"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </form>
      </>
      )}
    </div>
  );
}
