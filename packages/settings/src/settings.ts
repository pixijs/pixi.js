import { isMobile } from './utils/isMobile';
import { maxRecommendedTextures } from './utils/maxRecommendedTextures';
import { canUploadSameBuffer } from './utils/canUploadSameBuffer';
import { GC_MODES, MIPMAP_MODES, MSAA_QUALITY, PRECISION, SCALE_MODES, WRAP_MODES } from '@pixi/constants';
import type { ENV } from '@pixi/constants';

export interface IRenderOptions {
    view: HTMLCanvasElement;
    antialias: boolean;
    autoDensity: boolean;
    backgroundColor: number;
    backgroundAlpha: number;
    useContextAlpha: boolean | 'notMultiplied';
    clearBeforeRender: boolean;
    preserveDrawingBuffer: boolean;
    width: number;
    height: number;
    legacy: boolean;
}

export interface ISettings {
    MIPMAP_TEXTURES: MIPMAP_MODES;
    ANISOTROPIC_LEVEL: number;
    RESOLUTION: number;
    FILTER_RESOLUTION: number;
    FILTER_MULTISAMPLE: MSAA_QUALITY;
    SPRITE_MAX_TEXTURES: number;
    SPRITE_BATCH_SIZE: number;
    RENDER_OPTIONS: IRenderOptions;
    GC_MODE: GC_MODES;
    GC_MAX_IDLE: number;
    GC_MAX_CHECK_COUNT: number;
    WRAP_MODE: WRAP_MODES;
    SCALE_MODE: SCALE_MODES;
    PRECISION_VERTEX: PRECISION;
    PRECISION_FRAGMENT: PRECISION;
    CAN_UPLOAD_SAME_BUFFER: boolean;
    CREATE_IMAGE_BITMAP: boolean;
    ROUND_PIXELS: boolean;
    RETINA_PREFIX?: RegExp;
    FAIL_IF_MAJOR_PERFORMANCE_CAVEAT?: boolean;
    UPLOADS_PER_FRAME?: number;
    SORTABLE_CHILDREN?: boolean;
    PREFER_ENV?: ENV;
    STRICT_TEXTURE_CACHE?: boolean;
    MESH_CANVAS_PADDING?: number;
    TARGET_FPMS?: number;
}

/**
 * User's customizable globals for overriding the default PIXI settings, such
 * as a renderer's default resolution, framerate, float precision, etc.
 * @example
 * // Use the native window resolution as the default resolution
 * // will support high-density displays when rendering
 * PIXI.settings.RESOLUTION = window.devicePixelRatio;
 *
 * // Disable interpolation when scaling, will make texture be pixelated
 * PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
 * @namespace PIXI.settings
 */
