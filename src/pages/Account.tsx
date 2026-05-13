import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import OrdersList from "@/components/site/OrdersList";
import AddressPicker from "@/components/site/AddressPicker";
import { LogOut } from "lucide-react";

const Account = () => {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "orders";

  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name, phone: profile.phone,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title="My account — Eggscellent" description="Manage your profile, addresses and order preferences." />
      <Header />
      <main className="container max-w-2xl py-10">
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-2">My account</h1>
        <p className="text-muted-foreground mb-8">{profile?.email || profile?.phone || ""}</p>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="orders"><OrdersList /></TabsContent>

          <TabsContent value="addresses">
            <div className="bg-card rounded-3xl shadow-soft p-5 sm:p-6">
              <AddressPicker manageMode />
            </div>
          </TabsContent>

          <TabsContent value="profile">
            {profile && (
              <div className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
                <div className="space-y-1.5"><Label>Full name</Label>
                  <Input value={profile.full_name || ""} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label>Phone</Label>
                  <Input value={profile.phone || ""} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
                  <Button variant="hero" onClick={save} disabled={saving}>Save</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Account;
