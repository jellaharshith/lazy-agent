import { supabase } from '../config/supabase';
import { CreateResourceInput, Resource } from '../types';

function dbError(context: string, err: unknown): Error {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return new Error(`${context}: ${(err as { message: string }).message}`);
  }
  return new Error(`${context}: unknown database error`);
}

export async function getAvailableResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (error) throw dbError('getAvailableResources', error);
  return (data ?? []) as Resource[];
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const { data, error } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();

  if (error) throw dbError('getResourceById', error);
  return (data as Resource) ?? null;
}

export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      title: input.title,
      resource_type: input.resource_type ?? 'food',
      quantity: input.quantity ?? null,
      expires_at: input.expires_at ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      status: input.status ?? 'available',
    })
    .select('*')
    .single();

  if (error) throw dbError('createResource', error);
  return data as Resource;
}
