import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeliveryIssueModalProps {
  open: boolean;
  onClose: () => void;
  onSelectIssue: (status: "skipped" | "failed") => void;
}

export const DeliveryIssueModal = ({
  open,
  onClose,
  onSelectIssue
}: DeliveryIssueModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="rounded-3xl max-w-sm w-[90%] p-6 bg-card border border-border/80 shadow-card animate-scale-in text-center space-y-4">
        <DialogHeader className="space-y-1">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 grid place-items-center mx-auto text-xl mb-1">
            ⚠️
          </div>
          <DialogTitle className="font-display font-bold text-lg text-brown leading-tight">
            Log Delivery Issue
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Record a doorstep exception to skip this delivery. No charges will be deducted from the user's wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          {/* Option 1: Skipped */}
          <Button
            variant="outline"
            className="w-full h-11 border-stone-200 text-stone-700 hover:bg-stone-50 hover:text-stone-900 rounded-xl text-xs font-semibold text-left flex justify-start items-center gap-2 pl-4"
            onClick={() => {
              onSelectIssue("skipped");
              onClose();
            }}
          >
            🌴 Mark as Skipped (Customer Request/Holiday)
          </Button>

          {/* Option 2: Failed */}
          <Button
            variant="outline"
            className="w-full h-11 border-stone-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-xs font-semibold text-left flex justify-start items-center gap-2 pl-4"
            onClick={() => {
              onSelectIssue("failed");
              onClose();
            }}
          >
            🔒 Mark as Failed (No Door Access / Locked Gate)
          </Button>

          {/* Cancel */}
          <Button
            variant="ghost"
            className="w-full h-10 text-xs font-bold text-stone-400 hover:text-stone-600 mt-2"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
