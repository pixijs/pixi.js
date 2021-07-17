import { TYPES, MIPMAP_MODES, ALPHA_MODES, FORMATS, INTERNAL_FORMATS } from '@pixi/constants';
import { BaseTexture, BufferResource, Texture } from '@pixi/core';
import { CompressedTextureResource } from '@pixi/compressed-textures';
import {
    BASIS_FORMATS,
    BASIS_FORMAT_TO_INTERNAL_FORMAT,
    INTERNAL_FORMAT_TO_BASIS_FORMAT,
    BASIS_FORMATS_ALPHA,
    BasisTextureExtensions,
    BasisBinding,
    BASIS_FORMAT_TO_TYPE
} from './Basis';
import { TranscoderWorker } from './TranscoderWorker';
import { LoaderResource } from '@pixi/loaders';

import type { ILoaderResource, IResourceMetadata } from '@pixi/loaders';
import type { CompressedLevelBuffer } from '@pixi/compressed-textures';

type TranscodedResourcesArray = (Array<CompressedTextureResource> | Array<BufferResource>) & {
    basisFormat: BASIS_FORMATS
};

/**
 * Result when calling registerCompressedTextures.
 * @ignore
 */
 type BasisTexturesResult = Pick<ILoaderResource, 'textures' | 'texture'>;

LoaderResource.setExtensionXhrType('basis', LoaderResource.XHR_RESPONSE_TYPE.BUFFER);

