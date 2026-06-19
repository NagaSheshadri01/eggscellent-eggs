import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminProduct = {
  id?: string;
  name: string;
  slug: string;
  benefit: string | null;
  unit: string | null;
  original_price: number;
  discounted_price: number;
  stock_quantity: number;
  image_url: string | null;
  images: string[];
  description?: string | null;
  active: boolean;
  display_order: number;
  is_in_stock?: boolean;
};

export const useProducts = (opts?: { onlyActive?: boolean }) => {
  return useQuery({
    queryKey: ["products", opts?.onlyActive ? "active" : "all"],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (opts?.onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminProduct[];
    },
  });
};

export const useProductMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });

  const upsert = useMutation({
    mutationFn: async (p: AdminProduct) => {
      const payload = {
        ...p,
        original_price: Number(p.original_price),
        discounted_price: Number(p.discounted_price),
        stock_quantity: Number(p.stock_quantity),
        display_order: Number(p.display_order ?? 0),
      };
      const { error } = p.id
        ? await (supabase as any).from("products").update(payload).eq("id", p.id)
        : await (supabase as any).from("products").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const swapOrder = useMutation({
    mutationFn: async ({ a, b }: { a: AdminProduct; b: AdminProduct }) => {
      await (supabase as any).from("products").update({ display_order: b.display_order }).eq("id", a.id!);
      await (supabase as any).from("products").update({ display_order: a.display_order }).eq("id", b.id!);
    },
    onSuccess: invalidate,
  });

  return { upsert, remove, swapOrder };
};