import { CompressedTextureResource } from '../resources';
import { INTERNAL_FORMAT_TO_BYTES_PER_PIXEL } from '../const';
import { INTERNAL_FORMATS } from '@pixi/constants';
import { LoaderResource } from '@pixi/loaders';
import { registerCompressedTextures } from './registerCompressedTextures';

import type { ILoaderResource } from '@pixi/loaders';

// Set DDS files to be loaded as an ArrayBuffer
LoaderResource.setExtensionXhrType('dds', LoaderResource.XHR_RESPONSE_TYPE.BUFFER);

const DDS_MAGIC_SIZE = 4;
const DDS_HEADER_SIZE = 124;
const DDS_HEADER_PF_SIZE = 32;
const DDS_HEADER_DX10_SIZE = 20;

// DDS file format magic word
const DDS_MAGIC = 0x20534444;

/**
 * DWORD offsets of the DDS file header fields (relative to file start).
 *
 * @ignore
 */
const DDS_FIELDS = {
    SIZE: 1,
    FLAGS: 2,
    HEIGHT: 3,
    WIDTH: 4,
    MIPMAP_COUNT: 7,
    PIXEL_FORMAT: 19,
};

/**
 * DWORD offsets of the DDS PIXEL_FORMAT fields.
 *
 * @ignore
 */
const DDS_PF_FIELDS = {
    SIZE: 0,
    FLAGS: 1,
    FOURCC: 2,
    RGB_BITCOUNT: 3,
    R_BIT_MASK: 4,
    G_BIT_MASK: 5,
    B_BIT_MASK: 6,
    A_BIT_MASK: 7
};

/**
 * DWORD offsets of the DDS_HEADER_DX10 fields.
 *
 * @ignore
 */
const DDS_DX10_FIELDS = {
    DXGI_FORMAT: 0,
    RESOURCE_DIMENSION: 1,
    MISC_FLAG: 2,
    ARRAY_SIZE: 3,
    MISC_FLAGS2: 4
};

/**
 * @see https://docs.microsoft.com/en-us/windows/win32/api/dxgiformat/ne-dxgiformat-dxgi_format
 * @ignore
 */