/**
 * Loader plugin for handling BASIS supercompressed texture files.
 *
 * To use this loader, you must bind the basis_universal WebAssembly transcoder. There are two ways of
 * doing this:
 *
 * 1. Adding a &lt;script&gt; tag to your HTML page to the transcoder bundle in this package, and serving
 * the WASM binary from the same location.
 *
 * ```js
 * // Copy ./node_modules/@pixi/basis/assets/basis_.wasm into your assets directory
 * // as well, so it is served from the same folder as the JavaScript!
 * &lt;script src="./node_modules/@pixi/basis/assets/basis_transcoder.js" /&gt;
 * ```
 *
 * NOTE: `basis_transcoder.js` expects the WebAssembly binary to be named `basis_transcoder.wasm`.
 * NOTE-2: This method supports transcoding on the main-thread. Only use this if you have 1 or 2 *.basis
 * files.
 *
 * 2. Loading the transcoder source from a URL.
 *
 * ```js
 * // Use this if you to use the default CDN url for @pixi/basis
 * BasisLoader.loadTranscoder();
 *
 * // Use this if you want to serve the transcoder on your own
 * BasisLoader.loadTranscoder('./basis_transcoder.js', './basis_transcoder.wasm');
 * ```
 *
 * NOTE: This can only be used with web-workers.
 *
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
export class BasisLoader
{
    private static basisBinding: BasisBinding;
    private static defaultRGBFormat: { basisFormat: BASIS_FORMATS, textureFormat: INTERNAL_FORMATS | TYPES };
    private static defaultRGBAFormat: { basisFormat: BASIS_FORMATS, textureFormat: INTERNAL_FORMATS | TYPES };
    private static fallbackMode = false;
    private static workerPool: TranscoderWorker[] = [];

    /**
     * Transcodes the *.basis data when the data is loaded. If the transcoder is not bound yet, it
     * will hook transcoding to {@link BasisResource#onTranscoderInitialized}.
     *
     * @see PIXI.Loader.loaderMiddleware
     * @param resource - loader resource that is checked to see if it is a basis file
     * @param next - callback Function to call when done
     */
    public static use(resource: ILoaderResource, next: (...args: any[]) => void): void
    {
        if (resource.extension === 'basis' && resource.data)
        {
            if (!!BasisLoader.basisBinding || (!!BasisLoader.TranscoderWorker.wasmSource))
            {
                BasisLoader.transcode(resource, next);
            }
            else
            {
                TranscoderWorker.onTranscoderInitialized.add(() =>
                {
                    BasisLoader.transcode(resource, next);
                });
            }
        }
        else
        {
            next();
        }
    }

    /**
     * Runs transcoding and populates {@link imageArray}. It will run the transcoding in a web worker
     * if they are available.
     *
     * @private
     */
    private static async transcode(resource: ILoaderResource, next: (...args: any[]) => void): Promise<void>
    {
        try
        {
            const data: ArrayBuffer = resource.data;
            let resources: TranscodedResourcesArray;

            if (typeof Worker !== 'undefined' && BasisLoader.TranscoderWorker.wasmSource)
            {
                resources = await BasisLoader.transcodeAsync(data);
            }
            else
            {
                resources = BasisLoader.transcodeSync(data);
            }

            Object.assign(resource, BasisLoader.registerTextures(
                resource.url,
                resources,
                resource.metadata
            ));
        }
        catch (err)
        {
            next(err);

            return;
        }

        next();
    }

    /**
     * Creates textures and adds them to the texture cache
     * @private
     * @param url - url of the texture to be used as its ID for the texture cache
     * @param resources - the transcoded resources
     * @param metadata - resource metadata
     */
    private static registerTextures(
        url: string,
        resources: TranscodedResourcesArray,
        metadata: IResourceMetadata
    ): BasisTexturesResult
    {
        const result: BasisTexturesResult = {
            textures: {},
            texture: null,
        };

        if (!resources)
        {
            return result;
        }

        // Should be a valid TYPES, FORMATS for uncompressed basis formats
        const type: TYPES = BASIS_FORMAT_TO_TYPE[resources.basisFormat];
        const format: FORMATS = resources.basisFormat !== BASIS_FORMATS.cTFRGBA32 ? FORMATS.RGB : FORMATS.RGBA;
        const resourceList = resources as Array<CompressedTextureResource | BufferResource>;

        const textures = resourceList.map((resource) =>
            (
                new Texture(new BaseTexture(resource, Object.assign({
                    mipmap: resource instanceof CompressedTextureResource && resource.levels > 1
                        ? MIPMAP_MODES.ON_MANUAL
                        : MIPMAP_MODES.OFF,
                    alphaMode: ALPHA_MODES.NO_PREMULTIPLIED_ALPHA,
                    type,
                    format
                }, metadata)))
            ));

        textures.forEach((texture: Texture, i: number) =>
        {
            const { baseTexture } = texture;
            const cacheID = `${url}-${i + 1}`;

            BaseTexture.addToCache(baseTexture, cacheID);
            Texture.addToCache(texture, cacheID);

            if (i === 0)
            {
                BaseTexture.addToCache(baseTexture, url);
                Texture.addToCache(texture, url);
                result.texture = texture;
            }

            result.textures[cacheID] = texture;
        });

        return result;
    }

    /**
     * Finds a suitable worker for transcoding and sends a transcoding request
     *
     * @private
     * @async
     */
    private static async transcodeAsync(arrayBuffer: ArrayBuffer): Promise<TranscodedResourcesArray>
    {
        const workerPool = BasisLoader.workerPool;

        let leastLoad = 0x10000000;
        let worker = null;

        for (let i = 0, j = workerPool.length; i < j; i++)
        {
            if (workerPool[i].load < leastLoad)
            {
                worker = workerPool[i];
                leastLoad = worker.load;
            }
        }

        if (!worker)
        {
            /* eslint-disable-next-line no-use-before-define */
            worker = new TranscoderWorker();

            workerPool.push(worker);
        }

        // Wait until worker is ready
        await worker.initAsync();

        const response = await worker.transcodeAsync(
            new Uint8Array(arrayBuffer),
            BasisLoader.defaultRGBAFormat.basisFormat,
            BasisLoader.defaultRGBFormat.basisFormat
        );

        const basisFormat = response.basisFormat;
        const imageArray = response.imageArray;

        // whether it is an uncompressed format
        const fallbackMode = basisFormat > 12;
        let imageResources: TranscodedResourcesArray;

        if (!fallbackMode)
        {
            const format = BASIS_FORMAT_TO_INTERNAL_FORMAT[response.basisFormat];

            // HINT: this.imageArray is CompressedTextureResource[]
            imageResources = new Array<CompressedTextureResource>(imageArray.length) as TranscodedResourcesArray;

            for (let i = 0, j = imageArray.length; i < j; i++)
            {
                imageResources[i] = new CompressedTextureResource(null, {
                    format,
                    width: imageArray[i].width,
                    height: imageArray[i].height,
                    levelBuffers: imageArray[i].levelArray,
                    levels: imageArray[i].levelArray.length
                });
            }
        }
        else
        {
            // TODO: BufferResource does not support manual mipmapping.
            imageResources = imageArray.map((image) => new BufferResource(
                new Uint16Array(image.levelArray[0].levelBuffer.buffer), {
                    width: image.width,
                    height: image.height
                })
            ) as TranscodedResourcesArray;
        }

        imageResources.basisFormat = basisFormat;

        return imageResources;
    }

    /**
     * Runs transcoding on the main thread.
     *
     * @private
     */
    private static transcodeSync(arrayBuffer: ArrayBuffer): TranscodedResourcesArray
    {
        const BASIS = BasisLoader.basisBinding;

        const data = new Uint8Array(arrayBuffer);
        const basisFile = new BASIS.BasisFile(data);
        const imageCount = basisFile.getNumImages();
        const hasAlpha = basisFile.getHasAlpha();

        const basisFormat = hasAlpha
            ? BasisLoader.defaultRGBAFormat.basisFormat
            : BasisLoader.defaultRGBFormat.basisFormat;
        const basisFallbackFormat = BASIS_FORMATS.cTFRGB565;
        const imageResources = new Array<CompressedTextureResource | BufferResource>(imageCount);

        let fallbackMode = BasisLoader.fallbackMode;

        if (!basisFile.startTranscoding())
        {
            // #if _DEBUG
            console.error(`Basis failed to start transcoding!`);
            // #endif

            basisFile.close();
            basisFile.delete();

            return null;
        }

        for (let i = 0; i < imageCount; i++)
        {
            // Don't transcode all mipmap levels in fallback mode!
            const levels = !fallbackMode ? basisFile.getNumLevels(i) : 1;
            const width = basisFile.getImageWidth(i, 0);
            const height = basisFile.getImageHeight(i, 0);
            const alignedWidth = (width + 3) & ~3;
            const alignedHeight = (height + 3) & ~3;

            const imageLevels = new Array<CompressedLevelBuffer>(levels);

            // Transcode mipmap levels into "imageLevels"
            for (let j = 0; j < levels; j++)
            {
                const levelWidth = basisFile.getImageWidth(i, j);
                const levelHeight = basisFile.getImageHeight(i, j);
                const byteSize = basisFile.getImageTranscodedSizeInBytes(
                    i, 0, !fallbackMode ? basisFormat : basisFallbackFormat);

                imageLevels[j] = {
                    levelID: j,
                    levelBuffer: new Uint8Array(byteSize),
                    levelWidth,
                    levelHeight,
                };

                if (!basisFile.transcodeImage(
                    imageLevels[j].levelBuffer, i, 0, !fallbackMode ? basisFormat : basisFallbackFormat, false, false))
                {
                    if (fallbackMode)
                    {
                        // #if _DEBUG
                        console.error(`Basis failed to transcode image ${i}, level ${0}!`);
                        // #endif
                        break;
                    }
                    else
                    {
                        // Try transcoding to an uncompressed format before giving up!
                        // NOTE: We must start all over again as all Resources must be in compressed OR uncompressed.
                        i = -1;
                        fallbackMode = true;

                        // #if _DEBUG
                        /* eslint-disable-next-line max-len */
                        console.warn(`Basis failed to transcode image ${i}, level ${0} to a compressed texture format. Retrying to an uncompressed fallback format!`);
                        // #endif
                        continue;
                    }
                }
            }

            let imageResource;

            if (!fallbackMode)
            {
                imageResource = new CompressedTextureResource(null, {
                    format: BASIS_FORMAT_TO_INTERNAL_FORMAT[basisFormat],
                    width: alignedWidth,
                    height: alignedHeight,
                    levelBuffers: imageLevels,
                    levels
                });
            }
            else
            {
                // TODO: BufferResource doesn't support manual mipmap levels
                imageResource = new BufferResource(
                    new Uint16Array(imageLevels[0].levelBuffer.buffer), { width, height });
            }

            imageResources[i] = imageResource;
        }

        basisFile.close();
        basisFile.delete();

        const transcodedResources = imageResources as TranscodedResourcesArray;

        transcodedResources.basisFormat = !fallbackMode ? basisFormat : basisFallbackFormat;

        return transcodedResources;
    }

    /**
     * Detects the available compressed texture formats on the device.
     *
     * @param extensions - extensions provided by a WebGL context
     * @ignore
     */
    static autoDetectFormats(extensions?: Partial<BasisTextureExtensions>): void
    {
        // Auto-detect WebGL compressed-texture extensions
        if (!extensions)
        {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');

            if (!gl)
            {
                console.error('WebGL not available for BASIS transcoding. Silently failing.');

                return;
            }

            extensions = {
                s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc'),
                s3tc_sRGB: gl.getExtension('WEBGL_compressed_texture_s3tc_srgb'), /* eslint-disable-line camelcase */
                etc: gl.getExtension('WEBGL_compressed_texture_etc'),
                etc1: gl.getExtension('WEBGL_compressed_texture_etc1'),
                pvrtc: gl.getExtension('WEBGL_compressed_texture_pvrtc')
                    || gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc'),
                atc: gl.getExtension('WEBGL_compressed_texture_atc'),
                astc: gl.getExtension('WEBGL_compressed_texture_astc')
            };
        }

        // Discover the available texture formats
        const supportedFormats: { [id: string]: INTERNAL_FORMATS } = {};

        for (const key in extensions)
        {
            const extension = (extensions as any)[key];

            if (!extension)
            {
                continue;
            }

            Object.assign(supportedFormats, Object.getPrototypeOf(extension));
        }

        // Set the default alpha/non-alpha output formats for basisu transcoding
        for (let i = 0; i < 2; i++)
        {
            const detectWithAlpha = !!i;
            let internalFormat: number;
            let basisFormat: number;

            for (const id in supportedFormats)
            {
                internalFormat = supportedFormats[id];
                basisFormat = INTERNAL_FORMAT_TO_BASIS_FORMAT[internalFormat];

                if (basisFormat !== undefined)
                {
                    if ((detectWithAlpha && BASIS_FORMATS_ALPHA[basisFormat])
                        || (!detectWithAlpha && !BASIS_FORMATS_ALPHA[basisFormat]))
                    {
                        break;
                    }
                }
            }

            if (internalFormat)
            {
                BasisLoader[detectWithAlpha ? 'defaultRGBAFormat' : 'defaultRGBFormat'] = {
                    textureFormat: internalFormat,
                    basisFormat,
                };
            }
            else
            {
                BasisLoader[detectWithAlpha ? 'defaultRGBAFormat' : 'defaultRGBFormat'] = {
                    textureFormat: TYPES.UNSIGNED_SHORT_5_6_5,
                    basisFormat: BASIS_FORMATS.cTFRGB565
                };

                BasisLoader.fallbackMode = true;
            }
        }
    }

    /**
     * Binds the basis_universal transcoder to decompress *.basis files. You must initialize the transcoder library yourself.
     *
     * ```js
     * import { BasisLoader } from '@pixi/basis';
     * import { Loader } from '@pixi/loaders';
     *
     * // window.BASIS() returns a Promise-like object
     * window.BASIS().then((basisLibrary) =>
     * {
     *     // Initialize basis-library; otherwise, transcoded results maybe corrupt!
     *     basisLibrary.initializeBasis();
     *
     *     // Bind BasisLoader to the transcoder
     *     BasisLoader.bindTranscoder(basisLibrary);
     * });
     * ```
     *
     * @param basisLibrary - the initialized transcoder library
     * @private
     */
    static bindTranscoder(basisLibrary: BasisBinding): void
    {
        BasisLoader.basisBinding = basisLibrary;
    }

    /**
     * Loads the transcoder source code for use in {@link PIXI.BasisLoader.TranscoderWorker}.
     *
     * @private
     * @param jsURL - URL to the javascript basis transcoder
     * @param wasmURL - URL to the wasm basis transcoder
     */
    static loadTranscoder(jsURL: string, wasmURL: string): Promise<[void, void]>
    {
        return BasisLoader.TranscoderWorker.loadTranscoder(jsURL, wasmURL);
    }

    /**
     * Set the transcoder source code directly
     *
     * @private
     * @param jsSource - source for the javascript basis transcoder
     * @param wasmSource - source for the wasm basis transcoder
     */
    static setTranscoder(jsSource: string, wasmSource: ArrayBuffer): void
    {
        BasisLoader.TranscoderWorker.setTranscoder(jsSource, wasmSource);
    }

    static TranscoderWorker: typeof TranscoderWorker = TranscoderWorker;

    static get TRANSCODER_WORKER_POOL_LIMIT(): number
    {
        return this.workerPool.length || 1;
    }

    static set TRANSCODER_WORKER_POOL_LIMIT(limit: number)
    {
        // TODO: Destroy workers?
        for (let i = this.workerPool.length; i < limit; i++)
        {
            this.workerPool[i] = new TranscoderWorker();
            this.workerPool[i].initAsync();
        }
    }
}

// Auto-detect compressed texture formats once @pixi/basis is imported!
BasisLoader.autoDetectFormats();
