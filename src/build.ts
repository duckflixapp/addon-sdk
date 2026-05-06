#!/usr/bin/env bun

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import type { DuckflixAddonSdk } from './sdk';
import type { AddonManifest } from './types/addon.types';

export const defaultAddonBuildExternal = ['elysia', 'drizzle-orm', 'zod', 'axios', 'jsonwebtoken', 'argon2'] as const;

export type AddonBuildManifest = AddonManifest | DuckflixAddonSdk;

export type AddonBuildOptions = {
    entrypoints?: string[];
    outdir?: string;
    target?: Bun.Target;
    external?: string[];
    manifest?: AddonBuildManifest;
    manifestPath?: string;
};

type PackageJsonWithEntrypoints = {
    main?: unknown;
    module?: unknown;
};

type AddonBuildCliOptions = AddonBuildOptions & {
    manifestModule?: string;
    manifestExport?: string;
};

const getPackageEntrypoint = async (): Promise<string> => {
    const pkg = (await Bun.file(path.join(process.cwd(), 'package.json')).json()) as PackageJsonWithEntrypoints;
    const entrypoint = pkg.main ?? pkg.module;

    if (typeof entrypoint !== 'string' || entrypoint.length === 0) {
        throw new Error('Missing package.json "main" or "module" entrypoint.');
    }

    return entrypoint;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isAddonSdk = (value: unknown): value is DuckflixAddonSdk =>
    isRecord(value) && typeof value.generateManifest === 'function' && isRecord(value.manifest);

const isAddonManifest = (value: unknown): value is AddonManifest =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.runtime === 'string' &&
    typeof value.entry === 'string' &&
    Array.isArray(value.capabilities);

const writeManifest = async (manifest: AddonBuildManifest, outputPath: string): Promise<void> => {
    if (isAddonSdk(manifest)) {
        await manifest.generateManifest(outputPath);
        return;
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(manifest, null, 4)}\n`, 'utf8');
};

const loadManifestFromModule = async (modulePath: string, exportName?: string): Promise<AddonBuildManifest> => {
    const absoluteModulePath = path.resolve(process.cwd(), modulePath);
    const moduleExports = (await import(absoluteModulePath)) as Record<string, unknown>;
    const candidates = exportName
        ? [[exportName, moduleExports[exportName]] as const]
        : ([
              ['sdk', moduleExports.sdk],
              ['manifest', moduleExports.manifest],
              ['default', moduleExports.default],
          ] as const);

    for (const [name, value] of candidates) {
        if (isAddonSdk(value) || isAddonManifest(value)) {
            return value;
        }

        if (exportName === name) {
            throw new Error(`Export "${name}" from ${modulePath} is not an SDK instance or AddonManifest.`);
        }
    }

    throw new Error(`Could not find an SDK instance or AddonManifest export in ${modulePath}. Expected "sdk", "manifest", or "default".`);
};

export const buildAddon = async (options: AddonBuildOptions = {}): Promise<Bun.BuildOutput> => {
    const entrypoints = options.entrypoints ?? [await getPackageEntrypoint()];
    const outdir = options.outdir ?? './dist';
    const result = await Bun.build({
        entrypoints,
        outdir,
        target: options.target ?? 'bun',
        external: [...new Set([...defaultAddonBuildExternal, ...(options.external ?? [])])],
    });

    if (!result.success) {
        result.logs.forEach((log) => console.error(log));
        throw new Error('Duckflix addon build failed.');
    }

    result.outputs.forEach((output) => console.log(`✓ ${output.path}`));

    if (options.manifest) {
        const manifestPath = options.manifestPath ?? path.join(outdir, 'manifest.json');
        await writeManifest(options.manifest, manifestPath);
        console.log(`✓ ${manifestPath}`);
    }

    return result;
};

const printHelp = (): void => {
    console.log(`Usage: duckflix-addon-build [options]

Options:
  --entrypoint <path>        Entrypoint to bundle. Defaults to package.json main or module.
  --outdir <path>            Build output directory. Defaults to ./dist.
  --external <name>          Keep a package external. Can be repeated or comma-separated.
  --manifest [module]        Generate manifest.json from an SDK or manifest export. Defaults to the entrypoint.
  --manifest-export <name>   Export name to read from the manifest module. Defaults to sdk, manifest, then default.
  --manifest-path <path>     Manifest output path. Defaults to <outdir>/manifest.json.
  --help                     Show this message.
`);
};

const parseCliArgs = async (args: string[]): Promise<AddonBuildCliOptions | null> => {
    const options: AddonBuildCliOptions = {};
    let shouldLoadManifestFromEntrypoint = false;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        const next = args[index + 1];

        switch (arg) {
            case '--help':
            case '-h':
                printHelp();
                return null;
            case '--entrypoint':
                if (!next) throw new Error('--entrypoint requires a path.');
                options.entrypoints = [...(options.entrypoints ?? []), next];
                index += 1;
                break;
            case '--outdir':
                if (!next) throw new Error('--outdir requires a path.');
                options.outdir = next;
                index += 1;
                break;
            case '--external':
                if (!next) throw new Error('--external requires a package name.');
                options.external = [...(options.external ?? []), ...next.split(',').filter(Boolean)];
                index += 1;
                break;
            case '--manifest':
                if (next && !next.startsWith('-')) {
                    options.manifestModule = next;
                    index += 1;
                } else {
                    shouldLoadManifestFromEntrypoint = true;
                }
                break;
            case '--manifest-export':
                if (!next) throw new Error('--manifest-export requires an export name.');
                options.manifestExport = next;
                index += 1;
                break;
            case '--manifest-path':
                if (!next) throw new Error('--manifest-path requires a path.');
                options.manifestPath = next;
                index += 1;
                break;
            default:
                throw new Error(`Unknown option "${arg}".`);
        }
    }

    if (shouldLoadManifestFromEntrypoint && !options.manifestModule) {
        options.manifestModule = options.entrypoints?.[0] ?? (await getPackageEntrypoint());
    }

    if (options.manifestModule) {
        options.manifest = await loadManifestFromModule(options.manifestModule, options.manifestExport);
    }

    return options;
};

if (import.meta.main) {
    parseCliArgs(Bun.argv.slice(2))
        .then((options) => (options ? buildAddon(options) : undefined))
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
