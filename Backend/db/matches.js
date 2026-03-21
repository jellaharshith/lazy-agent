"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMatch = createMatch;
exports.getMatchByNeedId = getMatchByNeedId;
const supabase_1 = require("../config/supabase");
function dbError(context, err) {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        return new Error(`${context}: ${err.message}`);
    }
    return new Error(`${context}: unknown database error`);
}
async function createMatch(input) {
    const { data, error } = await supabase_1.supabase
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
    if (error)
        throw dbError('createMatch', error);
    return data;
}
async function getMatchByNeedId(needId) {
    const { data, error } = await supabase_1.supabase
        .from('matches')
        .select('*')
        .eq('need_id', needId)
        .order('created_at', { ascending: false });
    if (error)
        throw dbError('getMatchByNeedId', error);
    return (data ?? []);
}