// This is way over-blown for us! Lend us a hand, and remove the ones that aren't used (but set the remaining
// ones to their correct value)
enum DXGI_FORMAT {
    DXGI_FORMAT_UNKNOWN,
    DXGI_FORMAT_R32G32B32A32_TYPELESS,
    DXGI_FORMAT_R32G32B32A32_FLOAT,
    DXGI_FORMAT_R32G32B32A32_UINT,
    DXGI_FORMAT_R32G32B32A32_SINT,
    DXGI_FORMAT_R32G32B32_TYPELESS,
    DXGI_FORMAT_R32G32B32_FLOAT,
    DXGI_FORMAT_R32G32B32_UINT,
    DXGI_FORMAT_R32G32B32_SINT,
    DXGI_FORMAT_R16G16B16A16_TYPELESS,
    DXGI_FORMAT_R16G16B16A16_FLOAT,
    DXGI_FORMAT_R16G16B16A16_UNORM,
    DXGI_FORMAT_R16G16B16A16_UINT,
    DXGI_FORMAT_R16G16B16A16_SNORM,
    DXGI_FORMAT_R16G16B16A16_SINT,
    DXGI_FORMAT_R32G32_TYPELESS,
    DXGI_FORMAT_R32G32_FLOAT,
    DXGI_FORMAT_R32G32_UINT,
    DXGI_FORMAT_R32G32_SINT,
    DXGI_FORMAT_R32G8X24_TYPELESS,
    DXGI_FORMAT_D32_FLOAT_S8X24_UINT,
    DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS,
    DXGI_FORMAT_X32_TYPELESS_G8X24_UINT,
    DXGI_FORMAT_R10G10B10A2_TYPELESS,
    DXGI_FORMAT_R10G10B10A2_UNORM,
    DXGI_FORMAT_R10G10B10A2_UINT,
    DXGI_FORMAT_R11G11B10_FLOAT,
    DXGI_FORMAT_R8G8B8A8_TYPELESS,
    DXGI_FORMAT_R8G8B8A8_UNORM,
    DXGI_FORMAT_R8G8B8A8_UNORM_SRGB,
    DXGI_FORMAT_R8G8B8A8_UINT,
    DXGI_FORMAT_R8G8B8A8_SNORM,
    DXGI_FORMAT_R8G8B8A8_SINT,
    DXGI_FORMAT_R16G16_TYPELESS,
    DXGI_FORMAT_R16G16_FLOAT,
    DXGI_FORMAT_R16G16_UNORM,
    DXGI_FORMAT_R16G16_UINT,
    DXGI_FORMAT_R16G16_SNORM,
    DXGI_FORMAT_R16G16_SINT,
    DXGI_FORMAT_R32_TYPELESS,
    DXGI_FORMAT_D32_FLOAT,
    DXGI_FORMAT_R32_FLOAT,
    DXGI_FORMAT_R32_UINT,
    DXGI_FORMAT_R32_SINT,
    DXGI_FORMAT_R24G8_TYPELESS,
    DXGI_FORMAT_D24_UNORM_S8_UINT,
    DXGI_FORMAT_R24_UNORM_X8_TYPELESS,
    DXGI_FORMAT_X24_TYPELESS_G8_UINT,
    DXGI_FORMAT_R8G8_TYPELESS,
    DXGI_FORMAT_R8G8_UNORM,
    DXGI_FORMAT_R8G8_UINT,
    DXGI_FORMAT_R8G8_SNORM,
    DXGI_FORMAT_R8G8_SINT,
    DXGI_FORMAT_R16_TYPELESS,
    DXGI_FORMAT_R16_FLOAT,
    DXGI_FORMAT_D16_UNORM,
    DXGI_FORMAT_R16_UNORM,
    DXGI_FORMAT_R16_UINT,
    DXGI_FORMAT_R16_SNORM,
    DXGI_FORMAT_R16_SINT,
    DXGI_FORMAT_R8_TYPELESS,
    DXGI_FORMAT_R8_UNORM,
    DXGI_FORMAT_R8_UINT,
    DXGI_FORMAT_R8_SNORM,
    DXGI_FORMAT_R8_SINT,
    DXGI_FORMAT_A8_UNORM,
    DXGI_FORMAT_R1_UNORM,
    DXGI_FORMAT_R9G9B9E5_SHAREDEXP,
    DXGI_FORMAT_R8G8_B8G8_UNORM,
    DXGI_FORMAT_G8R8_G8B8_UNORM,
    DXGI_FORMAT_BC1_TYPELESS,
    DXGI_FORMAT_BC1_UNORM,
    DXGI_FORMAT_BC1_UNORM_SRGB,
    DXGI_FORMAT_BC2_TYPELESS,
    DXGI_FORMAT_BC2_UNORM,
    DXGI_FORMAT_BC2_UNORM_SRGB,
    DXGI_FORMAT_BC3_TYPELESS,
    DXGI_FORMAT_BC3_UNORM,
    DXGI_FORMAT_BC3_UNORM_SRGB,
    DXGI_FORMAT_BC4_TYPELESS,
    DXGI_FORMAT_BC4_UNORM,
    DXGI_FORMAT_BC4_SNORM,
    DXGI_FORMAT_BC5_TYPELESS,
    DXGI_FORMAT_BC5_UNORM,
    DXGI_FORMAT_BC5_SNORM,
    DXGI_FORMAT_B5G6R5_UNORM,
    DXGI_FORMAT_B5G5R5A1_UNORM,
    DXGI_FORMAT_B8G8R8A8_UNORM,
    DXGI_FORMAT_B8G8R8X8_UNORM,
    DXGI_FORMAT_R10G10B10_XR_BIAS_A2_UNORM,
    DXGI_FORMAT_B8G8R8A8_TYPELESS,
    DXGI_FORMAT_B8G8R8A8_UNORM_SRGB,
    DXGI_FORMAT_B8G8R8X8_TYPELESS,
    DXGI_FORMAT_B8G8R8X8_UNORM_SRGB,
    DXGI_FORMAT_BC6H_TYPELESS,
    DXGI_FORMAT_BC6H_UF16,
    DXGI_FORMAT_BC6H_SF16,
    DXGI_FORMAT_BC7_TYPELESS,
    DXGI_FORMAT_BC7_UNORM,
    DXGI_FORMAT_BC7_UNORM_SRGB,
    DXGI_FORMAT_AYUV,
    DXGI_FORMAT_Y410,
    DXGI_FORMAT_Y416,
    DXGI_FORMAT_NV12,
    DXGI_FORMAT_P010,
    DXGI_FORMAT_P016,
    DXGI_FORMAT_420_OPAQUE,
    DXGI_FORMAT_YUY2,
    DXGI_FORMAT_Y210,
    DXGI_FORMAT_Y216,
    DXGI_FORMAT_NV11,
    DXGI_FORMAT_AI44,
    DXGI_FORMAT_IA44,
    DXGI_FORMAT_P8,
    DXGI_FORMAT_A8P8,
    DXGI_FORMAT_B4G4R4A4_UNORM,
    DXGI_FORMAT_P208,
    DXGI_FORMAT_V208,
    DXGI_FORMAT_V408,
    DXGI_FORMAT_SAMPLER_FEEDBACK_MIN_MIP_OPAQUE,
    DXGI_FORMAT_SAMPLER_FEEDBACK_MIP_REGION_USED_OPAQUE,
    DXGI_FORMAT_FORCE_UINT
}

