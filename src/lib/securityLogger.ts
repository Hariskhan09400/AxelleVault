import { supabase } from './supabase';

export const saveLog = async (
  user_id: string,
  event_type: string,
  event_data: Record<string, unknown>,
  risk_level: 'low' | 'medium' | 'high' | 'critical' = 'low'
) => {
  try {
    await supabase.from('security_logs').insert({
      user_id,
      event_type,
      event_data,
      risk_level,
    });
  } catch (error) {
    console.error('[Log] Save failed', error);
  }
};
