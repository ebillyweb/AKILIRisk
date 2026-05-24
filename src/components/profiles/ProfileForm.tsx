'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoleSelector } from './RoleSelector';
import {
  householdMemberSchema,
  HouseholdMemberFormData,
  RELATIONSHIP_LABELS,
  GOVERNANCE_ROLE_LABELS,
} from '@/lib/schemas/profile';

type GovernanceRole = keyof typeof GOVERNANCE_ROLE_LABELS;

const SEX_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
const SEX_LABELS: Record<(typeof SEX_OPTIONS)[number], string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

type FormData = HouseholdMemberFormData;

interface ProfileFormProps {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ProfileForm({ defaultValues, onSubmit, onCancel, isSubmitting }: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(householdMemberSchema),
    defaultValues: {
      birthYear: defaultValues?.birthYear,
      sex: defaultValues?.sex,
      relationship: defaultValues?.relationship || 'SPOUSE',
      governanceRoles: defaultValues?.governanceRoles || [],
      isResident: defaultValues?.isResident ?? true,
      shareWithAdvisor: defaultValues?.shareWithAdvisor ?? true,
    },
  });

  const relationships = Object.entries(RELATIONSHIP_LABELS);
  const fieldLabelClassName = 'text-sm font-semibold text-foreground';
  const fieldHintClassName = 'text-xs leading-5 text-muted-foreground';
  const errorClassName = 'text-sm text-destructive';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Required fields marked with *</Badge>
            <Badge variant="secondary">Used for governance planning</Badge>
          </div>
          <h3 className="text-xl font-semibold tracking-[-0.03em]">Household member</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Demographic structure only — no names or contact fields are stored (BRD §5.1 amendment).
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="birthYear" className={fieldLabelClassName}>
              Birth year
            </label>
            <p className={fieldHintClassName}>
              Optional. Used for age-banded risk context; leave blank if unknown.
            </p>
            <Input
              id="birthYear"
              type="number"
              {...register('birthYear', {
                setValueAs: (v) => {
                  if (v === '' || v === undefined || v === null) return undefined;
                  const n = Number(v);
                  return Number.isFinite(n) ? n : undefined;
                },
              })}
              placeholder="e.g. 1972"
              aria-invalid={!!errors.birthYear}
            />
            {errors.birthYear && <p className={errorClassName}>{errors.birthYear.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="sex" className={fieldLabelClassName}>
              Sex
            </label>
            <p className={fieldHintClassName}>Optional demographic field.</p>
            <Controller
              name="sex"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? '__none__'}
                  onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
                >
                  <SelectTrigger id="sex" aria-invalid={!!errors.sex}>
                    <SelectValue placeholder="Prefer not to specify" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Prefer not to specify</SelectItem>
                    {SEX_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SEX_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.sex && <p className={errorClassName}>{errors.sex.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="relationship" className={fieldLabelClassName}>
            Relationship *
          </label>
          <p className={fieldHintClassName}>
            Select how this person is connected to the household decision-makers.
          </p>
          <Controller
            name="relationship"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="relationship" aria-invalid={!!errors.relationship}>
                  <SelectValue placeholder="Choose relationship" />
                </SelectTrigger>
                <SelectContent>
                  {relationships.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.relationship && <p className={errorClassName}>{errors.relationship.message}</p>}
        </div>
      </section>

      <section className="space-y-5 rounded-[1.5rem] border border-border/70 bg-background/65 p-5 sm:p-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em]">Governance participation</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Document how this person participates in family leadership, advisory conversations, or
            future transition planning.
          </p>
        </div>

        <div className="space-y-2">
          <label className={fieldLabelClassName}>Residency</label>
          <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
            <input
              type="checkbox"
              {...register('isResident')}
              className="mt-1 size-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">Lives in household</span>
              <span className="block text-xs leading-5 text-muted-foreground">
                Checked for immediate household residents; uncheck for extended family.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <label className={fieldLabelClassName}>Advisor visibility</label>
          <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
            <input
              type="checkbox"
              {...register('shareWithAdvisor')}
              className="mt-1 size-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-foreground">
                Share with my advisor
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                When unchecked, this member is hidden from your advisor&apos;s portal and
                reports. Your assessment can still use this profile locally.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <label className={fieldLabelClassName}>Governance roles</label>
          <p className={fieldHintClassName}>
            Select every role that currently applies. You can update these as responsibilities evolve.
          </p>
          <Controller
            name="governanceRoles"
            control={control}
            render={({ field }) => (
              <RoleSelector
                value={field.value as GovernanceRole[]}
                onChange={(roles: GovernanceRole[]) => field.onChange(roles)}
              />
            )}
          />
          {errors.governanceRoles && (
            <p className={errorClassName}>{errors.governanceRoles.message}</p>
          )}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t section-divider pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? 'Saving...' : defaultValues ? 'Update Member' : 'Add Member'}
        </Button>
      </div>
    </form>
  );
}
