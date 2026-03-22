import { supabase } from '../config/supabase';
import { CreateMatchInput, Match } from '../types';

function dbError(context: string, err: unknown): Error {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return new Error(`${context}: ${(err as { message: string }).message}`);
  }
  return new Error(`${context}: unknown database error`);
}

export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      need_id: input.need_id,
      resource_id: input.resource_id,
      score: input.score ?? null,
      distance_km: input.distance_km ?? null,
      status: input.status ?? 'suggested',
    })
    .select('*')
    .single();

  if (error) throw dbError('createMatch', error);
  return data as Match;
}

export async function getMatchByNeedId(needId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('need_id', needId)
    .order('created_at', { ascending: false });

  if (error) throw dbError('getMatchByNeedId', error);
  return (data ?? []) as Match[];
}

export async function getMatchesByNeedIds(needIds: string[]): Promise<Match[]> {
  if (needIds.length === 0) return [];

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .in('need_id', needIds)
    .order('created_at', { ascending: false });

  if (error) throw dbError('getMatchesByNeedIds', error);
  return (data ?? []) as Match[];
}