export const settings: ISettings = {

    /**
     * If set to true WebGL will attempt make textures mimpaped by default.
     * Mipmapping will only succeed if the base texture uploaded has power of two dimensions.
     *
     * @static
     * @name MIPMAP_TEXTURES
     * @memberof PIXI.settings
     * @type {PIXI.MIPMAP_MODES}
     * @default PIXI.MIPMAP_MODES.POW2
     */
    MIPMAP_TEXTURES: MIPMAP_MODES.POW2,

    /**
     * Default anisotropic filtering level of textures.
     * Usually from 0 to 16
     *
     * @static
     * @name ANISOTROPIC_LEVEL
     * @memberof PIXI.settings
     * @type {number}
     * @default 0
     */
    ANISOTROPIC_LEVEL: 0,

    /**
     * Default resolution / device pixel ratio of the renderer.
     *
     * @static
     * @name RESOLUTION
     * @memberof PIXI.settings
     * @type {number}
     * @default 1
     */
    RESOLUTION: 1,

    /**
     * Default filter resolution.
     *
     * @static
     * @name FILTER_RESOLUTION
     * @memberof PIXI.settings
     * @type {number}
     * @default 1
     */
    FILTER_RESOLUTION: 1,

    /**
     * Default filter samples.
     *
     * @static
     * @name FILTER_MULTISAMPLE
     * @memberof PIXI.settings
     * @type {PIXI.MSAA_QUALITY}
     * @default PIXI.MSAA_QUALITY.NONE
     */
    FILTER_MULTISAMPLE: MSAA_QUALITY.NONE,

    /**
     * The maximum textures that this device supports.
     *
     * @static
     * @name SPRITE_MAX_TEXTURES
     * @memberof PIXI.settings
     * @type {number}
     * @default 32
     */
    SPRITE_MAX_TEXTURES: maxRecommendedTextures(32),

    // TODO: maybe change to SPRITE.BATCH_SIZE: 2000
    // TODO: maybe add PARTICLE.BATCH_SIZE: 15000

    /**
     * The default sprite batch size.
     *
     * The default aims to balance desktop and mobile devices.
     *
     * @static
     * @name SPRITE_BATCH_SIZE
     * @memberof PIXI.settings
     * @type {number}
     * @default 4096
     */
    SPRITE_BATCH_SIZE: 4096,

    /**
     * The default render options if none are supplied to {@link PIXI.Renderer}
     * or {@link PIXI.CanvasRenderer}.
     *
     * @static
     * @name RENDER_OPTIONS
     * @memberof PIXI.settings
     * @type {object}
     * @property {HTMLCanvasElement} view=null
     * @property {boolean} antialias=false
     * @property {boolean} autoDensity=false
     * @property {boolean} useContextAlpha=true
     * @property {number} backgroundColor=0x000000
     * @property {number} backgroundAlpha=1
     * @property {boolean} clearBeforeRender=true
     * @property {boolean} preserveDrawingBuffer=false
     * @property {number} width=800
     * @property {number} height=600
     * @property {boolean} legacy=false
     */
    RENDER_OPTIONS: {
        view: null,
        antialias: false,
        autoDensity: false,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
        useContextAlpha: true,
        clearBeforeRender: true,
        preserveDrawingBuffer: false,
        width: 800,
        height: 600,
        legacy: false,
    },

    /**
     * Default Garbage Collection mode.
     *
     * @static
     * @name GC_MODE
     * @memberof PIXI.settings
     * @type {PIXI.GC_MODES}
     * @default PIXI.GC_MODES.AUTO
     */
    GC_MODE: GC_MODES.AUTO,

    /**
     * Default Garbage Collection max idle.
     *
     * @static
     * @name GC_MAX_IDLE
     * @memberof PIXI.settings
     * @type {number}
     * @default 3600
     */
    GC_MAX_IDLE: 60 * 60,

    /**
     * Default Garbage Collection maximum check count.
     *
     * @static
     * @name GC_MAX_CHECK_COUNT
     * @memberof PIXI.settings
     * @type {number}
     * @default 600
     */
    GC_MAX_CHECK_COUNT: 60 * 10,

    /**
     * Default wrap modes that are supported by pixi.
     *
     * @static
     * @name WRAP_MODE
     * @memberof PIXI.settings
     * @type {PIXI.WRAP_MODES}
     * @default PIXI.WRAP_MODES.CLAMP
     */
    WRAP_MODE: WRAP_MODES.CLAMP,

    /**
     * Default scale mode for textures.
     *
     * @static
     * @name SCALE_MODE
     * @memberof PIXI.settings
     * @type {PIXI.SCALE_MODES}
     * @default PIXI.SCALE_MODES.LINEAR
     */
    SCALE_MODE: SCALE_MODES.LINEAR,

    /**
     * Default specify float precision in vertex shader.
     *
     * @static
     * @name PRECISION_VERTEX
     * @memberof PIXI.settings
     * @type {PIXI.PRECISION}
     * @default PIXI.PRECISION.HIGH
     */
    PRECISION_VERTEX: PRECISION.HIGH,

    /**
     * Default specify float precision in fragment shader.
     * iOS is best set at highp due to https://github.com/pixijs/pixi.js/issues/3742
     *
     * @static
     * @name PRECISION_FRAGMENT
     * @memberof PIXI.settings
     * @type {PIXI.PRECISION}
     * @default PIXI.PRECISION.MEDIUM
     */
    PRECISION_FRAGMENT: isMobile.apple.device ? PRECISION.HIGH : PRECISION.MEDIUM,

    /**
     * Can we upload the same buffer in a single frame?
     *
     * @static
     * @name CAN_UPLOAD_SAME_BUFFER
     * @memberof PIXI.settings
     * @type {boolean}
     */
    CAN_UPLOAD_SAME_BUFFER: canUploadSameBuffer(),

    /**
     * Enables bitmap creation before image load. This feature is experimental.
     *
     * @static
     * @name CREATE_IMAGE_BITMAP
     * @memberof PIXI.settings
     * @type {boolean}
     * @default false
     */
    CREATE_IMAGE_BITMAP: false,

    /**
     * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
     * Advantages can include sharper image quality (like text) and faster rendering on canvas.
     * The main disadvantage is movement of objects may appear less smooth.
     *
     * @static
     * @constant
     * @memberof PIXI.settings
     * @type {boolean}
     * @default false
     */
    ROUND_PIXELS: false,
};
