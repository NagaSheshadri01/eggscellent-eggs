import { Database } from './integrations/supabase/types';
type T1 = Database['public']['Tables']['manifest_drops'];
type T2 = Database['public']['Tables']['subscriptions'];
type T3 = keyof Database['public']['Tables'];
const k: T3 = 'manifest_drops';
