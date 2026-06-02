import { useAuth } from "@/lib/auth";
import {
  useListLeads,
  useListDiscountRequests,
  useApproveDiscountRequest,
  useRejectDiscountRequest,
  useGetAnalyticsSummary,
  useListUsers,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  Trophy, TrendingUp, Users, CheckCircle2, XCircle, AlertCircle,
  ArrowUpRight, BarChart3, Target, Clock, DollarSign
} from "lucide-react";
import { useState } from "react";

export default function SalesManagerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: leads } = useListLeads();
  const { data: discountRequests } = useListDiscountRequests({ status: "pending" });
  const { data: users } = useListUsers({ role: "cashier" });
  const { data: summary } = useGetAnalyticsSummary({ period: "month" });

  const approve = useApproveDiscountRequest();
  const reject = useRejectDiscountRequest();

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync({ id });
      toast({ title: "Discount approved" });
      qc.invalidateQueries({ queryKey: ["listDiscountRequests"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    try {
      await reject.mutateAsync({ id: rejectDialog, data: { rejectionReason: rejectReason } });
      toast({ title: "Discount rejected" });
      setRejectDialog(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["listDiscountRequests"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Leaderboard: rank cashiers by their closed leads
  const cashierStats = users?.map(u => {
    const userLeads = leads?.filter(l => l.assignedTo === u.id) ?? [];
    const closed = userLeads.filter(l => l.status === "closed").length;
    const total = userLeads.length;
    const value = userLeads
      .filter(l => l.status === "closed")
      .reduce((s, l) => s + (parseFloat(l.estimatedValue || "0") || 0), 0);
    return {
      id: u.id,
      name: u.username,
      totalLeads: total,
      closedLeads: closed,
      conversionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
      revenue: value,
    };
  }).sort((a, b) => b.revenue - a.revenue) ?? [];

  const totalPending = discountRequests?.length ?? 0;
  const totalRevenue = parseFloat((summary as any)?.totalRevenue ?? "0");
  const totalTransactions = (summary as any)?.totalTransactions ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sales Manager</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Team performance, approvals, and revenue analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold mt-1">{totalTransactions}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg. Order</p>
                <p className="text-2xl font-bold mt-1">
                  {totalTransactions > 0 ? formatCurrency(totalRevenue / totalTransactions) : "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold mt-1">{totalPending}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Team Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cashierStats.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No sales reps yet</p>
              )}
              {cashierStats.map((rep, i) => (
                <div key={rep.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? "bg-amber-100 text-amber-700" :
                    i === 1 ? "bg-slate-100 text-slate-700" :
                    i === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{rep.name}</span>
                      <span className="font-semibold text-sm text-teal-600">{formatCurrency(rep.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />{rep.closedLeads} closed
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />{rep.totalLeads} total
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />{rep.conversionRate}% conv.
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Discount Approval Queue
              {totalPending > 0 && (
                <Badge variant="destructive" className="text-[10px]">{totalPending}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {discountRequests?.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-4">No pending approvals</p>
              )}
              {discountRequests?.map(req => (
                <div key={req.id} className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm">{req.customerName || "Unknown customer"}</span>
                      <div className="text-xs text-muted-foreground">
                        Requested: {formatCurrency(parseFloat(req.requestedAmount || "0"))}
                        {" / "}Original: {formatCurrency(parseFloat(req.originalAmount || "0"))}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">pending</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{req.reason}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleApprove(req.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejectDialog(req.id)}>
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Discount Request</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Reason</Label>
            <Input
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting this?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
