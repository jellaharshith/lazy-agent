import { supabase } from '../config/supabase';
import { CreateNotificationInput, Notification } from '../types';

function dbError(context: string, err: unknown): Error {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return new Error(`${context}: ${(err as { message: string }).message}`);
  }
  return new Error(`${context}: unknown database error`);
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      need_id: input.need_id,
      message_text: input.message_text ?? null,
      voice_url: input.voice_url ?? null,
    })
    .select('*')
    .single();

  if (error) throw dbError('createNotification', error);
  return data as Notification;
}
