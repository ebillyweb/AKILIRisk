"use client";

import { useState, useTransition } from "react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  demotePlatformStaffToClientBySuperAdmin,
  promoteClientUserToAdminStaffBySuperAdmin,
  restorePlatformStaffBySuperAdmin,
  setPlatformStaffRoleBySuperAdmin,
  softDeletePlatformStaffBySuperAdmin,
} from "@/lib/admin/staff-actions";

export type PlatformStaffRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  deletedAt: Date | string | null;
  createdAt: Date | string;
};

type Props = {
  staff: PlatformStaffRow[];
  canMutate: boolean;
};

function confirmDanger(message: string) {
  if (typeof window === "undefined") return false;
  return window.confirm(message);
}

export function AdminPlatformStaffTable({ staff, canMutate }: Props) {
  const [isPending, startTransition] = useTransition();
  const [promoteEmail, setPromoteEmail] = useState("");

  return (
    <div className="space-y-8">
      {canMutate ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">Add admin (promote client)</p>
          <p className="text-xs text-muted-foreground">
            Email of an active client account (USER role). Ensure the person can sign in as staff
            (password / MFA) after promotion.
          </p>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="promote-email">Email</Label>
              <Input
                id="promote-email"
                type="email"
                autoComplete="off"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <Button
              type="button"
              disabled={isPending || !promoteEmail.trim()}
              onClick={() => {
                startTransition(async () => {
                  const res = await promoteClientUserToAdminStaffBySuperAdmin({
                    email: promoteEmail.trim(),
                  });
                  if (!res.success) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("User promoted to ADMIN.");
                  setPromoteEmail("");
                });
              }}
            >
              Promote to admin
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Super admins can promote client accounts, change staff roles, demote to client, and deactivate
          platform staff.
        </p>
      )}

      <ul className="divide-y divide-border">
        {staff.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">No platform staff found.</li>
        ) : (
          staff.map((row) => {
            const isOff = Boolean(row.deletedAt);
            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.name ?? row.email}</p>
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs uppercase">
                      {row.role}
                    </Badge>
                    {isOff ? (
                      <Badge variant="outline" className="text-xs">
                        Deactivated
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {canMutate ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {isOff ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await restorePlatformStaffBySuperAdmin({ userId: row.id });
                            if (!res.success) toast.error(res.error);
                            else toast.success("Account restored.");
                          })
                        }
                      >
                        Restore
                      </Button>
                    ) : (
                      <>
                        <StaffRoleControl
                          key={`${row.id}-${row.role}`}
                          userId={row.id}
                          role={row.role}
                          disabled={isPending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirmDanger("Demote this account to a client (USER)?")) return;
                            startTransition(async () => {
                              const res = await demotePlatformStaffToClientBySuperAdmin({
                                userId: row.id,
                              });
                              if (!res.success) toast.error(res.error);
                              else toast.success("Staff demoted to client.");
                            });
                          }}
                        >
                          Demote to client
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirmDanger("Deactivate this staff account?")) return;
                            startTransition(async () => {
                              const res = await softDeletePlatformStaffBySuperAdmin({ userId: row.id });
                              if (!res.success) toast.error(res.error);
                              else toast.success("Staff deactivated.");
                            });
                          }}
                        >
                          Deactivate
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function StaffRoleControl({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled: boolean;
}) {
  const initial: "ADMIN" | "SUPER_ADMIN" = role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
  const [value, setValue] = useState<"ADMIN" | "SUPER_ADMIN">(initial);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => setValue(v as "ADMIN" | "SUPER_ADMIN")}
        disabled={disabled || pending}
      >
        <SelectTrigger className="h-9 w-[11.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="SUPER_ADMIN">Super admin</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={disabled || pending || value === role}
        onClick={() =>
          startTransition(async () => {
            const res = await setPlatformStaffRoleBySuperAdmin({ userId, newRole: value });
            if (!res.success) toast.error(res.error);
            else toast.success("Role updated.");
          })
        }
      >
        Apply
      </Button>
    </div>
  );
}
