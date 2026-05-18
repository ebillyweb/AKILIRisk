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
import { deactivateAdminUser } from "@/lib/actions/admin-user-provisioning";

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
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

  const handleDeactivateUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}? This action cannot be undone.`)) {
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
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminUsers.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isDeactivatingThis = isDeactivating === user.id;

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

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={isDeactivatingThis}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>

                        {!user.isVerified && (
                          <DropdownMenuItem disabled>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend Invitation
                          </DropdownMenuItem>
                        )}

                        {!isCurrentUser && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeactivateUser(user.id, user.name || user.email || "this user")}
                              disabled={isDeactivatingThis}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              {isDeactivatingThis ? "Deactivating..." : "Deactivate"}
                            </DropdownMenuItem>
                          </>
                        )}

                        {isCurrentUser && (
                          <DropdownMenuItem disabled className="text-muted-foreground">
                            <UserX className="mr-2 h-4 w-4" />
                            Cannot deactivate yourself
                          </DropdownMenuItem>
                        )}
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
  );
}