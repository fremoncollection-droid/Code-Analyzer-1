import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useGetPipelineSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  Target, Phone, Mail, UserCheck, Plus, Trash2, CheckCircle2,
  Circle, Calendar, Clock, PhoneCall, MapPin, ArrowRight,
  AlertCircle, Filter, Search
} from "lucide-react";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-amber-100 text-amber-700 border-amber-200",
  qualified: "bg-teal-100 text-teal-700 border-teal-200",
  proposal: "bg-purple-100 text-purple-700 border-purple-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-red-100 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  closed: "Closed Won",
  lost: "Closed Lost",
};

export default function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("leads");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isManager = user?.role === "manager" || user?.role === "admin";

  const { data: leads } = useListLeads({ status: statusFilter || undefined });
  const { data: tasks } = useListTasks({ date: new Date().toISOString().split("T")[0] });
  const { data: pipelineSummary } = useGetPipelineSummary();

  const filteredLeads = leads?.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.name?.toLowerCase().includes(s) ||
      l.phone?.toLowerCase().includes(s) ||
      l.email?.toLowerCase().includes(s)
    );
  });

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [leadDialog, setLeadDialog] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: "", phone: "", email: "", status: "new", notes: "", estimatedValue: "",
  });
  const [leadEditing, setLeadEditing] = useState<string | null>(null);

  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", type: "call", dueDate: "", priority: "medium",
  });
  const [taskEditing, setTaskEditing] = useState<string | null>(null);

  const handleSaveLead = async () => {
    if (!leadForm.name) return;
    try {
      if (leadEditing) {
        await updateLead.mutateAsync({ id: leadEditing, data: leadForm });
        toast({ title: "Lead updated" });
      } else {
        await createLead.mutateAsync({ data: leadForm });
        toast({ title: "Lead created" });
      }
      setLeadDialog(false);
      setLeadForm({ name: "", phone: "", email: "", status: "new", notes: "", estimatedValue: "" });
      setLeadEditing(null);
      qc.invalidateQueries({ queryKey: ["listLeads"] });
      qc.invalidateQueries({ queryKey: ["getPipelineSummary"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteLead.mutateAsync({ id });
      toast({ title: "Lead deleted" });
      qc.invalidateQueries({ queryKey: ["listLeads"] });
      qc.invalidateQueries({ queryKey: ["getPipelineSummary"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !taskForm.dueDate) return;
    try {
      if (taskEditing) {
        await updateTask.mutateAsync({ id: taskEditing, data: taskForm });
        toast({ title: "Task updated" });
      } else {
        await createTask.mutateAsync({ data: taskForm });
        toast({ title: "Task created" });
      }
      setTaskDialog(false);
      setTaskForm({ title: "", description: "", type: "call", dueDate: "", priority: "medium" });
      setTaskEditing(null);
      qc.invalidateQueries({ queryKey: ["listTasks"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleTask = async (task: any) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: { completed: !task.completed },
      });
      qc.invalidateQueries({ queryKey: ["listTasks"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask.mutateAsync({ id });
      toast({ title: "Task deleted" });
      qc.invalidateQueries({ queryKey: ["listTasks"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openEditLead = (lead: any) => {
    setLeadForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      status: lead.status || "new",
      notes: lead.notes || "",
      estimatedValue: lead.estimatedValue || "",
    });
    setLeadEditing(lead.id);
    setLeadDialog(true);
  };

  const openEditTask = (task: any) => {
    const date = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "";
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      type: task.type || "call",
      dueDate: date,
      priority: task.priority || "medium",
    });
    setTaskEditing(task.id);
    setTaskDialog(true);
  };

  const totalEst = filteredLeads?.reduce((s, l) => s + (parseFloat(l.estimatedValue || "0") || 0), 0) || 0;
  const wonCount = filteredLeads?.filter(l => l.status === "closed").length ?? 0;
  const lostCount = filteredLeads?.filter(l => l.status === "lost").length ?? 0;
  const activeCount = filteredLeads?.filter(l => l.status !== "closed" && l.status !== "lost").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Leads & Sales</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isManager ? "Team leads and sales pipeline" : "Manage your leads and daily tasks"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Leads</p>
                <p className="text-2xl font-bold mt-1">{activeCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Est. Value</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalEst)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Closed Won</p>
                <p className="text-2xl font-bold mt-1">{wonCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-teal-50">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Today's Tasks</p>
                <p className="text-2xl font-bold mt-1">{tasks?.filter(t => !t.completed).length ?? 0}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-teal-600" />
            Sales Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {pipelineSummary && pipelineSummary.length > 0 ? (
              pipelineSummary.map((stage: any) => (
                <div key={stage.status} className="flex flex-col items-center gap-1 min-w-[100px]">
                  <div className={`px-3 py-2 rounded-lg border text-sm font-medium text-center w-full ${statusColors[stage.status] || "bg-muted"}`}>
                    <div className="text-lg font-bold">{stage.count}</div>
                    <div className="text-xs">{statusLabels[stage.status] || stage.status}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No pipeline data yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">My Leads</TabsTrigger>
          <TabsTrigger value="tasks">Daily Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => {
              setLeadForm({ name: "", phone: "", email: "", status: "new", notes: "", estimatedValue: "" });
              setLeadEditing(null);
              setLeadDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Lead
            </Button>
          </div>

          <div className="space-y-2">
            {filteredLeads?.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No leads found</p>
            )}
            {filteredLeads?.map(lead => (
              <div key={lead.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{lead.name}</span>
                    <Badge variant="outline" className={statusColors[lead.status || "new"] || ""}>
                      {statusLabels[lead.status || "new"]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.estimatedValue && <span className="font-medium text-teal-600">{formatCurrency(parseFloat(lead.estimatedValue))}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditLead(lead)}>
                    <AlertCircle className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteLead(lead.id)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{tasks?.filter(t => !t.completed).length} pending tasks</p>
            <Button onClick={() => {
              const now = new Date();
              const iso = now.toISOString().slice(0, 16);
              setTaskForm({ title: "", description: "", type: "call", dueDate: iso, priority: "medium" });
              setTaskEditing(null);
              setTaskDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
          <div className="space-y-2">
            {tasks?.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No tasks for today</p>
            )}
            {tasks?.map(task => (
              <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${task.completed ? "bg-muted/50 border-muted" : "bg-card border-border"}`}>
                <button onClick={() => handleToggleTask(task)} className="flex-shrink-0">
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {task.type === "call" ? <PhoneCall className="w-3 h-3" /> :
                        task.type === "meeting" ? <MapPin className="w-3 h-3" /> :
                        <Clock className="w-3 h-3" />}
                      {task.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.dueDate ? new Date(task.dueDate).toLocaleString() : "—"}
                    </span>
                    <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"} className="text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditTask(task)}>
                    <AlertCircle className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Dialog */}
      <Dialog open={leadDialog} onOpenChange={setLeadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{leadEditing ? "Edit Lead" : "New Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={leadForm.status} onValueChange={v => setLeadForm({ ...leadForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="closed">Closed Won</SelectItem>
                    <SelectItem value="lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Est. Value</Label>
                <Input value={leadForm.estimatedValue} onChange={e => setLeadForm({ ...leadForm, estimatedValue: e.target.value })} placeholder="e.g. 5000" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveLead}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{taskEditing ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={taskForm.type} onValueChange={v => setTaskForm({ ...taskForm, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="datetime-local" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTask}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
