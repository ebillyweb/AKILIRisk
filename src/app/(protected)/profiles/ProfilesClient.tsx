'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import type { HouseholdMember } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberCard } from '@/components/profiles/MemberCard';
import { ProfileForm } from '@/components/profiles/ProfileForm';
import { createHouseholdMember, updateHouseholdMember, deleteHouseholdMember } from '@/lib/actions/profile-actions';
import { HouseholdMemberFormData } from '@/lib/schemas/profile';
import { ArrowLeft, Plus, ShieldCheck, Users } from 'lucide-react';

type FormData = HouseholdMemberFormData;

interface ProfilesClientProps {
  initialMembers: HouseholdMember[];
}

export function ProfilesClient({ initialMembers }: ProfilesClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const residentCount = initialMembers.filter((member) => member.isResident).length;
  const advisoryCount = initialMembers.filter((member) => member.governanceRoles.length > 0).length;

  const handleAddMember = () => {
    setEditingMember(null);
    setShowForm(true);
  };

  const handleEditMember = (member: HouseholdMember) => {
    setEditingMember(member);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingMember(null);
  };

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      let result;
      if (editingMember) {
        result = await updateHouseholdMember(editingMember.id, data);
      } else {
        result = await createHouseholdMember(data);
      }

      if (result.success) {
        toast.success(editingMember ? 'Member updated successfully' : 'Member added successfully');
        setShowForm(false);
        setEditingMember(null);
        router.refresh();
      } else {
        const errorMessage =
          'error' in result && result.error
            ? result.error
            : 'errors' in result && result.errors
              ? 'Please fix the highlighted fields.'
              : 'An error occurred';
        toast.error(errorMessage);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteHouseholdMember(id);
      if (result.success) {
        toast.success('Member deleted successfully');
        router.refresh();
      } else {
        const errorMessage = result.error || 'Failed to delete member';
        toast.error(errorMessage);
      }
    } catch {
      toast.error('An unexpected error occurred');
    }
  };

  const getDefaultValues = (member: HouseholdMember): FormData => ({
    birthYear: member.birthYear ?? undefined,
    sex: member.sex ?? undefined,
    relationship: member.relationship,
    governanceRoles: member.governanceRoles,
    isResident: member.isResident,
  });

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-background/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="editorial-kicker">
              {editingMember ? 'Profile revision' : 'New household profile'}
            </p>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {editingMember ? `Update ${editingMember.displayLabel}` : 'Add a new member profile'}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Capture relationship, residency, governance roles, and optional birth year / sex for
                risk assessments. Names and contact are not collected on this screen.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleCancel} className="shrink-0">
            <ArrowLeft className="size-4" />
            Back to directory
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-4 border-b section-divider pb-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Governance-ready record</Badge>
              <Badge variant="secondary">Demographic structure</Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-3xl">
                {editingMember ? 'Refine the member profile' : 'Build the member profile'}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 sm:text-base">
                Your advisor sees labels like &quot;Member A&quot; plus structure only — not personal names or
                contact details.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <ProfileForm
              defaultValues={editingMember ? getDefaultValues(editingMember) : undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initialMembers.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="px-6 py-10 sm:px-8 sm:py-12">
          <div className="app-grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-secondary/85 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                  <Plus className="size-8" />
                </div>
                <div className="space-y-3">
                  <p className="editorial-kicker">Start the directory</p>
                  <h3 className="text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl">
                    No household members have been added yet.
                  </h3>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Begin with the people who shape decisions, inherit responsibilities, or need to
                    stay informed as your governance structure evolves.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Family relationships</Badge>
                <Badge variant="secondary">Governance roles</Badge>
                <Badge variant="info">Residency</Badge>
              </div>
              <Button onClick={handleAddMember} size="lg">
                <Plus className="size-4" />
                Add your first member
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">What to capture</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Relationship, residency, governance roles, and optional birth year / sex for the people who
                  matter in your family governance model.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">Why it matters</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This directory supports clearer succession planning, role mapping, and assessment
                  recommendations across the broader workspace.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="hero-surface flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Badge variant="outline">
              {initialMembers.length} {initialMembers.length === 1 ? 'member' : 'members'}
            </Badge>
            <Badge variant="secondary">{residentCount} in household</Badge>
            <Badge variant="info">{advisoryCount} with governance roles</Badge>
          </div>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            Keep profiles current as roles and residency change.
          </p>
        </div>
        <Button onClick={handleAddMember} size="lg" className="w-full sm:w-auto shrink-0">
          <Plus className="size-4" />
          Add member
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {initialMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onEdit={handleEditMember}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
