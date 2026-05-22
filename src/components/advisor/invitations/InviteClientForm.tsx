'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sendInvitation } from '@/lib/actions/invitations';
import { DEFAULT_INVITATION_PERSONAL_MESSAGE } from '@/lib/schemas/invitation';
import { Loader2 } from 'lucide-react';
import { ShareableInvitationLinkAlert } from './ShareableInvitationLinkAlert';

// Form-specific schema for client-side validation
const formSchema = z.object({
  clientEmail: z.string().email("Valid email required"),
  clientName: z.string().optional(),
  personalMessage: z.string().max(2000, "Message too long").optional(),
  intakeWaived: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function InviteClientForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ url: string; emailSent: boolean; reason?: string } | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientEmail: '',
      clientName: '',
      personalMessage: '',
      intakeWaived: false,
    },
  });

  const personalMessage = watch('personalMessage');
  const messageLength = personalMessage?.length || 0;

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('clientEmail', data.clientEmail);
      if (data.clientName) formData.append('clientName', data.clientName);
      if (data.personalMessage?.trim()) {
        formData.append('personalMessage', data.personalMessage.trim());
      }
  if (data.intakeWaived) formData.append('intakeWaived', 'true');

      const result = await sendInvitation(formData);

      if (result.success) {
        const { emailSent, emailNotSentReason, url } = result.data as typeof result.data & { emailSent?: boolean; emailNotSentReason?: string };
        if (emailSent !== false) {
          toast.success(`Invitation sent to ${data.clientEmail}`);
          reset();
          router.refresh();
        } else {
          setCreatedLink({ url, emailSent: false, reason: emailNotSentReason });
          reset();
          toast.error("Invitation created but email was not sent. Copy the link below to share with your client.", { duration: 6000 });
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

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-2 mb-6">
        <h2 className="text-xl font-semibold tracking-[-0.03em]">Send New Invitation</h2>
        <p className="text-sm text-muted-foreground">
          Invite a client to complete their family governance assessment with personalized messaging.
        </p>
      </div>

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
            Optional. Leave blank to send the standard invitation message.
          </p>
          <Textarea
            id="personalMessage"
            {...register('personalMessage')}
            placeholder={DEFAULT_INVITATION_PERSONAL_MESSAGE}
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

        <div className="space-y-2">
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
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </form>
    </div>
  );
}