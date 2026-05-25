'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateClientOptionalPii } from '@/lib/actions/client-optional-pii-actions';
import { PII_FIELD_LABELS } from '@/lib/advisor/pii-policy';
import type { SettingsOptionalPiiField } from '@/lib/advisor/client-optional-pii-settings';

export interface ClientOptionalPiiFormProps {
  initialData: {
    legalName: string;
    phone: string;
    offeredFields: SettingsOptionalPiiField[];
    consentGranted: Partial<Record<SettingsOptionalPiiField, boolean>>;
  };
}

export function ClientOptionalPiiForm({ initialData }: ClientOptionalPiiFormProps) {
  const router = useRouter();
  const [legalName, setLegalName] = useState(initialData.legalName);
  const [phone, setPhone] = useState(initialData.phone);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (initialData.offeredFields.length === 0) {
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateClientOptionalPii({ legalName, phone });
      if (result.success) {
        toast.success('Optional details saved');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  }

  const showName = initialData.offeredFields.includes('User.name');
  const showPhone = initialData.offeredFields.includes('ClientProfile.phone');

  return (
    <Card data-testid="client-optional-pii-form">
      <CardHeader>
        <CardTitle className="text-3xl">Optional details for your advisor</CardTitle>
        <CardDescription>
          Fields your advisor may collect. Saving a value grants them visibility for that
          field (you can change Yes/No later under Privacy).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {showName ? (
            <div className="space-y-2" data-pii-field="User.name">
              <Label htmlFor="client-legal-name">
                {PII_FIELD_LABELS['User.name'].label}
              </Label>
              <Input
                id="client-legal-name"
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Full legal name"
                disabled={isSubmitting}
                autoComplete="name"
              />
              <p className="text-sm text-muted-foreground">
                {PII_FIELD_LABELS['User.name'].description}
              </p>
              {initialData.consentGranted['User.name'] ? (
                <p className="text-xs text-muted-foreground">
                  Your advisor can already see this field.
                </p>
              ) : null}
            </div>
          ) : null}

          {showPhone ? (
            <div className="space-y-2" data-pii-field="ClientProfile.phone">
              <Label htmlFor="client-phone">
                {PII_FIELD_LABELS['ClientProfile.phone'].label}
              </Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                disabled={isSubmitting}
                autoComplete="tel"
              />
              <p className="text-sm text-muted-foreground">
                {PII_FIELD_LABELS['ClientProfile.phone'].description}
              </p>
              {initialData.consentGranted['ClientProfile.phone'] ? (
                <p className="text-xs text-muted-foreground">
                  Your advisor can already see this field.
                </p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save optional details'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
