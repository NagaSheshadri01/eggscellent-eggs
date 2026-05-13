import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Phone, MapPin, Bike, Check, X, Power } from "lucide-react";
import { useDeliveryPartners, useUpdateDeliveryPartner, useApproveDeliveryPartner, type DeliveryPartner } from "@/hooks/useDeliveryPartners";

const StatusBadge = ({ p }: { p: DeliveryPartner }) => {
  const cls = p.status === "approved" ? "bg-success/15 text-success" : p.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-brown";
  return <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${cls}`}>{p.status}</span>;
};

const AdminDeliveryPartners = () => {
  const [tab, setTab] = useState<string>("all");
  const { data, isLoading } = useDeliveryPartners(tab === "all" ? undefined : tab);
  const update = useUpdateDeliveryPartner();
  const approve = useApproveDeliveryPartner();

  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Delivery partners</h1>
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>
      {isLoading ? <Skeleton className="h-80" /> : (
        <div className="grid gap-3">
          {data?.map(p => (
            <div key={p.id} className="bg-card rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold text-brown">{p.full_name}</h3>
                    <StatusBadge p={p} />
                    {p.active && <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md bg-primary/20 text-brown">Active</span>}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>
                    {p.vehicle_type && <span className="flex items-center gap-1"><Bike className="w-3 h-3" /> {p.vehicle_type}</span>}
                    {p.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.city}{p.pincode ? ` · ${p.pincode}` : ""}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {p.status === "pending" && <>
                    <Button size="sm" variant="brown" onClick={() => approve.mutate(p)}><Check className="w-4 h-4" /> Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: p.id, patch: { status: "rejected", active: false } })}><X className="w-4 h-4" /> Reject</Button>
                  </>}
                  {p.status === "approved" && (
                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: p.id, patch: { active: !p.active } })}><Power className="w-4 h-4" /> {p.active ? "Deactivate" : "Activate"}</Button>
                  )}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Assigned areas (comma-separated pincodes)</label>
                  <Input className="mt-1" defaultValue={p.assigned_areas?.join(", ") || ""}
                    onBlur={(e) => {
                      const areas = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      update.mutate({ id: p.id, patch: { assigned_areas: areas } }, { onSuccess: () => toast.success("Areas updated") });
                    }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Input className="mt-1" defaultValue={p.notes || ""} onBlur={(e) => update.mutate({ id: p.id, patch: { notes: e.target.value } })} />
                </div>
              </div>
            </div>
          ))}
          {data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No applications.</p>}
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryPartners;