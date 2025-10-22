import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  Download, 
  TrendingUp,
  Users,
  Activity
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface Statistics {
  totals: {
    conversations: number;
    messages: number;
    incoming: number;
    outgoing: number;
  };
  topConversations: Array<{
    phone: string;
    displayName: string | null;
    messageCount: number;
  }>;
  messagesByDay: Array<{
    date: string;
    incoming: number;
    outgoing: number;
  }>;
  recentActivity: Array<{
    id: string;
    direction: string;
    body: string | null;
    createdAt: string;
    phone: string;
    displayName: string | null;
  }>;
}

export default function Statistics() {
  const { data: stats, isLoading } = useQuery<Statistics>({
    queryKey: ["/api/statistics"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">Failed to load statistics</div>
      </div>
    );
  }

  // Format data for charts
  const activityData = stats.messagesByDay.map(day => ({
    date: format(new Date(day.date), 'MMM dd'),
    Incoming: day.incoming,
    Outgoing: day.outgoing,
    Total: day.incoming + day.outgoing,
  }));

  const topConversationsData = stats.topConversations.map(conv => ({
    name: conv.displayName || conv.phone,
    messages: conv.messageCount,
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Statistics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Overview of messaging activity and engagement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        <Separator />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-conversations">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totals.conversations}</div>
              <p className="text-xs text-muted-foreground">
                Active chat conversations
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-messages">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totals.messages}</div>
              <p className="text-xs text-muted-foreground">
                All time messages
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-incoming-messages">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incoming Messages</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totals.incoming}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totals.messages > 0 
                  ? `${Math.round((stats.totals.incoming / stats.totals.messages) * 100)}% of total`
                  : '0% of total'}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-outgoing-messages">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outgoing Messages</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totals.outgoing}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totals.messages > 0 
                  ? `${Math.round((stats.totals.outgoing / stats.totals.messages) * 100)}% of total`
                  : '0% of total'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-activity-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Message Activity (Last 7 Days)
              </CardTitle>
              <CardDescription>
                Daily message volume by direction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Incoming" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="Outgoing" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for the last 7 days
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-top-conversations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Most Active Conversations
              </CardTitle>
              <CardDescription>
                Top 5 conversations by message count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topConversationsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topConversationsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="messages" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No conversations found
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest 10 messages across all conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className={`mt-1 p-2 rounded-full ${
                      activity.direction === 'in' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-chart-2/10 text-chart-2'
                    }`}>
                      {activity.direction === 'in' ? (
                        <Download className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {activity.displayName || activity.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.createdAt), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {activity.body || '(Media message)'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
