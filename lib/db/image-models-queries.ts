/**
 * Legacy compatibility layer for image models
 * Re-exports from unified models-cache system
 */
export {
	getImageModelsLegacy as getImageModels,
	invalidateModelsCache as invalidateImageModelsCache,
} from "./models-cache";
