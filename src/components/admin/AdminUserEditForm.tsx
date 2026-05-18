"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateAdminUser } from "@/lib/actions/admin-user-provisioning";

const EditAdminUserSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  role: z.enum(["ADMIN", "SUPER_ADMIN"], {
    message: "Please select a role",
  }),
});

type EditAdminUserFormData = z.infer<typeof EditAdminUserSchema>;

export interface AdminUserEditTarget {
  id: string;
  email: string | null;
  name: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
}

interface AdminUserEditFormProps {
  user: AdminUserEditTarget;
  isCurrentUser: boolean;
  onSuccess?: () => void;
  onCancel: () => void;
}

export function AdminUserEditForm({
  user,
  isCurrentUser,
  onSuccess,
  onCancel,
}: AdminUserEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditAdminUserFormData>({
    resolver: zodResolver(EditAdminUserSchema),
    defaultValues: {
      name: user.name ?? "",
      role: user.role,
    },
  });

  useEffect(() => {
    form.reset({
      name: user.name ?? "",
      role: user.role,
    });
    setError(null);
  }, [user, form]);

  const onSubmit = async (data: EditAdminUserFormData) => {
    setIsSubmitting(true);
    setError(null);

    const unchanged =
      data.name === (user.name ?? "") && data.role === user.role;
    if (unchanged) {
      setError("No changes to save");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await updateAdminUser({
        id: user.id,
        name: data.name,
        role: data.role,
      });

      if (response.success) {
        onSuccess?.();
        onCancel();
      } else {
        setError(response.error || "Failed to update admin user");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pencil className="size-5" />
              Edit Administrator
            </CardTitle>
            <CardDescription>
              Update display name and role for {user.email ?? "this user"}.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close edit form"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input value={user.email ?? ""} disabled readOnly />
              </FormControl>
              <FormDescription>
                Login email cannot be changed here.
              </FormDescription>
            </FormItem>

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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Administrator Role</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                      className="grid grid-cols-1 gap-3 md:grid-cols-2"
                    >
                      <div className="flex items-center space-x-2 rounded-lg border border-border p-4">
                        <RadioGroupItem value="ADMIN" id={`edit-admin-${user.id}`} />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor={`edit-admin-${user.id}`}>
                            Standard Administrator
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Platform admin without user-provisioning access.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 rounded-lg border border-border p-4">
                        <RadioGroupItem
                          value="SUPER_ADMIN"
                          id={`edit-super-${user.id}`}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor={`edit-super-${user.id}`}>
                            Super Administrator
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Full access including admin user management.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  {isCurrentUser && field.value === "ADMIN" ? (
                    <FormDescription className="text-amber-700">
                      Demoting yourself removes super-admin access. Ensure another
                      super admin exists first.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
