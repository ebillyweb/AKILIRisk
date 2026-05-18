"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUserProvisioningForm } from "./AdminUserProvisioningForm";
import { AdminUserManagementList } from "./AdminUserManagementList";
import { getAdminUsers } from "@/lib/actions/admin-user-provisioning";

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function AdminUserManagement() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("users");

  const loadAdminUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await getAdminUsers();

      if (result.success) {
        setAdminUsers(result.data || []);
      } else {
        setError(result.error || "Unknown error occurred");
      }
    } catch {
      setError("Failed to load admin users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminUsers();

    // Get current user ID from session (you may need to adjust this based on your auth setup)
    // For now, we'll leave it empty and handle it in the component
    setCurrentUserId("");
  }, []);

  const handleUserCreated = () => {
    loadAdminUsers();
    setActiveTab("users");
  };

  const handleUserUpdated = () => {
    loadAdminUsers();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Error Loading Data</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadAdminUsers} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="users">Admin Users ({adminUsers.length})</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
          </TabsList>

          <Button
            onClick={() => setActiveTab("create")}
            className="ml-4"
            size="sm"
          >
            <Plus className="size-4 mr-2" />
            Create Admin User
          </Button>
        </div>

        <TabsContent value="users" className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-[200px] bg-muted/30 rounded-lg animate-pulse" />
              <div className="h-[300px] bg-muted/30 rounded-lg animate-pulse" />
            </div>
          ) : (
            <AdminUserManagementList
              adminUsers={adminUsers}
              currentUserId={currentUserId}
              onUserUpdated={handleUserUpdated}
            />
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <div className="flex justify-center">
            <AdminUserProvisioningForm
              onSuccess={handleUserCreated}
              onCancel={() => setActiveTab("users")}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}