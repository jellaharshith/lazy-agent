"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const supabase_1 = require("../config/supabase");
function dbError(context, err) {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        return new Error(`${context}: ${err.message}`);
    }
    return new Error(`${context}: unknown database error`);
}
async function createNotification(input) {
    const { data, error } = await supabase_1.supabase
        .from('notifications')
        .insert({
        need_id: input.need_id,
        message_text: input.message_text ?? null,
        voice_url: input.voice_url ?? null,
    })
        .select('*')
        .single();
    if (error)
        throw dbError('createNotification', error);
    return data;
}
