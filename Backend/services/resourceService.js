"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAvailableResources = listAvailableResources;
exports.createNewResource = createNewResource;
const resources_1 = require("../db/resources");
async function listAvailableResources() {
    return (0, resources_1.getAvailableResources)();
}
async function createNewResource(input) {
    return (0, resources_1.createResource)(input);
}
