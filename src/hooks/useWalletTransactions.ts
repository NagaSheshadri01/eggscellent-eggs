import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: 'recharge' | 'delivery_deduction' | 'refund' | 'admin_adjustment' | 'compensation';
  reference_id: string | null;
  created_at: string;
}

export const useWalletTransactions = () => {
  return useQuery<WalletTransaction[]>({
    queryKey: ['user-wallet-transactions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // 1. Get user's wallet
      const { data: wallet, error: walletError } = await (supabase as any)
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) throw new Error(walletError.message);
      if (!wallet) return [];

      // 2. Get transactions for this wallet
      const { data, error } = await (supabase as any)
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map(tx => ({
        id: tx.id,
        wallet_id: tx.wallet_id,
        amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
        transaction_type: tx.transaction_type as any,
        reference_id: tx.reference_id,
        created_at: tx.created_at,
      }));
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });
};
