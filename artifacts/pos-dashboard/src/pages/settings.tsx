import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListLocations, useCreateLocation, useSeedData, useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Database, Shield, User, MapPin, Percent } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [locationDialog, setLocationDialog] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", address: "", phone: "" });
  const [vatRate, setVatRate] = useState<string>("");

  const { data: locations } = useListLocations();
  const { data: settings } = useGetSettings();
  const currentVat = settings?.vat_rate ?? "15";

  const createLocation = useCreateLocation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/locations"] });
        setLocationDialog(false);
        setLocForm({ name: "", address: "", phone: "" });
        toast({ title: "Location created" });
      },
    },
  });
  const seedData = useSeedData({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        toast({ title: "Demo data seeded", description: "Inventory, users and categories have been populated" });
      },
      onError: () => toast({ title: "Seed failed", variant: "destructive" }),
    },
  });
  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/settings"] });
        toast({ title: "Settings updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">System configuration and management</p>
      </div>

      {/* Profile */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" /> My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge className="ml-auto capitalize">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Locations
            </CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setLocationDialog(true)} className="gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {locations?.map(loc => (
              <div key={loc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{loc.name}</p>
                  {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                </div>
                <Badge variant={loc.isActive ? "secondary" : "outline"} className="text-xs">
                  {loc.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
            {(!locations || locations.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-4">No locations configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin section */}
      {isAdmin && (
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">Seed Demo Data</p>
                <p className="text-xs text-muted-foreground">Populate the system with sample locations, users, categories and products for testing</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => seedData.mutate()}
                disabled={seedData.isPending}
              >
                {seedData.isPending ? "Seeding..." : "Seed Data"}
              </Button>
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">VAT / Tax Rate</p>
                <p className="text-xs text-muted-foreground">Current: {currentVat}% VAT</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  placeholder={currentVat}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-sm text-muted-foreground">%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const rate = parseFloat(vatRate);
                    if (isNaN(rate) || rate < 0 || rate > 100) {
                      toast({ title: "Invalid VAT rate", variant: "destructive" });
                      return;
                    }
                    updateSettings.mutate({ data: { vat_rate: String(rate) } });
                    setVatRate("");
                  }}
                  disabled={updateSettings.isPending || !vatRate}
                >
                  <Percent className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System info */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" /> System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">System</span>
                <span className="font-medium">MirrorTech POS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">2.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium">GHS (₵)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax Rate</span>
                <span className="font-medium">{currentVat}% VAT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax Authority</span>
                <span className="font-medium">GRA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">Ghana</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add location dialog */}
      <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="Branch name" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={locForm.phone} onChange={e => setLocForm(f => ({ ...f, phone: e.target.value }))} placeholder="+233..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialog(false)}>Cancel</Button>
            <Button onClick={() => createLocation.mutate({ data: { name: locForm.name, address: locForm.address || undefined, phone: locForm.phone || undefined } })} disabled={!locForm.name || createLocation.isPending}>
              Create Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
