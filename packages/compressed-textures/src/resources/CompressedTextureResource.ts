import { BlobResource } from './BlobResource';
import { INTERNAL_FORMAT_TO_BYTES_PER_PIXEL } from '../const';
import { Renderer, BaseTexture, GLTexture } from '@pixi/core';

import type { INTERNAL_FORMATS } from '@pixi/constants';

/**
 * @ignore
 */
// Used in PIXI.KTXLoader
export type CompressedLevelBuffer = {
    levelID: number,
    levelWidth: number,
    levelHeight: number,
    levelBuffer: Uint8Array
};

/**
 * @ignore
 */
export interface ICompressedTextureResourceOptions
{
    format: INTERNAL_FORMATS;
    width: number;
    height: number;
    levels?: number;
    levelBuffers?: CompressedLevelBuffer[];
}

/**
 * Resource for compressed texture formats, as follows: S3TC/DXTn (& their sRGB formats), ATC, ASTC, ETC 1/2, PVRTC.
 *
 * Compressed textures improve performance when rendering is texture-bound. The texture data stays compressed in
 * graphics memory, increasing memory locality and speeding up texture fetches. These formats can also be used to store
 * more detail in the same amount of memory.
 *
 * For most developers, container file formats are a better abstraction instead of directly handling raw texture
 * data. PixiJS provides native support for the following texture file formats (via {@link PIXI.Loader}):
 *
 * * **.dds** - the DirectDraw Surface file format stores DXTn (DXT-1,3,5) data. See {@link PIXI.DDSLoader}
 * * **.ktx** - the Khronos Texture Container file format supports storing all the supported WebGL compression formats.
 *  See {@link PIXI.KTXLoader}.
 * * **.basis** - the BASIS supercompressed file format stores texture data in an internal format that is transcoded
 *  to the compression format supported on the device at _runtime_. It also supports transcoding into a uncompressed
 *  format as a fallback; you must install the `@pixi/basis-loader`, `@pixi/basis-transcoder` packages separately to
 *  use these files. See {@link PIXI.BasisLoader}.
 *
 * The loaders for the aforementioned formats use `CompressedTextureResource` internally. It is strongly suggested that
 * they be used instead.
 *
 * ## Working directly with CompressedTextureResource
 *
 * Since `CompressedTextureResource` inherits `BlobResource`, you can provide it a URL pointing to a file containing
 * the raw texture data (with no file headers!):
 *
 * ```js
 * // The resource backing the texture data for your textures.
 * // NOTE: You can also provide a ArrayBufferView instead of a URL. This is used when loading data from a container file
 * //   format such as KTX, DDS, or BASIS.
 * const compressedResource = new PIXI.CompressedTextureResource("bunny.dxt5", {
 *   format: PIXI.INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
 *   width: 256,
 *   height: 256
 * });
 *
 * // You can create a base-texture to the cache, so that future `Texture`s can be created using the `Texture.from` API.
 * const baseTexture = new PIXI.BaseTexture(compressedResource, { pmaMode: PIXI.ALPHA_MODES.NPM });
 *
 * // Create a Texture to add to the TextureCache
 * const texture = new PIXI.Texture(baseTexture);
 *
 * // Add baseTexture & texture to the global texture cache
 * PIXI.BaseTexture.addToCache(baseTexture, "bunny.dxt5");
 * PIXI.Texture.addToCache(texture, "bunny.dxt5");
 * ```
 *
 * @memberof PIXI
 */
export class CompressedTextureResource extends BlobResource
{
    /** The compression format */
    public format: INTERNAL_FORMATS;
    /**
     * The number of mipmap levels stored in the resource buffer.
     * @default 1
     */
    public levels: number;

    // Easy access to the WebGL extension providing support for the compression format via ContextSystem
    private _extension: 's3tc' | 's3tc_sRGB' | 'atc' | 'astc' | 'etc' | 'etc1' | 'pvrtc';
    // Buffer views for each mipmap level in the main buffer
    private _levelBuffers: CompressedLevelBuffer[];

    /**
     * @param source - the buffer/URL holding the compressed texture data
     * @param options
     * @param {PIXI.INTERNAL_FORMATS} options.format - the compression format
     * @param {number} options.width - the image width in pixels.
     * @param {number} options.height - the image height in pixels.
     * @param {number} [options.level=1] - the mipmap levels stored in the compressed texture, including level 0.
     * @param {number} [options.levelBuffers] - the buffers for each mipmap level. `CompressedTextureResource` can allows you
     *      to pass `null` for `source`, for cases where each level is stored in non-contiguous memory.
     */
    constructor(source: string | Uint8Array | Uint32Array, options: ICompressedTextureResourceOptions)
    {
        super(source, options);

        this.format = options.format;
        this.levels = options.levels || 1;

        this._width = options.width;
        this._height = options.height;

        this._extension = CompressedTextureResource._formatToExtension(this.format);

        if (options.levelBuffers || this.buffer)
        {
            // ViewableBuffer doesn't support byteOffset :-( so allow source to be Uint8Array
            this._levelBuffers = options.levelBuffers
                || CompressedTextureResource._createLevelBuffers(
                    source instanceof Uint8Array ? source : this.buffer.uint8View,
                    this.format,
                    this.levels,
                    4, 4, // PVRTC has 8x4 blocks in 2bpp mode
                    this.width,
                    this.height);
        }
    }

