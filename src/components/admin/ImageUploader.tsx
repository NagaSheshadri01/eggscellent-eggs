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

/** Max dimension (px) on the longest side after compression. */
const MAX_PX = 1200;
/** JPEG quality (0–1). 0.82 delivers excellent visuals with ~60-70% size reduction. */
const QUALITY = 0.82;
/** Console-warn threshold — compressed file above this is logged for monitoring. */
const WARN_BYTES = 500 * 1024; // 500 KB

/**
 * Compresses an image File using the Canvas API — no external library needed.
 * Scales to MAX_PX on the longest side, then encodes as JPEG at QUALITY.
 * Falls back to the original File if the browser canvas is unavailable.
 */
const compressImage = (file: File): Promise<Blob> =>
  new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_PX || height > MAX_PX) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_PX);
          width = MAX_PX;
        } else {
          width = Math.round((width / height) * MAX_PX);
          height = MAX_PX;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        "image/jpeg",
        QUALITY,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });

const fmt = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;

const ImageUploader = ({ value, onChange, bucket, pathPrefix = "", className }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    // Raw size guard before compression — 15 MB is a reasonable ceiling
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image must be under 15 MB before compression");
      return;
    }
    setBusy(true);
    try {
      // ── Client-side compression ────────────────────────────────────────
      const originalSize = file.size;
      const compressed = await compressImage(file);
      const savedPct = Math.round((1 - compressed.size / originalSize) * 100);

      if (compressed.size > WARN_BYTES) {
        console.warn(
          `[ImageUploader] Compressed to ${fmt(compressed.size)} — still above ${fmt(WARN_BYTES)}. ` +
          `Consider a smaller source image.`,
        );
      }
      // ──────────────────────────────────────────────────────────────────

      // All uploads land as .jpg — content-addressed UUID paths are immutable
      const path = `${pathPrefix ? pathPrefix.replace(/\/$/, "") + "/" : ""}${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
        cacheControl: "31536000", // 1-year CDN cache — UUID path guarantees no stale hits
        upsert: false,
        contentType: "image/jpeg",
      });
      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);

      toast.success(
        savedPct > 0
          ? `Uploaded — ${fmt(originalSize)} → ${fmt(compressed.size)} (${savedPct}% saved)`
          : `Image uploaded (${fmt(compressed.size)})`,
      );
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
            <span className="text-sm">
              {busy ? "Compressing & uploading…" : "Click or drop an image"}
            </span>
            <span className="text-[11px]">
              PNG / JPG / WEBP · auto-compressed to JPEG ≤ 1200 px
            </span>
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