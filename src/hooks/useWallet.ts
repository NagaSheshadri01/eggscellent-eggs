import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Wallet {
  id: string;
  user_id?: string | null;
  balance: number;
  reserved_balance?: number;
  updated_at?: string | null;
}

export const useWallet = () => {
  return useQuery<Wallet>({
    queryKey: ['user-wallet-balance'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User unauthenticated");

      // Attempt to retrieve the wallet row
      let { data, error } = await (supabase as any)
        .from('wallets')
        .select('id, balance, reserved_balance')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle to prevent hard 406 exceptions

      // JIT Remediation: If database trigger hasn't finished, auto-provision client-side safely
      if (!data) {
        const { data: newWallet, error: insertError } = await (supabase as any)
          .from('wallets')
          .insert([{ user_id: user.id, balance: 0.00, reserved_balance: 0.00 }])
          .select('id, balance, reserved_balance')
          .single();
          
        if (insertError && insertError.code !== '23505') throw insertError; // Ignore conflict duplicate codes
        return {
          id: newWallet?.id || '',
          balance: typeof newWallet?.balance === 'string' ? parseFloat(newWallet.balance) : (newWallet?.balance ?? 0.00),
          reserved_balance: typeof newWallet?.reserved_balance === 'string' ? parseFloat(newWallet.reserved_balance) : (newWallet?.reserved_balance ?? 0.00)
        };
      }

      if (error) throw error;
      return {
        id: data.id,
        balance: typeof data.balance === 'string' ? parseFloat(data.balance) : (data.balance ?? 0.00),
        reserved_balance: typeof data.reserved_balance === 'string' ? parseFloat(data.reserved_balance) : (data.reserved_balance ?? 0.00)
      };
    },
    retry: 3, // Automatically retry 3 times with exponential backoff if database state is lagging
    retryDelay: (attempt) => Math.pow(2, attempt) * 200,
  });
};