    /**
     * @override
     * @param renderer - A reference to the current renderer
     * @param _texture - the texture
     * @param _glTexture - texture instance for this webgl context
     */
    upload(renderer: Renderer, _texture: BaseTexture, _glTexture: GLTexture): boolean
    {
        const gl = renderer.gl;
        const extension = renderer.context.extensions[this._extension];

        if (!extension)
        {
            throw new Error(`${this._extension} textures are not supported on the current machine`);
        }
        if (!this._levelBuffers)
        {
            // Do not try to upload data before BlobResource loads, unless the levelBuffers were provided directly!
            return false;
        }

        for (let i = 0, j = this.levels; i < j; i++)
        {
            const { levelID, levelWidth, levelHeight, levelBuffer } = this._levelBuffers[i];

            gl.compressedTexImage2D(gl.TEXTURE_2D, levelID, this.format, levelWidth, levelHeight, 0, levelBuffer);
        }

        return true;
    }

    /** @protected */
    protected onBlobLoaded(): void
    {
        this._levelBuffers = CompressedTextureResource._createLevelBuffers(
            this.buffer.uint8View,
            this.format,
            this.levels,
            4, 4, // PVRTC has 8x4 blocks in 2bpp mode
            this.width,
            this.height);
    }

    /**
     * Returns the key (to ContextSystem#extensions) for the WebGL extension supporting the compression format
     *
     * @private
     * @param format - the compression format to get the extension for.
     */
    private static _formatToExtension(format: INTERNAL_FORMATS):
        's3tc' | 's3tc_sRGB' | 'atc' |
        'astc' | 'etc' | 'etc1' | 'pvrtc'
    {
        if (format >= 0x83F0 && format <= 0x83F3)
        {
            return 's3tc';
        }
        else if (format >= 0x9270 && format <= 0x9279)
        {
            return 'etc';
        }
        else if (format >= 0x8C00 && format <= 0x8C03)
        {
            return 'pvrtc';
        }
        else if (format >= 0x8D64)
        {
            return 'etc1';
        }
        else if (format >= 0x8C92 && format <= 0x87EE)
        {
            return 'atc';
        }

        throw new Error('Invalid (compressed) texture format given!');
    }

    /**
     * Pre-creates buffer views for each mipmap level
     *
     * @private
     * @param buffer -
     * @param format - compression formats
     * @param levels - mipmap levels
     * @param blockWidth -
     * @param blockHeight -
     * @param imageWidth - width of the image in pixels
     * @param imageHeight - height of the image in pixels
     */
    private static _createLevelBuffers(
        buffer: Uint8Array,
        format: INTERNAL_FORMATS,
        levels: number,
        blockWidth: number,
        blockHeight: number,
        imageWidth: number,
        imageHeight: number
    ): CompressedLevelBuffer[]
    {
        // The byte-size of the first level buffer
        const buffers = new Array<CompressedLevelBuffer>(levels);

        let offset = buffer.byteOffset;

        let levelWidth = imageWidth;
        let levelHeight = imageHeight;
        let alignedLevelWidth = (levelWidth + blockWidth - 1) & ~(blockWidth - 1);
        let alignedLevelHeight = (levelHeight + blockHeight - 1) & ~(blockHeight - 1);

        let levelSize = alignedLevelWidth * alignedLevelHeight * INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[format];

        for (let i = 0; i < levels; i++)
        {
            buffers[i] = {
                levelID: i,
                levelWidth: levels > 1 ? levelWidth : alignedLevelWidth,
                levelHeight: levels > 1 ? levelHeight : alignedLevelHeight,
                levelBuffer: new Uint8Array(buffer.buffer, offset, levelSize)
            };

            offset += levelSize;

            // Calculate levelBuffer dimensions for next iteration
            levelWidth = (levelWidth >> 1) || 1;
            levelHeight = (levelHeight >> 1) || 1;
            alignedLevelWidth = (levelWidth + blockWidth - 1) & ~(blockWidth - 1);
            alignedLevelHeight = (levelHeight + blockHeight - 1) & ~(blockHeight - 1);
            levelSize = alignedLevelWidth * alignedLevelHeight * INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[format];
        }

        return buffers;
    }
}
