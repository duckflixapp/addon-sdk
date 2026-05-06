# Duckflix Addon SDK

Type-safe helpers and public contracts for building Duckflix addons.

This package is intentionally small. It does not run addons, load manifests, or provide host-side registry logic. It only gives addon authors the types and builder helpers needed to export modules that Duckflix can load.

## Installation

```bash
bun add addon-sdk
```

If the package is published under a scoped name later, replace `addon-sdk` with that package name in the examples below.

## Quick Start

```ts
import { SDK, videoProcessor } from 'addon-sdk';

const sdk = new SDK({
    capabilities: ['video.processor'] as const,
});

export default sdk.createModule({
    capabilities: {
        'video.processor': videoProcessor({
            validateSource(source) {
                if (source.sourceType !== 'file') {
                    throw Object.assign(new Error('Only file sources are supported'), { statusCode: 400 });
                }
            },

            async identify(input) {
                return {
                    type: 'movie',
                    title: input.source.sourceType === 'file' ? input.source.file.name : input.source.value,
                    overview: 'Identified by a Duckflix addon.',
                    releaseYear: 2026,
                    genres: ['Addon'],
                    rating: null,
                    imdbId: null,
                    tmdbId: 1,
                };
            },

            async start(input, context) {
                context.emit({
                    type: 'log',
                    level: 'info',
                    message: 'Starting addon processing',
                });

                if (input.source.sourceType !== 'file') {
                    throw Object.assign(new Error('Only file sources are supported'), { statusCode: 400 });
                }

                return {
                    path: input.source.tempPath,
                    fileName: input.source.file.name,
                    fileSize: input.source.file.size,
                };
            },
        }),
    },
});
```

## Manifest

Duckflix reads addon metadata from `manifest.json`. The manifest declares what the host should register and what permissions the addon requests.

```json
{
    "id": "example-video-addon",
    "name": "Example Video Addon",
    "version": "0.1.0",
    "runtime": "bun",
    "entry": "main.ts",
    "permissions": ["filesystem:job"],
    "capabilities": [
        {
            "kind": "video.processor",
            "processor": {
                "id": "example-video-addon",
                "initialStatus": "processing",
                "sourceTypes": ["file"]
            }
        }
    ]
}
```

The manifest and module export should agree. If the manifest declares `video.processor`, the default export should contain `capabilities['video.processor']`.

## API

### `new SDK(options)`

Creates a module builder for the capabilities your addon declares.

```ts
const sdk = new SDK({
    capabilities: ['video.processor'] as const,
});
```

Use `as const` so TypeScript keeps the exact capability names and `createModule` can require the matching implementations.

### `sdk.createModule(module)`

Returns the module unchanged, while type-checking that it implements the configured capabilities.

```ts
export default sdk.createModule({
    capabilities: {
        'video.processor': videoProcessor({
            validateSource() {},
            start() {
                return { path: '', fileName: '', fileSize: 0 };
            },
        }),
    },
});
```

### `videoProcessor(module)`

Type-checks a video processor implementation and returns it unchanged.

Required methods:

- `validateSource(source)`
- `start(input, context)`

Optional methods:

- `identify(input)`

## Type Imports

Runtime helpers are exported from the package root:

```ts
import { SDK, videoProcessor } from 'addon-sdk';
```

Public types can be imported from the root or from the types subpath:

```ts
import type { VideoProcessorModule, AddonManifest } from 'addon-sdk/types';
```

The `addon-sdk/types` subpath is useful when an addon only needs types and does not need runtime helpers.

## Module Shape

Duckflix expects Bun/Node-style addons to export a namespaced capability object:

```ts
export default {
    capabilities: {
        'video.processor': {
            validateSource() {},
            start() {
                return { path: '', fileName: '', fileSize: 0 };
            },
        },
    },
};
```

Using `SDK` and `videoProcessor` is recommended because it preserves this runtime shape while adding TypeScript safety.

## Notes

- This SDK only defines the public addon contract.
- Host internals such as addon loading, registries, runners, workspaces, and permission enforcement live in Duckflix backend.
- WASI addons may use a different runtime binding model in the future. This SDK currently targets Bun/Node-style TypeScript addons.
