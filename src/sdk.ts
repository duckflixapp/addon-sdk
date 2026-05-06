import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AddonCapability, AddonManifest, DuckflixAddonModule, VideoProcessorModule } from './types/addon.types';

export type SDKOptions<TCapabilities extends readonly AddonCapability[] = readonly AddonCapability[]> = Omit<
    AddonManifest,
    'capabilities'
> & {
    capabilities: TCapabilities;
};

type SDKManifestCapabilities = {
    capabilities: readonly AddonCapability[];
};

export type SDKCapabilityKinds<TManifest extends SDKManifestCapabilities> = readonly TManifest['capabilities'][number]['kind'][];

export interface DuckflixAddonSdk<TManifest extends SDKOptions = SDKOptions> {
    readonly manifest: TManifest;
    readonly capabilities: SDKCapabilityKinds<TManifest>;
    createModule(module: DuckflixAddonModule<SDKCapabilityKinds<TManifest>>): DuckflixAddonModule<SDKCapabilityKinds<TManifest>>;
    generateManifest(outputPath?: string): Promise<string>;
}

export class SDK<const TManifest extends SDKOptions> implements DuckflixAddonSdk<TManifest> {
    constructor(private readonly options: TManifest) {}

    public get manifest(): TManifest {
        return this.options;
    }

    public get capabilities(): SDKCapabilityKinds<TManifest> {
        return this.options.capabilities.map((capability) => capability.kind) as SDKCapabilityKinds<TManifest>;
    }

    public createModule(module: DuckflixAddonModule<SDKCapabilityKinds<TManifest>>): DuckflixAddonModule<SDKCapabilityKinds<TManifest>> {
        return module;
    }

    public async generateManifest(outputPath = './dist/manifest.json'): Promise<string> {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, `${JSON.stringify(this.options, null, 4)}\n`, 'utf8');

        return outputPath;
    }
}

export const videoProcessor = <TModule extends VideoProcessorModule>(module: TModule): TModule => module;
