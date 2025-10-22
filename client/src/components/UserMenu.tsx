import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogOut, Users, Settings, BarChart3 } from "lucide-react";

export function UserMenu() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const initials = user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none" data-testid="text-username">
              {user.username}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                variant={user.role === "admin" ? "default" : "secondary"}
                className="capitalize text-xs"
                data-testid="badge-user-role"
              >
                {user.role}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLocation("/statistics")}
          data-testid="button-nav-statistics"
          className="cursor-pointer"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>Statistics</span>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <>
            <DropdownMenuItem
              onClick={() => setLocation("/settings")}
              data-testid="button-nav-settings"
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocation("/users")}
              data-testid="button-nav-users"
              className="cursor-pointer"
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Manage Users</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
          className="cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