/**
 * Possible values of the field {@link DDS_DX10_FIELDS.RESOURCE_DIMENSION}
 *
 * @ignore
 */
enum D3D10_RESOURCE_DIMENSION {
    DDS_DIMENSION_TEXTURE1D = 2,
    DDS_DIMENSION_TEXTURE2D = 3,
    DDS_DIMENSION_TEXTURE3D = 6
}

const PF_FLAGS = 1;

// PIXEL_FORMAT flags
const DDPF_ALPHA = 0x2;
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDPF_YUV = 0x200;
const DDPF_LUMINANCE = 0x20000;

// Four character codes for DXTn formats
const FOURCC_DXT1 = 0x31545844;
const FOURCC_DXT3 = 0x33545844;
const FOURCC_DXT5 = 0x35545844;
const FOURCC_DX10 = 0x30315844;

// Cubemap texture flag (for DDS_DX10_FIELDS.MISC_FLAG)
const DDS_RESOURCE_MISC_TEXTURECUBE = 0x4;

/**
 * Maps `FOURCC_*` formats to internal formats (see {@link PIXI.INTERNAL_FORMATS}).
 *
 * @ignore
 */
const FOURCC_TO_FORMAT: { [id: number]: number } = {
    [FOURCC_DXT1]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    [FOURCC_DXT3]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    [FOURCC_DXT5]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT
};

/**
 * Maps {@link DXGI_FORMAT} to types/internal-formats (see {@link PIXI.TYPES}, {@link PIXI.INTERNAL_FORMATS})
 *
 * @ignore
 */
const DXGI_TO_FORMAT: { [id: number]: number } = {
    // WEBGL_compressed_texture_s3tc
    [DXGI_FORMAT.DXGI_FORMAT_BC1_TYPELESS]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC2_TYPELESS]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC3_TYPELESS]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,

    // WEBGL_compressed_texture_s3tc_srgb
    [DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM_SRGB]: INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM_SRGB]: INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT,
    [DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM_SRGB]: INTERNAL_FORMATS.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT
};

/**
 * @class
 * @memberof PIXI
 * @implements PIXI.ILoaderPlugin
 * @see https://docs.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide
 */
export class DDSLoader
{
    /**
     * Registers a DDS compressed texture
     * @see PIXI.Loader.loaderMiddleware
     * @param resource - loader resource that is checked to see if it is a DDS file
     * @param next - callback Function to call when done
     */
    public static use(resource: ILoaderResource, next: (...args: any[]) => void): void
    {
        if (resource.extension === 'dds' && resource.data)
        {
            try
            {
                Object.assign(resource, registerCompressedTextures(
                    resource.name || resource.url,
                    DDSLoader.parse(resource.data),
                    resource.metadata,
                ));
            }
            catch (err)
            {
                next(err);

                return;
            }
        }

        next();
    }

