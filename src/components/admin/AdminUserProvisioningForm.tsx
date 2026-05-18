"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, UserPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { createAdminUser } from "@/lib/actions/admin-user-provisioning";

const CreateAdminUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  role: z.enum(["ADMIN", "SUPER_ADMIN"], {
    message: "Please select a role"
  }),
  sendInvitation: z.boolean(),
});

type CreateAdminUserFormData = z.infer<typeof CreateAdminUserSchema>;

interface AdminUserProvisioningFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AdminUserProvisioningForm({
  onSuccess,
  onCancel,
}: AdminUserProvisioningFormProps) {
  const _router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    tempPassword?: string;
  } | null>(null);

  const form = useForm<CreateAdminUserFormData>({
    resolver: zodResolver(CreateAdminUserSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "ADMIN",
      sendInvitation: true,
    },
  });

  const onSubmit = async (data: CreateAdminUserFormData) => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await createAdminUser(data);

      if (response.success) {
        const invitationSent = response.data?.invitationSent;
        const invitationError = response.data?.invitationError;
        let message = "Admin user created successfully!";
        if (data.sendInvitation && invitationSent) {
          message += " Invitation email sent.";
        } else if (data.sendInvitation && invitationError) {
          message += ` Invitation email failed: ${invitationError} Share the temporary password below securely.`;
        } else if (!data.sendInvitation) {
          message += " Please share the temporary password securely.";
        }
        setResult({
          type: invitationError ? "error" : "success",
          message,
          tempPassword: response.data?.tempPassword,
        });

        form.reset();
        onSuccess?.();
      } else {
        setResult({
          type: "error",
          message: response.error || "Unknown error occurred",
        });
      }
    } catch {
      setResult({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const _roleValue = form.watch("role");
  const sendInvitationValue = form.watch("sendInvitation");

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" />
          Create Admin User
        </CardTitle>
        <CardDescription>
          Provision a new administrator account with platform access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {result && (
          <div className={`rounded-lg border p-4 ${
            result.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            <div className="flex items-start gap-2">
              {result.type === "success" ? (
                <Check className="size-5 mt-0.5 shrink-0" />
              ) : (
                <X className="size-5 mt-0.5 shrink-0" />
              )}
              <div className="space-y-2">
                <p className="font-medium">{result.message}</p>
                {result.tempPassword && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>Temporary Password:</strong>
                    </p>
                    <code className="block bg-white p-2 rounded border text-gray-900 font-mono text-sm">
                      {result.tempPassword}
                    </code>
                    <p className="text-xs opacity-80">
                      Please share this password securely. It will expire in 48 hours.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@company.com"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be the login email for the new admin user.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Smith"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for the admin user.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Administrator Role</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border border-border rounded-lg p-4">
                        <RadioGroupItem value="ADMIN" id="admin-role" />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor="admin-role"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Standard Administrator
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Can manage users, assessments, and platform configuration.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 border border-border rounded-lg p-4">
                        <RadioGroupItem value="SUPER_ADMIN" id="super-admin-role" />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor="super-admin-role"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Super Administrator
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Full platform access including admin user provisioning.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="sendInvitation"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-medium">
                        Send invitation email
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {sendInvitationValue
                          ? "An email with login credentials will be sent to the admin user."
                          : "You will need to share the temporary password manually."
                        }
                      </FormDescription>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Creating Admin User...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4 mr-2" />
                    Create Admin User
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}