"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const needs_1 = require("../db/needs");
const needService_1 = require("../services/needService");
const router = (0, express_1.Router)();
function parseOptionalNumber(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
function paramId(req) {
    const raw = req.params.id;
    if (typeof raw === 'string' && raw.trim())
        return raw.trim();
    if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim())
        return raw[0].trim();
    return undefined;
}
router.get('/', (_req, res) => {
    try {
        res.status(200).json({
            message: 'Needs API',
            usage: {
                create: 'POST /api/needs — body: { raw_text, need_type, urgency, confidence?, lat?, lng? }',
                getOne: 'GET /api/needs/:id',
            },
        });
    }
    catch (err) {
        console.error('GET /api/needs', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { raw_text, need_type, urgency, confidence, lat, lng } = req.body ?? {};
        if (typeof raw_text !== 'string' || !raw_text.trim()) {
            return res.status(400).json({ error: 'raw_text is required' });
        }
        if (typeof need_type !== 'string' || !need_type.trim()) {
            return res.status(400).json({ error: 'need_type is required' });
        }
        if (typeof urgency !== 'string' || !urgency.trim()) {
            return res.status(400).json({ error: 'urgency is required' });
        }
        const latNum = parseOptionalNumber(lat);
        const lngNum = parseOptionalNumber(lng);
        let confidenceVal = undefined;
        if (confidence !== undefined && confidence !== null && confidence !== '') {
            const c = Number(confidence);
            if (!Number.isFinite(c)) {
                return res.status(400).json({ error: 'confidence must be a number' });
            }
            confidenceVal = c;
        }
        const inputPayload = {
            raw_text: raw_text.trim(),
            need_type: need_type.trim(),
            urgency: urgency.trim(),
            confidence: confidenceVal ?? null,
            lat: latNum ?? null,
            lng: lngNum ?? null,
        };
        console.log('[POST /api/needs] input:', JSON.stringify(inputPayload));
        const need = await (0, needService_1.createNeedFromInput)(inputPayload.raw_text, {
            need_type: inputPayload.need_type,
            urgency: inputPayload.urgency,
            confidence: inputPayload.confidence,
        }, latNum, lngNum);
        console.log('[POST /api/needs] inserted row:', JSON.stringify(need));
        console.log('[POST /api/needs] inserted id (use this for matches):', need.id);
        return res.status(201).json(need);
    }
    catch (err) {
        console.error('POST /api/needs', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = paramId(req);
        if (!id) {
            return res.status(400).json({ error: 'id is required' });
        }
        console.log('[GET /api/needs/:id] lookup via getNeedById:', JSON.stringify(id));
        const need = await (0, needs_1.getNeedById)(id);
        if (!need) {
            return res.status(404).json({ error: 'Need not found' });
        }
        return res.json(need);
    }
    catch (err) {
        console.error('GET /api/needs/:id', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
