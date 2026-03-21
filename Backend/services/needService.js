"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNeedFromInput = createNeedFromInput;
exports.getNeed = getNeed;
exports.markNeedMatched = markNeedMatched;
const needs_1 = require("../db/needs");
async function createNeedFromInput(rawText, classifiedNeed, lat, lng) {
    return (0, needs_1.createNeed)({
        raw_text: rawText,
        need_type: classifiedNeed.need_type,
        urgency: classifiedNeed.urgency,
        confidence: classifiedNeed.confidence ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
    });
}
async function getNeed(id) {
    return (0, needs_1.getNeedById)(id);
}
async function markNeedMatched(id) {
    return (0, needs_1.updateNeedStatus)(id, 'matched');
}
