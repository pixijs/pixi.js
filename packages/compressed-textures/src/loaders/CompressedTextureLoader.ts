import { LoaderResource } from '@pixi/loaders';
import { url } from '@pixi/utils';

import type { Loader, ILoaderResource } from '@pixi/loaders';
import type { INTERNAL_FORMATS } from '@pixi/constants';

/**
 * Schema for compressed-texture manifests
 *
 * @ignore
 * @see PIXI.CompressedTextureLoader
 */
export type CompressedTextureManifest = {
    textures: Array<{ src: string, format?: keyof INTERNAL_FORMATS}>,
    cacheID: string;
};

// Missing typings? - https://github.com/microsoft/TypeScript/issues/39655
/**
 * Compressed texture extensions
 */
/* eslint-disable camelcase */
export type CompressedTextureExtensions = {
    s3tc?: WEBGL_compressed_texture_s3tc,
    s3tc_sRGB: WEBGL_compressed_texture_s3tc_srgb,
    etc: any,
    etc1: any,
    pvrtc: any,
    atc: any,
    astc: WEBGL_compressed_texture_astc
};
export type CompressedTextureExtensionRef = keyof CompressedTextureExtensions;
/* eslint-enable camelcase */

/**
 * Loader plugin for handling compressed textures for all platforms.
 *
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 */
export class CompressedTextureLoader
{
    /**  Map of available texture extensions. */
    static textureExtensions: Partial<CompressedTextureExtensions>;

    /** Map of available texture formats. */
    static textureFormats: { [P in keyof INTERNAL_FORMATS]?: number };

    /**
     * Called after a compressed-textures manifest is loaded.
     *
     * This will then load the correct compression format for the device. Your manifest should adhere
     * to the following schema:
     *
     * ```js
     * import { INTERNAL_FORMATS } from '@pixi/constants';
     *
     * type CompressedTextureManifest = {
     *  textures: Array<{ src: string, format?: keyof INTERNAL_FORMATS}>,
     *  cacheID: string;
     * };
     * ```
     *
     * This is an example of a .json manifest file
     *
     * ```json
     * {
     *   "cacheID":"asset",
     *   "textures":[
     *     { "src":"asset.fallback.png" },
     *     { "format":"COMPRESSED_RGBA_S3TC_DXT5_EXT", "src":"asset.s3tc.ktx" },
     *     { "format":"COMPRESSED_RGBA8_ETC2_EAC", "src":"asset.etc.ktx" },
     *     { "format":"RGBA_PVRTC_4BPPV1_IMG", "src":"asset.pvrtc.ktx" }
     *   ]
     * }
     * ```
     */
    static use(resource: ILoaderResource, next: (...args: any[]) => void): void
    {
        const data: CompressedTextureManifest = resource.data;
        const loader = this as unknown as Loader;

        if (resource.type === LoaderResource.TYPE.JSON
            && data
            && data.cacheID
            && data.textures)
        {
            const textures = data.textures;

            let textureURL: string;
            let fallbackURL: string;

            // Search for an extension that holds one the formats
            for (let i = 0, j = textures.length; i < j; i++)
            {
                const texture = textures[i];
                const url = texture.src;
                const format = texture.format;

                if (!format)
                {
                    fallbackURL = url;
                }
                if (CompressedTextureLoader.textureFormats[format])
                {
                    textureURL = url;
                    break;
                }
            }

            textureURL = textureURL || fallbackURL;

            // Make sure we have a URL
            if (!textureURL)
            {
                next(new Error(`Cannot load compressed-textures in ${resource.url}, make sure you provide a fallback`));

                return;
            }
            if (textureURL === resource.url)
            {
                // Prevent infinite loops
                next(new Error('URL of compressed texture cannot be the same as the manifest\'s URL'));

                return;
            }

            const loadOptions = {
                crossOrigin: resource.crossOrigin,
                metadata: resource.metadata.imageMetadata,
                parentResource: resource
            };

            const resourcePath = url.resolve(resource.url.replace(loader.baseUrl, ''), textureURL);
            const resourceName = data.cacheID;

            // The appropriate loader should register the texture
            loader.add(resourceName, resourcePath, loadOptions, (res: ILoaderResource) =>
            {
                if (res.error)
                {
                    next(res.error);

                    return;
                }

                const { texture = null, textures = {} } = res;

                // Make sure texture/textures is assigned to parent resource
                Object.assign(resource, { texture, textures });

                // Pass along any error
                next();
            });
        }
        else
        {
            next();
        }
    }

    /**
     * Detects the available compressed texture extensions on the device.
     * @ignore
     */
    static add(): void
    {
        // Auto-detect WebGL compressed-texture extensions
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');

        if (!gl)
        {
            // #if _DEBUG
            console.warn('WebGL not available for compressed textures. Silently failing.');
            // #endif

            return;
        }

        const extensions = {
            s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc'),
            s3tc_sRGB: gl.getExtension('WEBGL_compressed_texture_s3tc_srgb'), /* eslint-disable-line camelcase */
            etc: gl.getExtension('WEBGL_compressed_texture_etc'),
            etc1: gl.getExtension('WEBGL_compressed_texture_etc1'),
            pvrtc: gl.getExtension('WEBGL_compressed_texture_pvrtc')
                || gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc'),
            atc: gl.getExtension('WEBGL_compressed_texture_atc'),
            astc: gl.getExtension('WEBGL_compressed_texture_astc')
        };

        CompressedTextureLoader.textureExtensions = extensions;
        CompressedTextureLoader.textureFormats = {};

        // Assign all available compressed-texture formats
        for (const extensionName in extensions)
        {
            const extension = extensions[extensionName as CompressedTextureExtensionRef];

            if (!extension)
            {
                continue;
            }

            Object.assign(
                CompressedTextureLoader.textureFormats,
                Object.getPrototypeOf(extension));
        }
    }
}
