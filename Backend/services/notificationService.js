"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportNotification = createSupportNotification;
const notifications_1 = require("../db/notifications");
async function createSupportNotification(needId, messageText, voiceUrl) {
    return (0, notifications_1.createNotification)({
        need_id: needId,
        message_text: messageText,
        voice_url: voiceUrl ?? null,
    });
}
