import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { type User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User as UserIcon,
  Users,
  Lock,
} from "lucide-react";

interface CreateUserForm {
  username: string;
  password: string;
  role: "user" | "admin";
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<CreateUserForm>({
    username: "",
    password: "",
    role: "user",
  });

  const [editingUser, setEditingUser] = useState<Omit<User, "password"> | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: "",
    role: "user" as "user" | "admin",
  });

  const [deletingUser, setDeletingUser] = useState<Omit<User, "password"> | null>(null);

  const {
    data: users = [],
    isLoading,
  } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/admin/users"],
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.username.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => user.role === "admin").length;
    const regular = total - admins;
    return { total, admins, regular };
  }, [users]);

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserForm) => {
      const res = await apiRequest("POST", "/api/admin/users", payload);
      return res.json();
    },
    onSuccess: (createdUser: Omit<User, "password">) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setFormData({ username: "", password: "", role: "user" });
      toast({
        title: "User created",
        description: `User "${createdUser.username}" has been created successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create user",
        description: error.message,
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { username: string; role: string };
    }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedUser: Omit<User, "password">) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({
        title: "User updated",
        description: `User "${updatedUser.username}" has been updated successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update user",
        description: error.message,
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeletingUser(null);
      toast({
        title: "User deleted",
        description: "User has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete user",
        description: error.message,
      });
    },
  });

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUserMutation.mutate(formData);
  };

  const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    updateUserMutation.mutate({
      id: editingUser.id,
      data: editFormData,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">User management</h1>
              <p className="text-sm text-muted-foreground">
                Invite teammates, promote admins, and revoke access.
              </p>
            </div>
          </div>
          <div className="flex gap-2 text-xs sm:text-sm">
            <Badge variant="secondary" className="gap-1 px-3 py-1">
              <Users className="h-3.5 w-3.5" />
              {stats.total} total
            </Badge>
            <Badge variant="outline" className="gap-1 px-3 py-1">
              <Shield className="h-3.5 w-3.5" />
              {stats.admins} admins
            </Badge>
            <Badge variant="outline" className="gap-1 px-3 py-1">
              <UserIcon className="h-3.5 w-3.5" />
              {stats.regular} users
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Team directory</CardTitle>
                <CardDescription>Search, edit, or remove existing accounts.</CardDescription>
              </div>
              <div className="w-full max-w-xs">
                <Label htmlFor="search" className="sr-only">
                  Search users
                </Label>
                <Input
                  id="search"
                  placeholder="Search by username or role"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[460px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead className="hidden md:table-cell">Role</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium capitalize">
                            {user.username}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge
                              variant={user.role === "admin" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(user.createdAt ?? "").toLocaleString()}
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-edit-${user.id}`}
                              onClick={() => {
                                setEditingUser(user);
                                setEditFormData({
                                  username: user.username,
                                  role: user.role as "user" | "admin",
                                });
                              }}
                              aria-label={`Edit ${user.username}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-${user.id}`}
                              onClick={() => setDeletingUser(user)}
                              disabled={currentUser?.id === user.id}
                              aria-label={`Delete ${user.username}`}
                              className={currentUser?.id === user.id ? "text-muted-foreground" : "text-destructive"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Invite new teammate
              </CardTitle>
              <CardDescription>
                Create an account and choose their role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      autoComplete="off"
                      minLength={3}
                      maxLength={50}
                      placeholder="jane.doe"
                      value={formData.username}
                      onChange={(event) => setFormData({
                        ...formData,
                        username: event.target.value,
                      })}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Between 3 and 50 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Temporary password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      minLength={6}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(event) => setFormData({
                        ...formData,
                        password: event.target.value,
                      })}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "user" | "admin") =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Standard user</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent data-testid="dialog-edit-user">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>
                Update username or role. Password changes are not supported from here.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editFormData.username}
                onChange={(event) =>
                  setEditFormData({ ...editFormData, username: event.target.value })
                }
                minLength={3}
                maxLength={50}
                required
                data-testid="input-edit-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value: "user" | "admin") =>
                  setEditFormData({ ...editFormData, role: value })
                }
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Standard user</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                data-testid="button-edit-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-edit-save">
                {updateUserMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The user will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
