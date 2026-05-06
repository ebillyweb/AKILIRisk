'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateClientPersonalDetails } from '@/lib/actions/personal-profile';
import type { ClientPersonalDetailsFormData } from '@/lib/schemas/profile';

interface ClientPersonalDetailsFormProps {
  initialData: ClientPersonalDetailsFormData;
}

/**
 * Round-11 commit 2.1 (BRD §5.1 amendment): client personal details
 * form is reduced to firstName/lastName. Contact + address + DOB
 * fields were dropped from ClientProfile per the "minimization by
 * omission" strategy. The next round-11 commit consolidates
 * firstName/lastName into a single `name` column; this form will
 * become a single "Display name" input at that point.
 */
export function ClientPersonalDetailsForm({ initialData }: ClientPersonalDetailsFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialData.firstName ?? '');
  const [lastName, setLastName] = useState(initialData.lastName ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateClientPersonalDetails({ firstName, lastName });
      if (result.success) {
        toast.success('Personal details updated');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Akili Risk only stores your name and email for client accounts.
        Address, phone, and date of birth are not collected (BRD §5.1).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="client-firstName">First name</Label>
          <Input
            id="client-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            disabled={isSubmitting}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-lastName">Last name</Label>
          <Input
            id="client-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            disabled={isSubmitting}
            autoComplete="family-name"
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save personal details'}
      </Button>
    </form>
  );
}
