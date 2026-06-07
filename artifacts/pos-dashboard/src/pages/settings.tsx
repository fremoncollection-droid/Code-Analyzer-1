import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import {
  useListLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useSeedData,
  useGetSettings,
  useUpdateSettings,
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useListShelves,
  useCreateShelf,
  useUpdateShelf,
  useDeleteShelf,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2,
  Plus,
  Database,
  Shield,
  User,
  MapPin,
  Percent,
  Receipt,
  Tag,
  Ruler,
  Layers,
  Pencil,
  Trash2,
  Palette,
  Box,
  Warehouse,
  AlertTriangle,
  Image,
  Save,
  Phone,
  Mail,
  Globe,
  FileText,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("categories");

  // Location state
  const [locationDialog, setLocationDialog] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", address: "", phone: "" });
  const [locEditing, setLocEditing] = useState<string | null>(null);
  const [locDeleteConfirm, setLocDeleteConfirm] = useState<string | null>(null);

  // Tax state
  const [vatRate, setVatRate] = useState<string>("");
  const [nhilRate, setNhilRate] = useState<string>("");
  const [getFundRate, setGetFundRate] = useState<string>("");
  const [covidRate, setCovidRate] = useState<string>("");

  // Category state
  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState({ id: "", name: "", color: "#3B82F6", description: "" });
  const [catEditing, setCatEditing] = useState(false);
  const [catDeleteConfirm, setCatDeleteConfirm] = useState<string | null>(null);

  // Unit state
  const [unitDialog, setUnitDialog] = useState(false);
  const [unitForm, setUnitForm] = useState({ id: "", name: "", abbreviation: "" });
  const [unitEditing, setUnitEditing] = useState(false);
  const [unitDeleteConfirm, setUnitDeleteConfirm] = useState<string | null>(null);

  // Shelf state
  const [shelfDialog, setShelfDialog] = useState(false);
  const [shelfForm, setShelfForm] = useState({ id: "", name: "", zone: "", capacity: "" });
  const [shelfEditing, setShelfEditing] = useState(false);
  const [shelfDeleteConfirm, setShelfDeleteConfirm] = useState<string | null>(null);

  // Branding state
  const [brandName, setBrandName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useBranding();

  // Receipt layout state
  const [receiptPhone, setReceiptPhone] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptWebsite, setReceiptWebsite] = useState("");
  const [receiptTagline, setReceiptTagline] = useState("");
  const [receiptTin, setReceiptTin] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [receiptReturnPolicy, setReceiptReturnPolicy] = useState("");
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);

  // Data queries
  const { data: locations } = useListLocations();
  const { data: settings } = useGetSettings();
  const { data: categories } = useListCategories();
  const { data: units } = useListUnits();
  const { data: shelves } = useListShelves();

  const currentVat = settings?.vat_rate ?? "15";
  const currentNhil = settings?.nhil_rate ?? "2.5";
  const currentGetFund = settings?.getfund_rate ?? "2.5";
  const currentCovid = settings?.covid_rate ?? "1";

  // Seed receipt fields once when settings load
  useEffect(() => {
    if (!settings) return;
    setReceiptPhone(settings.receipt_phone ?? "");
    setReceiptEmail(settings.receipt_email ?? "");
    setReceiptWebsite(settings.receipt_website ?? "");
    setReceiptTagline(settings.receipt_tagline ?? "");
    setReceiptTin(settings.receipt_tin ?? "");
    setReceiptFooter(settings.receipt_footer ?? "");
    setReceiptReturnPolicy(settings.receipt_return_policy ?? "");
    setReceiptShowLogo(settings.receipt_show_logo !== "false");
  }, [!!settings]); // run once when settings first arrive

  const isAdmin = user?.role === "admin";

  // Mutations
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

  const deleteLocation = useDeleteLocation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/locations"] });
        setLocDeleteConfirm(null);
        toast({ title: "Location removed" });
      },
      onError: () => toast({ title: "Failed to remove location", variant: "destructive" }),
    },
  });

  const updateLocation = useUpdateLocation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/locations"] });
        setLocationDialog(false);
        setLocEditing(null);
        setLocForm({ name: "", address: "", phone: "" });
        toast({ title: "Location updated" });
      },
    },
  });

  const seedData = useSeedData({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        toast({ title: "Demo data seeded", description: "Inventory, users, categories, units and shelves have been populated" });
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

  const createCategory = useCreateCategory({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/categories"] });
        setCatDialog(false);
        resetCatForm();
        toast({ title: "Category created" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to create category", variant: "destructive" }),
    },
  });

  const updateCategory = useUpdateCategory({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/categories"] });
        setCatDialog(false);
        resetCatForm();
        toast({ title: "Category updated" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to update category", variant: "destructive" }),
    },
  });

  const deleteCategory = useDeleteCategory({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/categories"] });
        setCatDeleteConfirm(null);
        toast({ title: "Category deleted" });
      },
      onError: (err: any) => {
        toast({ title: err?.response?.data?.error || "Failed to delete category", variant: "destructive" });
        setCatDeleteConfirm(null);
      },
    },
  });

  const createUnit = useCreateUnit({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/units"] });
        setUnitDialog(false);
        resetUnitForm();
        toast({ title: "Unit created" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to create unit", variant: "destructive" }),
    },
  });

  const updateUnit = useUpdateUnit({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/units"] });
        setUnitDialog(false);
        resetUnitForm();
        toast({ title: "Unit updated" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to update unit", variant: "destructive" }),
    },
  });

  const deleteUnit = useDeleteUnit({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/units"] });
        setUnitDeleteConfirm(null);
        toast({ title: "Unit deleted" });
      },
      onError: (err: any) => {
        toast({ title: err?.response?.data?.error || "Failed to delete unit", variant: "destructive" });
        setUnitDeleteConfirm(null);
      },
    },
  });

  const createShelf = useCreateShelf({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/shelves"] });
        setShelfDialog(false);
        resetShelfForm();
        toast({ title: "Shelf created" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to create shelf", variant: "destructive" }),
    },
  });

  const updateShelf = useUpdateShelf({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/shelves"] });
        setShelfDialog(false);
        resetShelfForm();
        toast({ title: "Shelf updated" });
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error || "Failed to update shelf", variant: "destructive" }),
    },
  });

  const deleteShelf = useDeleteShelf({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/shelves"] });
        setShelfDeleteConfirm(null);
        toast({ title: "Shelf deleted" });
      },
      onError: (err: any) => {
        toast({ title: err?.response?.data?.error || "Failed to delete shelf", variant: "destructive" });
        setShelfDeleteConfirm(null);
      },
    },
  });

  function resetCatForm() {
    setCatForm({ id: "", name: "", color: "#3B82F6", description: "" });
    setCatEditing(false);
  }

  function resetUnitForm() {
    setUnitForm({ id: "", name: "", abbreviation: "" });
    setUnitEditing(false);
  }

  function resetShelfForm() {
    setShelfForm({ id: "", name: "", zone: "", capacity: "" });
    setShelfEditing(false);
  }

  const presetColors = [
    "#EF4444", "#F97316", "#F59E0B", "#84CC16", "#10B981",
    "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF",
    "#F43F5E", "#71717A", "#1E293B", "#0F766E",
  ];

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

      {/* Manage tabbed card */}
      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="w-4 h-4" /> Manage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="categories" className="gap-1">
                <Tag className="w-3 h-3" /> Categories
              </TabsTrigger>
              <TabsTrigger value="units" className="gap-1">
                <Ruler className="w-3 h-3" /> Units
              </TabsTrigger>
              <TabsTrigger value="shelves" className="gap-1">
                <Layers className="w-3 h-3" /> Shelves
              </TabsTrigger>
            </TabsList>

            {/* Categories */}
            <TabsContent value="categories" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Product categories with color badges</p>
                <Button size="sm" onClick={() => { resetCatForm(); setCatDialog(true); }} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Category
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Color</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories?.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell>
                          <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: cat.color || "#3B82F6" }} />
                        </TableCell>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cat.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                              setCatForm({ id: cat.id, name: cat.name, color: cat.color || "#3B82F6", description: cat.description || "" });
                              setCatEditing(true);
                              setCatDialog(true);
                            }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCatDeleteConfirm(cat.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!categories || categories.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                          No categories yet. Add your first category.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Units */}
            <TabsContent value="units" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Measurement units for inventory</p>
                <Button size="sm" onClick={() => { resetUnitForm(); setUnitDialog(true); }} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Unit
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Abbreviation</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{u.abbreviation}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                              setUnitForm({ id: u.id, name: u.name, abbreviation: u.abbreviation });
                              setUnitEditing(true);
                              setUnitDialog(true);
                            }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setUnitDeleteConfirm(u.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!units || units.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">
                          No units yet. Add your first unit.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Shelves */}
            <TabsContent value="shelves" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Storage locations and shelf capacity</p>
                <Button size="sm" onClick={() => { resetShelfForm(); setShelfDialog(true); }} className="gap-1">
                  <Plus className="w-3 h-3" /> Add Shelf
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shelves?.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{s.zone}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{s.capacity ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                              setShelfForm({ id: s.id, name: s.name, zone: s.zone, capacity: s.capacity ? String(s.capacity) : "" });
                              setShelfEditing(true);
                              setShelfDialog(true);
                            }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setShelfDeleteConfirm(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!shelves || shelves.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                          No shelves yet. Add your first shelf.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
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
            {locations?.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{loc.name}</p>
                  {loc.address && <p className="text-xs text-muted-foreground truncate">{loc.address}</p>}
                  {loc.phone && <p className="text-xs text-muted-foreground">{loc.phone}</p>}
                </div>
                <Badge variant={loc.isActive ? "secondary" : "outline"} className="text-xs">
                  {loc.isActive ? "Active" : "Inactive"}
                </Badge>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setLocEditing(loc.id);
                        setLocForm({ name: loc.name, address: loc.address ?? "", phone: loc.phone ?? "" });
                        setLocationDialog(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setLocDeleteConfirm(loc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
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
                <p className="text-xs text-muted-foreground">Populate the system with sample locations, users, categories, units, shelves and products for testing</p>
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
                <Input type="number" min={0} max={100} step={0.5} value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder={currentVat} className="w-20 h-8 text-sm" />
                <span className="text-sm text-muted-foreground">%</span>
                <Button size="sm" variant="outline" onClick={() => {
                  const rate = parseFloat(vatRate);
                  if (isNaN(rate) || rate < 0 || rate > 100) { toast({ title: "Invalid VAT rate", variant: "destructive" }); return; }
                  updateSettings.mutate({ data: { vat_rate: String(rate) } }); setVatRate("");
                }} disabled={updateSettings.isPending || !vatRate}>
                  <Percent className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4" /> Multi-Tax Breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} step={0.5} value={nhilRate} onChange={(e) => setNhilRate(e.target.value)} placeholder={currentNhil} className="w-20 h-8 text-sm" />
                  <span className="text-sm text-muted-foreground">% NHIL</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} step={0.5} value={getFundRate} onChange={(e) => setGetFundRate(e.target.value)} placeholder={currentGetFund} className="w-20 h-8 text-sm" />
                  <span className="text-sm text-muted-foreground">% GETFund</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={100} step={0.5} value={covidRate} onChange={(e) => setCovidRate(e.target.value)} placeholder={currentCovid} className="w-20 h-8 text-sm" />
                  <span className="text-sm text-muted-foreground">% COVID</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                const updates: Record<string, string> = {};
                const vat = parseFloat(vatRate);
                const nhil = parseFloat(nhilRate);
                const getfund = parseFloat(getFundRate);
                const covid = parseFloat(covidRate);
                if (vatRate && !isNaN(vat)) updates.vat_rate = String(vat);
                if (nhilRate && !isNaN(nhil)) updates.nhil_rate = String(nhil);
                if (getFundRate && !isNaN(getfund)) updates.getfund_rate = String(getfund);
                if (covidRate && !isNaN(covid)) updates.covid_rate = String(covid);
                if (Object.keys(updates).length === 0) { toast({ title: "Nothing to save", variant: "destructive" }); return; }
                updateSettings.mutate({ data: updates });
                setVatRate(""); setNhilRate(""); setGetFundRate(""); setCovidRate("");
              }} disabled={updateSettings.isPending || (!vatRate && !nhilRate && !getFundRate && !covidRate)}>
                <Percent className="w-3 h-3 mr-1" /> Save Tax Rates
              </Button>
            </div>

            {/* Branding */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Image className="w-4 h-4" /> Branding</p>
              <div className="space-y-2">
                <Label className="text-xs">App Name</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={settings?.app_name || "MirrorTech POS"} className="h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : settings?.logo_url ? (
                      <img src={settings.logo_url} alt="Current" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No logo</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setLogoFile(f);
                      const reader = new FileReader();
                      reader.onload = () => setLogoPreview(reader.result as string);
                      reader.readAsDataURL(f);
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={async () => {
                  const name = brandName.trim() || settings?.app_name;
                  if (!name && !logoFile) { toast({ title: "Nothing to save", variant: "destructive" }); return; }
                  try {
                    const token = localStorage.getItem("pos_token");
                    if (logoFile && logoPreview) {
                      const res = await fetch("/api/upload/logo", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ logo: logoPreview }),
                      });
                      if (!res.ok) throw new Error("Upload failed");
                    }
                    if (name) {
                      updateSettings.mutate({ data: { app_name: name } });
                    }
                    setBrandName("");
                    setLogoFile(null);
                    setLogoPreview(null);
                    refresh();
                    toast({ title: "Branding saved" });
                  } catch {
                    toast({ title: "Save failed", variant: "destructive" });
                  }
                }}
                disabled={updateSettings.isPending || (!brandName && !logoFile)}
              >
                <Save className="w-3 h-3" /> Save Branding
              </Button>
            </div>

            {/* Receipt Layout */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4" /> Receipt Layout</p>
              <p className="text-xs text-muted-foreground">Customise what appears on every printed receipt. Leave a field blank to keep the current value.</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Business Phone</Label>
                  <Input
                    value={receiptPhone}
                    onChange={(e) => setReceiptPhone(e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Business Email</Label>
                  <Input
                    value={receiptEmail}
                    onChange={(e) => setReceiptEmail(e.target.value)}
                    placeholder="info@example.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label>
                  <Input
                    value={receiptWebsite}
                    onChange={(e) => setReceiptWebsite(e.target.value)}
                    placeholder="www.example.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Tagline</Label>
                  <Input
                    value={receiptTagline}
                    onChange={(e) => setReceiptTagline(e.target.value)}
                    placeholder="Wholesale & Retail Sales"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GRA / TIN Number</Label>
                  <Input
                    value={receiptTin}
                    onChange={(e) => setReceiptTin(e.target.value)}
                    placeholder="C000XXXXXX"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Show Logo on Receipt</Label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setReceiptShowLogo(true)}
                      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${receiptShowLogo ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptShowLogo(false)}
                      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${!receiptShowLogo ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Footer Message</Label>
                <Input
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Thank you for shopping with us!"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Return Policy Note</Label>
                <Input
                  value={receiptReturnPolicy}
                  onChange={(e) => setReceiptReturnPolicy(e.target.value)}
                  placeholder="Goods once sold are not returnable."
                  className="h-8 text-sm"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={updateSettings.isPending}
                onClick={() => {
                  updateSettings.mutate({
                    data: {
                      receipt_phone: receiptPhone,
                      receipt_email: receiptEmail,
                      receipt_website: receiptWebsite,
                      receipt_tagline: receiptTagline,
                      receipt_tin: receiptTin,
                      receipt_footer: receiptFooter,
                      receipt_return_policy: receiptReturnPolicy,
                      receipt_show_logo: receiptShowLogo ? "true" : "false",
                    },
                  });
                }}
              >
                <Save className="w-3 h-3" /> Save Receipt Layout
              </Button>
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
                <span className="font-medium">GHS (&cent;)</span>
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

      {/* Dialog: Add/Edit Category */}
      <Dialog open={catDialog} onOpenChange={(open) => { if (!open) { setCatDialog(false); resetCatForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-4 h-4" /> {catEditing ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Beverages" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-border" style={{ backgroundColor: catForm.color }} />
                <Input value={catForm.color} onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))} placeholder="#3B82F6" className="w-28" />
                <div className="flex flex-wrap gap-1">
                  {presetColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm((f) => ({ ...f, color: c }))}
                      className="w-5 h-5 rounded-full border border-border hover:scale-110 transition"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCatDialog(false); resetCatForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!catForm.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
                if (catEditing) {
                  updateCategory.mutate({ id: catForm.id, data: { name: catForm.name, color: catForm.color, description: catForm.description || undefined } });
                } else {
                  createCategory.mutate({ data: { name: catForm.name, color: catForm.color, description: catForm.description || undefined } });
                }
              }}
              disabled={!catForm.name || createCategory.isPending || updateCategory.isPending}
            >
              {catEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Delete Location */}
      <Dialog open={!!locDeleteConfirm} onOpenChange={(open) => { if (!open) setLocDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Remove Location
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove this location? It will be deactivated and hidden from the system.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => locDeleteConfirm && deleteLocation.mutate({ id: locDeleteConfirm })}
              disabled={deleteLocation.isPending}
            >
              {deleteLocation.isPending ? "Removing..." : "Remove Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Delete Category */}
      <Dialog open={!!catDeleteConfirm} onOpenChange={(open) => { if (!open) setCatDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Delete Category
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this category? If any inventory items are assigned to it, the deletion will be blocked.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => catDeleteConfirm && deleteCategory.mutate({ id: catDeleteConfirm })} disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit Unit */}
      <Dialog open={unitDialog} onOpenChange={(open) => { if (!open) { setUnitDialog(false); resetUnitForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="w-4 h-4" /> {unitEditing ? "Edit Unit" : "Add Unit"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Kilogram" />
            </div>
            <div className="space-y-1">
              <Label>Abbreviation *</Label>
              <Input value={unitForm.abbreviation} onChange={(e) => setUnitForm((f) => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. kg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUnitDialog(false); resetUnitForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!unitForm.name || !unitForm.abbreviation) { toast({ title: "Name and abbreviation are required", variant: "destructive" }); return; }
                if (unitEditing) {
                  updateUnit.mutate({ id: unitForm.id, data: { name: unitForm.name, abbreviation: unitForm.abbreviation } });
                } else {
                  createUnit.mutate({ data: { name: unitForm.name, abbreviation: unitForm.abbreviation } });
                }
              }}
              disabled={!unitForm.name || !unitForm.abbreviation || createUnit.isPending || updateUnit.isPending}
            >
              {unitEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Delete Unit */}
      <Dialog open={!!unitDeleteConfirm} onOpenChange={(open) => { if (!open) setUnitDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Delete Unit
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this unit? If any inventory items are assigned to it, the deletion will be blocked.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => unitDeleteConfirm && deleteUnit.mutate({ id: unitDeleteConfirm })} disabled={deleteUnit.isPending}>
              {deleteUnit.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add/Edit Shelf */}
      <Dialog open={shelfDialog} onOpenChange={(open) => { if (!open) { setShelfDialog(false); resetShelfForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="w-4 h-4" /> {shelfEditing ? "Edit Shelf" : "Add Shelf"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={shelfForm.name} onChange={(e) => setShelfForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. A1" />
            </div>
            <div className="space-y-1">
              <Label>Zone *</Label>
              <Input value={shelfForm.zone} onChange={(e) => setShelfForm((f) => ({ ...f, zone: e.target.value }))} placeholder="e.g. Front Display" />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input type="number" value={shelfForm.capacity} onChange={(e) => setShelfForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="Optional max items" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShelfDialog(false); resetShelfForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!shelfForm.name || !shelfForm.zone) { toast({ title: "Name and zone are required", variant: "destructive" }); return; }
                const payload = { name: shelfForm.name, zone: shelfForm.zone, capacity: shelfForm.capacity ? parseInt(shelfForm.capacity) : undefined };
                if (shelfEditing) {
                  updateShelf.mutate({ id: shelfForm.id, data: payload });
                } else {
                  createShelf.mutate({ data: payload });
                }
              }}
              disabled={!shelfForm.name || !shelfForm.zone || createShelf.isPending || updateShelf.isPending}
            >
              {shelfEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Delete Shelf */}
      <Dialog open={!!shelfDeleteConfirm} onOpenChange={(open) => { if (!open) setShelfDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Delete Shelf
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this shelf? If any inventory items are assigned to it, the deletion will be blocked.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShelfDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => shelfDeleteConfirm && deleteShelf.mutate({ id: shelfDeleteConfirm })} disabled={deleteShelf.isPending}>
              {deleteShelf.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add / Edit Location */}
      <Dialog open={locationDialog} onOpenChange={(v) => { setLocationDialog(v); if (!v) { setLocEditing(null); setLocForm({ name: "", address: "", phone: "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locEditing ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} placeholder="Branch name" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={locForm.address} onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))} placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={locForm.phone} onChange={(e) => setLocForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+233..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLocationDialog(false); setLocEditing(null); setLocForm({ name: "", address: "", phone: "" }); }}>Cancel</Button>
            {locEditing ? (
              <Button
                onClick={() => updateLocation.mutate({ id: locEditing, data: { name: locForm.name, address: locForm.address || undefined, phone: locForm.phone || undefined } })}
                disabled={!locForm.name || updateLocation.isPending}
              >
                {updateLocation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button
                onClick={() => createLocation.mutate({ data: { name: locForm.name, address: locForm.address || undefined, phone: locForm.phone || undefined } })}
                disabled={!locForm.name || createLocation.isPending}
              >
                {createLocation.isPending ? "Creating..." : "Create Location"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
