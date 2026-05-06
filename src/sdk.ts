import type { AddonKind, DuckflixAddonModule, VideoProcessorModule } from './types/addon.types';

export type SDKOptions<TCapabilities extends readonly AddonKind[]> = {
    capabilities: TCapabilities;
};

export interface DuckflixAddonSdk<TCapabilities extends readonly AddonKind[] = readonly AddonKind[]> {
    readonly capabilities: TCapabilities;
    createModule(module: DuckflixAddonModule<TCapabilities>): DuckflixAddonModule<TCapabilities>;
}

export class SDK<const TCapabilities extends readonly AddonKind[]> implements DuckflixAddonSdk<TCapabilities> {
    constructor(private readonly options: SDKOptions<TCapabilities>) {}

    public get capabilities(): TCapabilities {
        return this.options.capabilities;
    }

    public createModule(module: DuckflixAddonModule<TCapabilities>): DuckflixAddonModule<TCapabilities> {
        return module;
    }
}

export const videoProcessor = <TModule extends VideoProcessorModule>(module: TModule): TModule => module;
