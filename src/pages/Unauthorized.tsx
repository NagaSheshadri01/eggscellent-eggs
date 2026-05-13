import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const Unauthorized = () => (
  <div className="min-h-screen grid place-items-center bg-background px-4">
    <Seo title="Unauthorized — Eggscellent" />
    <div className="text-center max-w-sm">
      <div className="w-16 h-16 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
        <ShieldAlert className="w-7 h-7 text-brown/70" />
      </div>
      <h1 className="font-display font-bold text-brown text-2xl mb-2">Access denied</h1>
      <p className="text-sm text-muted-foreground mb-6">You don't have permission to view this page.</p>
      <Button asChild variant="hero"><Link to="/">Back to store</Link></Button>
    </div>
  </div>
);

export default Unauthorized;