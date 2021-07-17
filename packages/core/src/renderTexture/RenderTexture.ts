import { BaseRenderTexture } from './BaseRenderTexture';
import { Texture } from '../textures/Texture';

import type { Rectangle } from '@pixi/math';
import type { Framebuffer } from '../framebuffer/Framebuffer';
import type { IBaseTextureOptions } from '../textures/BaseTexture';
import type { MSAA_QUALITY, SCALE_MODES } from '@pixi/constants';
import { deprecation } from '@pixi/utils';

/**
 * A RenderTexture is a special texture that allows any PixiJS display object to be rendered to it.
 *
 * __Hint__: All DisplayObjects (i.e. Sprites) that render to a RenderTexture should be preloaded
 * otherwise black rectangles will be drawn instead.
 *
 * __Hint-2__: The actual memory allocation will happen on first render.
 * You shouldn't create renderTextures each frame just to delete them after, try to reuse them.
 *
 * A RenderTexture takes a snapshot of any Display Object given to its render method. For example:
 *
 * ```js
 * let renderer = PIXI.autoDetectRenderer();
 * let renderTexture = PIXI.RenderTexture.create({ width: 800, height: 600 });
 * let sprite = PIXI.Sprite.from("spinObj_01.png");
 *
 * sprite.position.x = 800/2;
 * sprite.position.y = 600/2;
 * sprite.anchor.x = 0.5;
 * sprite.anchor.y = 0.5;
 *
 * renderer.render(sprite, {renderTexture});
 * ```
 * Note that you should not create a new renderer, but reuse the same one as the rest of the application.
 *
 * The Sprite in this case will be rendered using its local transform. To render this sprite at 0,0
 * you can clear the transform
 *
 * ```js
 *
 * sprite.setTransform()
 *
 * let renderTexture = new PIXI.RenderTexture.create({ width: 100, height: 100 });
 *
 * renderer.render(sprite, {renderTexture});  // Renders to center of RenderTexture
 * ```
 *
 * @class
 * @extends PIXI.Texture
 * @memberof PIXI
 */
export class RenderTexture extends Texture
{
    public baseTexture: BaseRenderTexture;
    public filterFrame: Rectangle|null;
    public filterPoolKey: string|number|null;

    /**
     * @param {PIXI.BaseRenderTexture} baseRenderTexture - The base texture object that this texture uses
     * @param {PIXI.Rectangle} [frame] - The rectangle frame of the texture to show
     */
    constructor(baseRenderTexture: BaseRenderTexture, frame?: Rectangle)
    {
        super(baseRenderTexture, frame);

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @member {boolean}
         */
        this.valid = true;

        /**
         * Stores `sourceFrame` when this texture is inside current filter stack.
         * You can read it inside filters.
         *
         * @readonly
         * @member {PIXI.Rectangle}
         */
        this.filterFrame = null;

        /**
         * The key for pooled texture of FilterSystem
         * @protected
         * @member {string}
         */
        this.filterPoolKey = null;

        this.updateUvs();
    }

    /**
     * Shortcut to `this.baseTexture.framebuffer`, saves baseTexture cast.
     * @member {PIXI.Framebuffer}
     * @readonly
     */
    get framebuffer(): Framebuffer
    {
        return this.baseTexture.framebuffer;
    }

    /**
     * Shortcut to `this.framebuffer.multisample`.
     *
     * @member {PIXI.MSAA_QUALITY}
     * @default PIXI.MSAA_QUALITY.NONE
     */
    get multisample(): MSAA_QUALITY
    {
        return this.framebuffer.multisample;
    }

    set multisample(value: MSAA_QUALITY)
    {
        this.framebuffer.multisample = value;
    }

    /**
     * Resizes the RenderTexture.
     *
     * @param {number} desiredWidth - The desired width to resize to.
     * @param {number} desiredHeight - The desired height to resize to.
     * @param {boolean} [resizeBaseTexture=true] - Should the baseTexture.width and height values be resized as well?
     */
    resize(desiredWidth: number, desiredHeight: number, resizeBaseTexture = true): void
    {
        const resolution = this.baseTexture.resolution;
        const width = Math.round(desiredWidth * resolution) / resolution;
        const height = Math.round(desiredHeight * resolution) / resolution;

        // TODO - could be not required..
        this.valid = (width > 0 && height > 0);

        this._frame.width = this.orig.width = width;
        this._frame.height = this.orig.height = height;

        if (resizeBaseTexture)
        {
            this.baseTexture.resize(width, height);
        }

        this.updateUvs();
    }

    /**
     * Changes the resolution of baseTexture, but does not change framebuffer size.
     *
     * @param {number} resolution - The new resolution to apply to RenderTexture
     */
    setResolution(resolution: number): void
    {
        const { baseTexture } = this;

        if (baseTexture.resolution === resolution)
        {
            return;
        }

        baseTexture.setResolution(resolution);
        this.resize(baseTexture.width, baseTexture.height, false);
    }

    /**
     * Use the object-based construction instead.
     *
     * @method
     * @deprecated since 6.0.0
     * @param {number} [width]
     * @param {number} [height]
     * @param {PIXI.SCALE_MODES} [scaleMode=PIXI.settings.SCALE_MODE]
     * @param {number} [resolution=PIXI.settings.FILTER_RESOLUTION]
     */
    static create(width: number, height: number, scaleMode?: SCALE_MODES, resolution?: number): RenderTexture;

    /**
     * A short hand way of creating a render texture.
     *
     * @method
     * @param {object} [options] - Options
     * @param {number} [options.width=100] - The width of the render texture
     * @param {number} [options.height=100] - The height of the render texture
     * @param {PIXI.SCALE_MODES} [options.scaleMode=PIXI.settings.SCALE_MODE] - See {@link PIXI.SCALE_MODES}
     *    for possible values
     * @param {number} [options.resolution=PIXI.settings.RESOLUTION] - The resolution / device pixel ratio of the texture
     *    being generated
     * @param {PIXI.MSAA_QUALITY} [options.multisample=PIXI.MSAA_QUALITY.NONE] - The number of samples of the frame buffer
     * @return {PIXI.RenderTexture} The new render texture
     */
    static create(options?: IBaseTextureOptions): RenderTexture;
    static create(options?: IBaseTextureOptions | number, ...rest: any[]): RenderTexture
    {
        // @deprecated fallback, old-style: create(width, height, scaleMode, resolution)
        if (typeof options === 'number')
        {
            // #if _DEBUG
            deprecation('6.0.0', 'Arguments (width, height, scaleMode, resolution) have been deprecated.');
            // #endif

            /* eslint-disable prefer-rest-params */
            options = {
                width: options,
                height: rest[0],
                scaleMode: rest[1],
                resolution: rest[2],
            };
            /* eslint-enable prefer-rest-params */
        }

        return new RenderTexture(new BaseRenderTexture(options));
    }
}
