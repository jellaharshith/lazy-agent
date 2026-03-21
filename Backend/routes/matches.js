"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const needs_1 = require("../db/needs");
const matches_1 = require("../db/matches");
const matchService_1 = require("../services/matchService");
const needService_1 = require("../services/needService");
const resourceService_1 = require("../services/resourceService");
const router = (0, express_1.Router)();
/** UUID (8-4-4-4-12 hex), case-insensitive */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidNeedId(value) {
    if (typeof value !== 'string')
        return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && UUID_RE.test(trimmed);
}
router.get('/', (_req, res) => {
    try {
        res.status(200).json({
            message: 'Matches API',
            usage: {
                create: 'POST /api/matches — body: { needId } or { need_id } (use fetch/curl, not the address bar)',
            },
        });
    }
    catch (err) {
        console.error('[GET /api/matches] failed:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        res.status(500).json({ error: message });
    }
});
router.post('/', async (req, res) => {
    try {
        console.log('[POST /api/matches] incoming request body:', JSON.stringify(req.body ?? {}));
        const needIdRaw = req.body?.needId ?? req.body?.need_id;
        const parsedNeedId = typeof needIdRaw === 'string' && needIdRaw.trim() ? needIdRaw.trim() : undefined;
        console.log('[POST /api/matches] parsed needId:', parsedNeedId ?? '(missing or non-string)');
        if (!isValidNeedId(needIdRaw)) {
            return res.status(400).json({ error: 'Valid needId is required' });
        }
        const needId = needIdRaw.trim();
        const need = await (0, needs_1.getNeedById)(needId);
        console.log('[POST /api/matches] getNeedById result:', need ? JSON.stringify(need) : 'null');
        if (!need) {
            return res.status(404).json({ error: 'Need not found', needId });
        }
        const resources = await (0, resourceService_1.listAvailableResources)();
        console.log('[POST /api/matches] resource count:', resources.length);
        if (resources.length === 0) {
            return res.status(404).json({ error: 'No available resources found' });
        }
        const best = (0, matchService_1.findBestResourceForNeed)(need, resources);
        console.log('[POST /api/matches] best match:', best ? JSON.stringify(best) : 'null');
        if (!best) {
            return res.status(400).json({
                error: 'No valid match: need must have lat/lng, and at least one available resource with lat/lng and quantity > 0.',
            });
        }
        const createdMatch = await (0, matches_1.createMatch)({
            need_id: need.id,
            resource_id: best.resource.id,
            score: best.score,
            distance_km: best.distanceKm,
            status: 'suggested',
        });
        console.log('[POST /api/matches] created match:', JSON.stringify(createdMatch));
        const updatedNeed = await (0, needService_1.markNeedMatched)(need.id);
        return res.status(201).json({
            need: updatedNeed,
            bestMatch: {
                resource: best.resource,
                score: best.score,
                distanceKm: best.distanceKm,
            },
            createdMatch,
            updatedNeedStatus: updatedNeed.status,
        });
    }
    catch (err) {
        console.error('[POST /api/matches] failed:', err);
        const message = err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
