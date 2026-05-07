export type AddonPermission = 'network' | 'filesystem:job' | 'p2p';
export type AddonKind = 'video.processor';
export type AddonRuntimeKind = 'bun';
export type VideoProcessorInitialStatus = 'processing' | 'downloading';
export type VideoProcessorSourceType = 'file' | 'text';
export type VideoType = 'movie' | 'episode';

export type AddonWorkspace = {
    id: string;
    addonId: string;
    kind: AddonKind;
    root: string;
    inputDir: string;
    workDir: string;
    outputDir: string;
};

export type VideoProcessorCapability = {
    kind: 'video.processor';
    processor: {
        id: string;
        initialStatus?: VideoProcessorInitialStatus;
        sourceTypes: VideoProcessorSourceType[];
    };
};

export type AddonCapability = VideoProcessorCapability;

export type AddonManifest = {
    id: string;
    name: string;
    version: string;
    runtime: AddonRuntimeKind;
    entry: string;
    description?: string;
    publisher?: string;
    capabilities: AddonCapability[];
    permissions?: AddonPermission[];
};

export type RawVideoProcessorSource =
    | {
          sourceType: 'file';
          file: File;
      }
    | {
          sourceType: 'text';
          value: string;
      };

export type PreparedVideoProcessorSource =
    | {
          sourceType: 'file';
          file: File;
          tempPath: string;
      }
    | {
          sourceType: 'text';
          value: string;
      };

export type MovieMetadata = {
    type: 'movie';
    title: string;
    overview?: string | null;
    releaseYear?: number | null;
    posterUrl?: string | null;
    bannerUrl?: string | null;
    genres: string[];
    rating: number | null;
    runtime?: number | null;
    imdbId: string | null;
    tmdbId: number;
};

export type EpisodeMetadata = {
    type: 'episode';
    name: string;
    overview?: string | null;
    airDate?: Date | null;
    runtime?: number | null;
    rating: number | null;
    stillUrl?: string | null;
    imdbId: string | null;
    tmdbId: number | null;
    tmdbShowId: number;
    seasonNumber: number;
    episodeNumber: number;
};

export type SeriesMetadata = {
    type: 'series';
    title: string;
    overview?: string | null;
    posterUrl?: string | null;
    bannerUrl?: string | null;
    genres: string[];
    rating: number | null;
    imdbId: string | null;
    tmdbShowId: number;
    seasonCount: number;
    episodeCount: number;
};

export type SeasonMetadata = {
    type: 'season';
    name: string;
    overview?: string | null;
    airDate?: Date | null;
    posterUrl?: string | null;
    rating: number | null;
    imdbId: string | null;
    tmdbId: number | null;
    tmdbShowId: number;
    seasonNumber: number;
    episodeCount: number;
};

export type VideoMetadata = MovieMetadata | EpisodeMetadata;
export type MetadataResolveResult = VideoMetadata | SeriesMetadata | SeasonMetadata;

export type MetadataResolveInput = {
    dbUrl: string;
    requestedType?: VideoType;
};

export type MetadataHost = {
    resolve(input: MetadataResolveInput): Promise<MetadataResolveResult | null>;
};

export type AddonHost = {
    metadata: MetadataHost;
};

export type VideoProcessorScanInput = {
    source: PreparedVideoProcessorSource;
    requestedType: VideoType;
    dbUrl?: string;
};

export type VideoProcessorScanItem = {
    id: string;
    source: PreparedVideoProcessorSource;
    requestedType?: VideoType;
    title?: string;
    metadata?: VideoMetadata | null;
};

export type VideoProcessorIdentifyInput = {
    source: PreparedVideoProcessorSource;
    requestedType: VideoType;
    dbUrl?: string;
};

export type VideoProcessorStartItem = {
    id: string;
    videoId: string;
    metadata: VideoMetadata;
    source: PreparedVideoProcessorSource;
};

export type VideoProcessorStartInput = {
    source: PreparedVideoProcessorSource;
    items: VideoProcessorStartItem[];
};

export type VideoProcessorStartOutputItem = {
    id: string;
    path: string;
    fileName: string;
    fileSize: number;
};

export type VideoProcessorStartOutput = VideoProcessorStartOutputItem[];

export type DownloadProgress = {
    percent: number;
    speed: string;
    eta: string;
    peers: {
        active: number;
        total: number;
        connecting: number;
    };
};

export type JobProgress = {
    time: string;
    seconds: number;
    progress: number;
};

export type VideoProcessorEvent =
    | {
          type: 'progress';
          phase: 'downloading' | 'processing';
          progress: JobProgress | DownloadProgress | undefined;
      }
    | {
          type: 'status';
          status: 'started' | 'downloaded' | 'completed' | 'canceled' | 'error';
          title: string;
          message: string;
      }
    | {
          type: 'log';
          level: 'debug' | 'info' | 'warn' | 'error';
          message: string;
          data?: Record<string, unknown>;
      };

export type CancellableDownload = {
    cancel(): Promise<void> | void;
};

export type AddonErrorOptions = {
    cause?: unknown;
    statusCode?: number;
    headers?: Record<string, string>;
    details?: Record<string, unknown>;
};

export type AddonErrorFactory = (message: string, options?: AddonErrorOptions) => Error;

export type VideoProcessorContext = {
    host: AddonHost;
    error: AddonErrorFactory;
    workspace?: AddonWorkspace;
    emit(event: VideoProcessorEvent): Promise<void> | void;
    download: {
        register: (process: CancellableDownload) => unknown;
        unregister: () => unknown;
    };
    signal?: AbortSignal;
};

export type VideoProcessorModule = {
    validateSource(source: RawVideoProcessorSource, context: VideoProcessorContext): Promise<void> | void;
    scan(input: VideoProcessorScanInput, context: VideoProcessorContext): Promise<VideoProcessorScanItem[]> | VideoProcessorScanItem[];
    identify?(input: VideoProcessorIdentifyInput, context: VideoProcessorContext): Promise<VideoMetadata | null> | VideoMetadata | null;
    start(input: VideoProcessorStartInput, context: VideoProcessorContext): Promise<VideoProcessorStartOutput> | VideoProcessorStartOutput;
};

export type DuckflixCapabilityModuleMap = {
    'video.processor': VideoProcessorModule;
};

export type DuckflixAddonCapabilities<TCapabilities extends readonly AddonKind[] = readonly AddonKind[]> = {
    [TKind in TCapabilities[number]]: DuckflixCapabilityModuleMap[TKind];
};

export type DuckflixAddonModule<TCapabilities extends readonly AddonKind[] = readonly AddonKind[]> = {
    capabilities: DuckflixAddonCapabilities<TCapabilities>;
};

export type AnyDuckflixAddonModule = {
    capabilities: Partial<DuckflixCapabilityModuleMap>;
};
