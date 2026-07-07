'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateAdvisorPersonalDetails } from '@/lib/actions/personal-profile';
import type { AdvisorPersonalDetailsInitialData } from '@/lib/schemas/profile';

interface AdvisorPersonalDetailsFormProps {
  initialData: AdvisorPersonalDetailsInitialData;
  /** Firm name is canonical firm branding for enterprise members. */
  firmNameReadOnly?: boolean;
}

export function AdvisorPersonalDetailsForm({
  initialData,
  firmNameReadOnly = false,
}: AdvisorPersonalDetailsFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialData.firstName ?? '');
  const [lastName, setLastName] = useState(initialData.lastName ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [jobTitle, setJobTitle] = useState(initialData.jobTitle ?? '');
  const [firmName, setFirmName] = useState(initialData.firmName ?? '');
  const [licenseNumber, setLicenseNumber] = useState(initialData.licenseNumber ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateAdvisorPersonalDetails({
        firstName,
        lastName,
        phone,
        jobTitle,
        firmName,
        licenseNumber,
      });
      if (result.success) {
        toast.success('Profile updated');
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
      {initialData.email ? (
        <div className="space-y-2">
          <Label htmlFor="advisor-email">Email</Label>
          <Input
            id="advisor-email"
            type="email"
            value={initialData.email}
            readOnly
            disabled
            className="bg-muted/50"
          />
          <p className="text-xs text-muted-foreground">
            To change your sign-in email, contact AKILI using the{' '}
            <Link href="/contact" className="font-medium text-primary underline-offset-2 hover:underline">
              contact form
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="advisor-firstName">First name</Label>
          <Input
            id="advisor-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            disabled={isSubmitting}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advisor-lastName">Last name</Label>
          <Input
            id="advisor-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            disabled={isSubmitting}
            autoComplete="family-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advisor-phone">Phone</Label>
          <Input
            id="advisor-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advisor-jobTitle">Job title</Label>
          <Input
            id="advisor-jobTitle"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Advisor"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="advisor-firmName">Firm</Label>
          <Input
            id="advisor-firmName"
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Firm name"
            readOnly={firmNameReadOnly}
            disabled={isSubmitting || firmNameReadOnly}
            className={firmNameReadOnly ? 'bg-muted/40' : undefined}
          />
          {firmNameReadOnly ? (
            <p className="text-xs text-muted-foreground">
              Managed by your firm owner or administrators. Edit firm branding above if you manage the firm.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="advisor-licenseNumber">License number</Label>
          <Input
            id="advisor-licenseNumber"
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="License number"
            disabled={isSubmitting}
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
