import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  bucket: "product-images" | "site-images";
  pathPrefix?: string;
  className?: string;
};

const ImageUploader = ({ value, onChange, bucket, pathPrefix = "", className }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${pathPrefix ? pathPrefix.replace(/\/$/, "") + "/" : ""}${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!value) return;
    try {
      const url = new URL(value);
      const marker = `/object/public/${bucket}/`;
      const idx = url.pathname.indexOf(marker);
      if (idx >= 0) {
        const path = url.pathname.substring(idx + marker.length);
        await supabase.storage.from(bucket).remove([path]);
      }
    } catch { /* ignore — still clear locally */ }
    onChange(null);
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className="relative border-2 border-dashed border-border rounded-xl p-3 bg-secondary/30 hover:bg-secondary/50 transition-smooth"
      >
        {value ? (
          <div className="flex items-center gap-3">
            <img src={value} alt="" className="w-20 h-20 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{value}</div>
              <div className="flex gap-2 mt-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Replace
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={busy}>
                  <X className="w-3.5 h-3.5 text-destructive" /> Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full flex flex-col items-center gap-1 py-4 text-muted-foreground hover:text-brown"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            <span className="text-sm">Click or drop an image</span>
            <span className="text-[11px]">PNG / JPG / WEBP — up to 5MB</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
      </div>
    </div>
  );
};

export default ImageUploader;