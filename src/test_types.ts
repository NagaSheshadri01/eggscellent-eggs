import { Database } from './integrations/supabase/types';
type T1 = Database['public']['Tables']['subscription_calendar_ledger'];
type T2 = Database['public']['Tables']['subscriptions'];
type T3 = keyof Database['public']['Tables'];
const k: T3 = 'subscription_calendar_ledger';
