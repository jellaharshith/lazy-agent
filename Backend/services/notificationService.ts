import { createNotification } from '../db/notifications';
import { Notification } from '../types';

export async function createSupportNotification(
  needId: string,
  messageText: string,
  voiceUrl?: string
): Promise<Notification> {
  return createNotification({
    need_id: needId,
    message_text: messageText,
    voice_url: voiceUrl ?? null,
  });
}
