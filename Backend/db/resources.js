"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableResources = getAvailableResources;
exports.getResourceById = getResourceById;
exports.createResource = createResource;
const supabase_1 = require("../config/supabase");
function dbError(context, err) {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        return new Error(`${context}: ${err.message}`);
    }
    return new Error(`${context}: unknown database error`);
}
async function getAvailableResources() {
    const { data, error } = await supabase_1.supabase
        .from('resources')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });
    if (error)
        throw dbError('getAvailableResources', error);
    return (data ?? []);
}
async function getResourceById(id) {
    const { data, error } = await supabase_1.supabase.from('resources').select('*').eq('id', id).maybeSingle();
    if (error)
        throw dbError('getResourceById', error);
    return data ?? null;
}
async function createResource(input) {
    const { data, error } = await supabase_1.supabase
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
    if (error)
        throw dbError('createResource', error);
    return data;
}