    /** Parses the DDS file header, generates base-textures, and puts them into the texture cache. */
    private static parse(arrayBuffer: ArrayBuffer): CompressedTextureResource[]
    {
        const data = new Uint32Array(arrayBuffer);
        const magicWord = data[0];

        if (magicWord !== DDS_MAGIC)
        {
            throw new Error('Invalid DDS file magic word');
        }

        const header = new Uint32Array(arrayBuffer, 0, DDS_HEADER_SIZE / Uint32Array.BYTES_PER_ELEMENT);

        // DDS header fields
        const height = header[DDS_FIELDS.HEIGHT];
        const width = header[DDS_FIELDS.WIDTH];
        const mipmapCount = header[DDS_FIELDS.MIPMAP_COUNT];

        // PIXEL_FORMAT fields
        const pixelFormat = new Uint32Array(
            arrayBuffer,
            DDS_FIELDS.PIXEL_FORMAT * Uint32Array.BYTES_PER_ELEMENT,
            DDS_HEADER_PF_SIZE / Uint32Array.BYTES_PER_ELEMENT);
        const formatFlags = pixelFormat[PF_FLAGS];

        // File contains compressed texture(s)
        if (formatFlags & DDPF_FOURCC)
        {
            const fourCC = pixelFormat[DDS_PF_FIELDS.FOURCC];

            // File contains one DXTn compressed texture
            if (fourCC !== FOURCC_DX10)
            {
                const internalFormat = FOURCC_TO_FORMAT[fourCC];

                const dataOffset = DDS_MAGIC_SIZE + DDS_HEADER_SIZE;
                const texData = new Uint8Array(arrayBuffer, dataOffset);

                const resource = new CompressedTextureResource(texData, {
                    format: internalFormat,
                    width,
                    height,
                    levels: mipmapCount // CompressedTextureResource will separate the levelBuffers for us!
                });

                return [resource];
            }

            // FOURCC_DX10 indicates there is a 20-byte DDS_HEADER_DX10 after DDS_HEADER
            const dx10Offset = DDS_MAGIC_SIZE + DDS_HEADER_SIZE;
            const dx10Header = new Uint32Array(
                data.buffer,
                dx10Offset,
                DDS_HEADER_DX10_SIZE / Uint32Array.BYTES_PER_ELEMENT);
            const dxgiFormat = dx10Header[DDS_DX10_FIELDS.DXGI_FORMAT];
            const resourceDimension = dx10Header[DDS_DX10_FIELDS.RESOURCE_DIMENSION];
            const miscFlag = dx10Header[DDS_DX10_FIELDS.MISC_FLAG];
            const arraySize = dx10Header[DDS_DX10_FIELDS.ARRAY_SIZE];

            // Map dxgiFormat to PIXI.INTERNAL_FORMATS
            const internalFormat = DXGI_TO_FORMAT[dxgiFormat];

            if (internalFormat === undefined)
            {
                throw new Error(`DDSLoader cannot parse texture data with DXGI format ${dxgiFormat}`);
            }
            if (miscFlag === DDS_RESOURCE_MISC_TEXTURECUBE)
            {
                // FIXME: Anybody excited about cubemap compressed textures?
                throw new Error('DDSLoader does not support cubemap textures');
            }
            if (resourceDimension === D3D10_RESOURCE_DIMENSION.DDS_DIMENSION_TEXTURE3D)
            {
                // FIXME: Anybody excited about 3D compressed textures?
                throw new Error('DDSLoader does not supported 3D texture data');
            }

            // Uint8Array buffers of image data, including all mipmap levels in each image
            const imageBuffers = new Array<Uint8Array>();
            const dataOffset = DDS_MAGIC_SIZE
                + DDS_HEADER_SIZE
                + DDS_HEADER_DX10_SIZE;

            if (arraySize === 1)
            {
                // No need bothering with the imageSize calculation!
                imageBuffers.push(new Uint8Array(arrayBuffer, dataOffset));
            }
            else
            {
                // Calculate imageSize for each texture, and then locate each image's texture data

                const pixelSize = INTERNAL_FORMAT_TO_BYTES_PER_PIXEL[internalFormat];
                let imageSize = 0;
                let levelWidth = width;
                let levelHeight = height;

                for (let i = 0; i < mipmapCount; i++)
                {
                    const alignedLevelWidth = Math.max(1, (levelWidth + 3) & ~3);
                    const alignedLevelHeight = Math.max(1, (levelHeight + 3) & ~3);

                    const levelSize = alignedLevelWidth * alignedLevelHeight * pixelSize;

                    imageSize += levelSize;

                    levelWidth = levelWidth >>> 1;
                    levelHeight = levelHeight >>> 1;
                }

                let imageOffset = dataOffset;

                // NOTE: Cubemaps have 6-images per texture (but they aren't supported so ^_^)
                for (let i = 0; i < arraySize; i++)
                {
                    imageBuffers.push(new Uint8Array(arrayBuffer, imageOffset, imageSize));
                    imageOffset += imageSize;
                }
            }

            // Uint8Array -> CompressedTextureResource, and we're done!
            return imageBuffers.map((buffer) => new CompressedTextureResource(buffer, {
                format: internalFormat,
                width,
                height,
                levels: mipmapCount
            }));
        }
        if (formatFlags & DDPF_RGB)
        {
            // FIXME: We might want to allow uncompressed *.dds files?
            throw new Error('DDSLoader does not support uncompressed texture data.');
        }
        if (formatFlags & DDPF_YUV)
        {
            // FIXME: Does anybody need this feature?
            throw new Error('DDSLoader does not supported YUV uncompressed texture data.');
        }
        if (formatFlags & DDPF_LUMINANCE)
        {
            // FIXME: Microsoft says older DDS filers use this feature! Probably not worth the effort!
            throw new Error('DDSLoader does not support single-channel (lumninance) texture data!');
        }
        if (formatFlags & DDPF_ALPHA)
        {
            // FIXME: I'm tired! See above =)
            throw new Error('DDSLoader does not support single-channel (alpha) texture data!');
        }

        throw new Error('DDSLoader failed to load a texture file due to an unknown reason!');
    }
}
