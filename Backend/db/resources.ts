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

/** All rows’ title + coords for seed / dedupe (any status). */
export async function listResourceTitleLocations(): Promise<
  Array<{ title: string; lat: number | null; lng: number | null }>
> {
  const { data, error } = await supabase.from('resources').select('title, lat, lng');
  if (error) throw dbError('listResourceTitleLocations', error);
  return (data ?? []) as Array<{ title: string; lat: number | null; lng: number | null }>;
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const { data, error } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();

  if (error) throw dbError('getResourceById', error);
  return (data as Resource) ?? null;
}

export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const row: Record<string, unknown> = {
    title: input.title,
    resource_type: input.resource_type ?? "food",
    quantity: input.quantity ?? null,
    expires_at: input.expires_at ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    status: input.status ?? "available",
  };
  if (input.category != null) row.category = input.category;
  if (input.original_price != null) row.original_price = input.original_price;
  if (input.discounted_price != null) row.discounted_price = input.discounted_price;
  const pid = input.provider_id;
  if (pid != null && String(pid).trim() !== '') {
    row.provider_id = pid;
  }

  const { data, error } = await supabase.from('resources').insert(row).select('*').single();

  if (error) throw dbError('createResource', error);
  return data as Resource;
}

export async function listResourcesByProviderId(providerId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) throw dbError('listResourcesByProviderId', error);
  return (data ?? []) as Resource[];
}
