import { INTERNAL_FORMATS, TYPES } from '@pixi/constants';

/**
 * The transcoding formats provided by basis_universal.
 *
 * NOTE: Not all of these formats are supported on WebGL!
 *
 * @ignore
 */
/* eslint-disable camelcase */
export enum BASIS_FORMATS {
    cTFETC1 = 0,
    cTFETC2 = 1,
    cTFBC1 = 2,
    cTFBC3 = 3,
    cTFBC4 = 4,
    cTFBC5 = 5,
    cTFBC7 = 6,
    cTFPVRTC1_4_RGB = 8,
    cTFPVRTC1_4_RGBA = 9,
    cTFASTC_4x4 = 10,
    cTFATC_RGB = 11,
    cTFATC_RGBA_INTERPOLATED_ALPHA = 12,
    cTFRGBA32 = 13,
    cTFRGB565 = 14,
    cTFBGR565 = 15,
    cTFRGBA4444 = 16,
}
/* eslint-enable camelcase */

/**
 * Maps {@link BASIS_FORMATS} to {@link PIXI.INTERNAL_FORMATS}
 *
 * @ignore
 */
export const BASIS_FORMAT_TO_INTERNAL_FORMAT: { [id: number]: INTERNAL_FORMATS } = {
    [BASIS_FORMATS.cTFETC1]: INTERNAL_FORMATS.COMPRESSED_RGB_ETC1_WEBGL,
    [BASIS_FORMATS.cTFBC1]: INTERNAL_FORMATS.COMPRESSED_RGB_S3TC_DXT1_EXT,
    [BASIS_FORMATS.cTFBC3]: INTERNAL_FORMATS.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    [BASIS_FORMATS.cTFPVRTC1_4_RGB]: INTERNAL_FORMATS.COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
    [BASIS_FORMATS.cTFPVRTC1_4_RGBA]: INTERNAL_FORMATS.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
    [BASIS_FORMATS.cTFATC_RGB]: INTERNAL_FORMATS.COMPRESSED_RGB_ATC_WEBGL,
    [BASIS_FORMATS.cTFASTC_4x4]: INTERNAL_FORMATS.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL
};

/**
 * Maps {@link BASIS_FORMATS} to {@link PIXI.TYPES}. These formats are a fallback when the basis file cannot be transcoded
 * to a valid compressed texture format.
 *
 * NOTE: {@link BASIS_FORMATS.cTFBGR565} is not supported, while {@link BASIS_FORMATS.cTFRGBA4444} is not implemented by
 *  [at]pixi/basis.
 *
 * @ignore
 */
export const BASIS_FORMAT_TO_TYPE: { [id: number]: TYPES } = {
    [BASIS_FORMATS.cTFRGBA32]: TYPES.UNSIGNED_BYTE,
    [BASIS_FORMATS.cTFRGB565]: TYPES.UNSIGNED_SHORT_5_6_5,
    [BASIS_FORMATS.cTFRGBA4444]: TYPES.UNSIGNED_SHORT_4_4_4_4
};

/**
 * Maps {@link PIXI.INTERNAL_FORMATS} to {@link BASIS_FORMATS}
 *
 * @ignore
 */
export const INTERNAL_FORMAT_TO_BASIS_FORMAT: { [id: number]: number }
    = (Object.keys(BASIS_FORMAT_TO_INTERNAL_FORMAT) as string[])
        .map((key: string) => Number(key))
        .reduce((reverseMap: any, basisFormat: any) =>
        {
            reverseMap[(BASIS_FORMAT_TO_INTERNAL_FORMAT as any)[basisFormat]] = basisFormat;

            return reverseMap;
        }, {});

/**
 * Enumerates the basis formats with alpha components
 *
 * @ignore
 */
export const BASIS_FORMATS_ALPHA: { [id: number]: boolean } = {
    [BASIS_FORMATS.cTFBC3]: true,
    [BASIS_FORMATS.cTFPVRTC1_4_RGBA]: true,
    [BASIS_FORMATS.cTFASTC_4x4]: true
};

/**
 * Binding to C++ {@code BasisFile} wrapper class.
 *
 * @see https://github.com/BinomialLLC/basis_universal/blob/master/webgl/transcoder/basis_wrappers.cpp
 * @ignore
 */
export declare class BasisFile
{
    constructor(buffer: Uint8Array);
    getNumImages(): number;
    getNumLevels(imageId: number): number;
    getImageWidth(imageId: number, level: number): number;
    getImageHeight(imageId: number, level: number): number;
    getHasAlpha(): boolean;
    startTranscoding(): boolean;
    getImageTranscodedSizeInBytes(
        imageId: number,
        level: number,
        basisFormat: number): number;
    transcodeImage(dstBuff: Uint8Array,
        imageId: number,
        level: number,
        basisFormat: BASIS_FORMATS,
        pvrtcWrapAddressing: boolean,
        getAlphaForOpaqueFormats: boolean): number;
    close(): void;
    delete(): void;
}

// Missing typings? - https://github.com/microsoft/TypeScript/issues/39655
/**
 * Compressed texture extensions relevant to the formats into which Basis can decompress into.
 *
 * @ignore
 */
/* eslint-disable camelcase */
export type BasisTextureExtensions = {
    s3tc?: WEBGL_compressed_texture_s3tc,
    s3tc_sRGB: WEBGL_compressed_texture_s3tc_srgb,
    etc: any,
    etc1: any,
    pvrtc: any,
    atc: any,
    astc: WEBGL_compressed_texture_astc
};
/* eslint-enable camelcase */

/**
 * API provided by basis_universal WebGL library.
 *
 * @ignore
 */
export type BasisBinding = {
    BasisFile: typeof BasisFile,
    initializeBasis(): void
};

/**
 * Binding to basis_universal WebGL library.
 *
 * @see https://github.com/BinomialLLC/basis_universal/blob/master/webgl/transcoder/build/basis_transcoder.js
 * @ignore
 */
export type BASIS = (opts?: { wasmBinary: ArrayBuffer }) => Promise<BasisBinding>;
