"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserX,
  Edit,
  Mail,
  CheckCircle,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deactivateAdminUser,
  promoteAdminUserToSuperAdmin,
  resendAdminInvitation,
} from "@/lib/actions/admin-user-provisioning";
import {
  AdminUserEditForm,
  type AdminUserEditTarget,
} from "@/components/admin/AdminUserEditForm";

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

interface AdminUserManagementListProps {
  adminUsers: AdminUser[];
  currentUserId: string;
  onUserUpdated?: () => void;
}

export function AdminUserManagementList({
  adminUsers,
  currentUserId,
  onUserUpdated,
}: AdminUserManagementListProps) {
  const [isDeactivating, setIsDeactivating] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserEditTarget | null>(
    null
  );

  const handleResendInvitation = async (
    userId: string,
    userName: string,
    email: string | null
  ) => {
    const label = userName || email || "this user";
    if (
      !confirm(
        `Resend invitation to ${label}? A new temporary password will be emailed and any previous password will stop working.`
      )
    ) {
      return;
    }

    setIsResending(userId);

    try {
      const result = await resendAdminInvitation(userId);

      if (result.success) {
        alert(`Invitation email sent to ${email ?? label}.`);
        onUserUpdated?.();
      } else if (result.data?.tempPassword) {
        alert(
          `${result.error}\n\nTemporary password (share securely):\n${result.data.tempPassword}`
        );
        onUserUpdated?.();
      } else {
        alert(`Failed to resend invitation: ${result.error}`);
      }
    } catch {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsResending(null);
    }
  };

  const handlePromoteToSuperAdmin = async (
    userId: string,
    userName: string,
    email: string | null
  ) => {
    const label = userName || email || "this user";
    if (
      !confirm(
        `Promote ${label} to Super Admin? They will have full platform administration access.`
      )
    ) {
      return;
    }

    setIsPromoting(userId);

    try {
      const result = await promoteAdminUserToSuperAdmin(userId);

      if (result.success) {
        onUserUpdated?.();
      } else {
        alert(`Failed to promote user: ${result.error}`);
      }
    } catch {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsPromoting(null);
    }
  };

  const handleDeactivateUser = async (userId: string, userName: string) => {
    const isCurrentUser = userId === currentUserId;
    const message = isCurrentUser
      ? `Are you sure you want to deactivate your own account (${userName})? You will lose admin access and this action cannot be undone.`
      : `Are you sure you want to deactivate ${userName}? This action cannot be undone.`;

    if (!confirm(message)) {
      return;
    }

    setIsDeactivating(userId);

    try {
      const result = await deactivateAdminUser(userId);

      if (result.success) {
        onUserUpdated?.();
      } else {
        alert(`Failed to deactivate user: ${result.error}`);
      }
    } catch {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeactivating(null);
    }
  };

  const getRoleBadge = (role: "ADMIN" | "SUPER_ADMIN") => {
    if (role === "SUPER_ADMIN") {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <ShieldCheck className="size-3" />
          Super Admin
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Shield className="size-3" />
        Admin
      </Badge>
    );
  };

  const getVerificationStatus = (isVerified: boolean) => {
    if (isVerified) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="size-4" />
          <span className="text-sm">Verified</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-amber-600">
        <Clock className="size-4" />
        <span className="text-sm">Pending</span>
      </div>
    );
  };

  const activeSuperAdminCount = adminUsers.filter(
    (u) => u.role === "SUPER_ADMIN"
  ).length;

  const canDeactivateUser = (user: AdminUser) =>
    user.role !== "SUPER_ADMIN" || activeSuperAdminCount > 1;

  if (adminUsers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Admin Users</h3>
          <p className="text-muted-foreground text-center max-w-md">
            No administrator accounts have been created yet. Use the form above to provision your first admin user.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {editingUser ? (
        <AdminUserEditForm
          user={editingUser}
          isCurrentUser={editingUser.id === currentUserId}
          onSuccess={() => {
            onUserUpdated?.();
            setEditingUser(null);
          }}
          onCancel={() => setEditingUser(null)}
        />
      ) : null}

    <Card>
      <CardHeader>
        <CardTitle>Administrator Accounts</CardTitle>
        <CardDescription>
          Manage platform administrator accounts and permissions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name & Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminUsers.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isDeactivatingThis = isDeactivating === user.id;
              const isResendingThis = isResending === user.id;
              const isPromotingThis = isPromoting === user.id;
              const isEditingThis = editingUser?.id === user.id;
              const isRowBusy =
                isDeactivatingThis ||
                isResendingThis ||
                isPromotingThis ||
                isEditingThis;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.name || "Unnamed User"}
                        </span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="size-3" />
                        {user.email || "No email"}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {getRoleBadge(user.role)}
                  </TableCell>

                  <TableCell>
                    {getVerificationStatus(user.isVerified)}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt
                      ? formatDistanceToNow(new Date(user.lastLoginAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={isRowBusy}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setEditingUser({
                              id: user.id,
                              email: user.email,
                              name: user.name,
                              role: user.role,
                            })
                          }
                          disabled={isRowBusy}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {isEditingThis ? "Editing..." : "Edit User"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() =>
                            handleResendInvitation(
                              user.id,
                              user.name || "",
                              user.email
                            )
                          }
                          disabled={isRowBusy}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {isResendingThis ? "Sending..." : "Resend Invitation"}
                        </DropdownMenuItem>

                        {user.role === "ADMIN" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              handlePromoteToSuperAdmin(
                                user.id,
                                user.name || "",
                                user.email
                              )
                            }
                            disabled={isRowBusy}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {isPromotingThis
                              ? "Promoting..."
                              : "Promote to Super Admin"}
                          </DropdownMenuItem>
                        ) : null}

                        {canDeactivateUser(user) ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                handleDeactivateUser(
                                  user.id,
                                  user.name || user.email || "this user"
                                )
                              }
                              disabled={isRowBusy}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              {isDeactivatingThis ? "Deactivating..." : "Deactivate"}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}