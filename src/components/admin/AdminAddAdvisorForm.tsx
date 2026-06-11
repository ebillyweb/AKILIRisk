"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdvisorByAdmin, type CreateAdvisorInput } from "@/lib/admin/actions";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  passwordComplexitySchema,
} from "@/lib/auth/password-policy";

const formSchema = z
  .object({
    email: z.string().email("Invalid email").max(255),
    password: passwordComplexitySchema.max(100),
    confirmPassword: z.string(),
    name: z.string().min(1, "Name is required").max(200).optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    firmName: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    jobTitle: z.string().max(200).optional(),
    licenseNumber: z.string().max(100).optional(),
    bio: z.string().max(2000).optional(),
    specializationsStr: z.string().max(500).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export function AdminAddAdvisorForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      firstName: "",
      lastName: "",
      firmName: "",
      phone: "",
      jobTitle: "",
      licenseNumber: "",
      bio: "",
      specializationsStr: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const specializations = data.specializationsStr
        ? data.specializationsStr.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const payload: CreateAdvisorInput = {
        email: data.email,
        password: data.password,
        name: data.name || undefined,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        firmName: data.firmName || undefined,
        phone: data.phone || undefined,
        jobTitle: data.jobTitle || undefined,
        licenseNumber: data.licenseNumber || undefined,
        bio: data.bio || undefined,
        specializations: specializations.length ? specializations : undefined,
      };
      const result = await createAdvisorByAdmin(payload);
      if (result.success) {
        toast.success("Advisor created");
        router.push("/admin/advisors");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to create advisor");
      }
    } catch {
      toast.error("Failed to create advisor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {PASSWORD_REQUIREMENTS_MESSAGE}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password *</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register("firstName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advisor profile (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm name</Label>
              <Input id="firmName" {...register("firmName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" {...register("jobTitle")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">License number</Label>
              <Input id="licenseNumber" {...register("licenseNumber")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specializationsStr">Specializations (comma-separated)</Label>
            <Input
              id="specializationsStr"
              placeholder="e.g. financial-planning, risk-assessment"
              {...register("specializationsStr")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} {...register("bio")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create advisor"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/advisors">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
