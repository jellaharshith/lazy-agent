import { supabase } from '../config/supabase';
import { CreateNeedInput, Need } from '../types';

function dbError(context: string, err: unknown): Error {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return new Error(`${context}: ${(err as { message: string }).message}`);
  }
  return new Error(`${context}: unknown database error`);
}

export async function createNeed(input: CreateNeedInput): Promise<Need> {
  const { data, error } = await supabase
    .from('needs')
    .insert({
      raw_text: input.raw_text,
      need_type: input.need_type,
      urgency: input.urgency,
      confidence: input.confidence ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      status: input.status ?? 'open',
    })
    .select('*')
    .single();

  if (error) throw dbError('createNeed', error);
  return data as Need;
}

export async function getNeedById(id: string): Promise<Need | null> {
  const incoming = id;
  const normalizedId = id.trim().toLowerCase();
  console.log('[getNeedById] incoming id:', JSON.stringify(incoming));
  console.log('[getNeedById] normalized id for query:', JSON.stringify(normalizedId));

  const { data, error } = await supabase.from('needs').select('*').eq('id', normalizedId).limit(1);

  console.log(
    '[getNeedById] Supabase raw response:',
    JSON.stringify({ error: error ?? null, data: data ?? null, rowCount: Array.isArray(data) ? data.length : null })
  );

  if (error) throw dbError('getNeedById', error);

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  console.log('[getNeedById] returned row:', row ? JSON.stringify(row) : 'null');
  return (row as Need) ?? null;
}

export async function updateNeedStatus(id: string, status: string): Promise<Need> {
  const normalizedId = id.trim().toLowerCase();
  const { data, error } = await supabase
    .from('needs')
    .update({ status })
    .eq('id', normalizedId)
    .select('*')
    .single();

  if (error) throw dbError('updateNeedStatus', error);
  return data as Need;
}
