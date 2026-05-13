import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Lock, MapPin, Pencil, RotateCw } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRetry: () => void;
  onManual: () => void;
};

const Steps = ({ items }: { items: string[] }) => (
  <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
    {items.map((s, i) => <li key={i}>{s}</li>)}
  </ol>
);

const LocationBlockedDialog = ({ open, onOpenChange, onRetry, onManual }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center mb-2">
          <Lock className="w-5 h-5 text-brown" />
        </div>
        <DialogTitle className="font-display text-brown text-xl">Location is blocked for this site</DialogTitle>
        <DialogDescription>
          Your browser has location turned off for Eggscellent. Re-enable it from the address bar, or enter your address manually.
        </DialogDescription>
      </DialogHeader>

      {/* Visual hint */}
      <div className="rounded-2xl border border-border bg-secondary/40 p-4 flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card border border-border shrink-0">
          <Lock className="w-4 h-4 text-brown" />
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <span className="text-muted-foreground">Click the lock / location icon in your browser's address bar.</span>
      </div>

      <Tabs defaultValue="chrome" className="mt-2">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="chrome">Chrome</TabsTrigger>
          <TabsTrigger value="safari">Safari</TabsTrigger>
          <TabsTrigger value="firefox">Firefox</TabsTrigger>
        </TabsList>
        <TabsContent value="chrome" className="pt-3">
          <Steps items={[
            "Click the lock / tune icon at the left of the address bar.",
            "Open 'Site settings' (or 'Permissions for this site').",
            "Find 'Location' and change it to 'Allow'.",
            "Reload this page and tap Try again below.",
          ]} />
        </TabsContent>
        <TabsContent value="safari" className="pt-3">
          <Steps items={[
            "From the menu bar, open Safari → Settings → Websites → Location.",
            "Find this site in the list and switch it to 'Allow'.",
            "Reload this page and tap Try again below.",
          ]} />
        </TabsContent>
        <TabsContent value="firefox" className="pt-3">
          <Steps items={[
            "Click the shield / lock icon at the left of the address bar.",
            "Choose 'Clear permission' or set Location to 'Allow'.",
            "Reload this page and tap Try again below.",
          ]} />
        </TabsContent>
      </Tabs>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={() => { onOpenChange(false); onManual(); }}>
          <Pencil className="w-4 h-4" /> Enter manually
        </Button>
        <Button variant="hero" onClick={() => { onOpenChange(false); onRetry(); }}>
          <RotateCw className="w-4 h-4" /> Try again
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default LocationBlockedDialog;