import { RenderTexture } from './RenderTexture';
import { BaseRenderTexture } from './BaseRenderTexture';
import { nextPow2 } from '@pixi/utils';
import { MSAA_QUALITY } from '@pixi/constants';

import type { IBaseTextureOptions } from '../textures/BaseTexture';
import type { ISize } from '@pixi/math';

/**
 * Experimental!
 *
 * Texture pool, used by FilterSystem and plugins
 * Stores collection of temporary pow2 or screen-sized renderTextures
 *
 * If you use custom RenderTexturePool for your filters, you can use methods
 * `getFilterTexture` and `returnFilterTexture` same as in
 *
 * @class
 * @memberof PIXI
 */
export class RenderTexturePool
{
    public textureOptions: IBaseTextureOptions;
    public enableFullScreen: boolean;
    texturePool: {[x in string|number]: RenderTexture[]};
    private _pixelsWidth: number;
    private _pixelsHeight: number;
    /**
     * @param {object} [textureOptions] - options that will be passed to BaseRenderTexture constructor
     * @param {PIXI.SCALE_MODES} [textureOptions.scaleMode] - See {@link PIXI.SCALE_MODES} for possible values.
     */
    constructor(textureOptions?: IBaseTextureOptions)
    {
        this.texturePool = {};
        this.textureOptions = textureOptions || {};
        /**
         * Allow renderTextures of the same size as screen, not just pow2
         *
         * Automatically sets to true after `setScreenSize`
         *
         * @member {boolean}
         * @default false
         */
        this.enableFullScreen = false;

        this._pixelsWidth = 0;
        this._pixelsHeight = 0;
    }

    /**
     * creates of texture with params that were specified in pool constructor
     *
     * @param {number} realWidth - width of texture in pixels
     * @param {number} realHeight - height of texture in pixels
     * @param {PIXI.MSAA_QUALITY} [multisample=PIXI.MSAA_QUALITY.NONE] - number of samples of the framebuffer
     * @returns {RenderTexture}
     */
    createTexture(realWidth: number, realHeight: number, multisample = MSAA_QUALITY.NONE): RenderTexture
    {
        const baseRenderTexture = new BaseRenderTexture(Object.assign({
            width: realWidth,
            height: realHeight,
            resolution: 1,
            multisample,
        }, this.textureOptions));

        return new RenderTexture(baseRenderTexture);
    }

    /**
     * Gets a Power-of-Two render texture or fullScreen texture
     *
     * @protected
     * @param {number} minWidth - The minimum width of the render texture in real pixels.
     * @param {number} minHeight - The minimum height of the render texture in real pixels.
     * @param {number} [resolution=1] - The resolution of the render texture.
     * @param {PIXI.MSAA_QUALITY} [multisample=PIXI.MSAA_QUALITY.NONE] - Number of samples of the render texture.
     * @return {PIXI.RenderTexture} The new render texture.
     */
    getOptimalTexture(minWidth: number, minHeight: number, resolution = 1, multisample = MSAA_QUALITY.NONE): RenderTexture
    {
        let key: number|string = RenderTexturePool.SCREEN_KEY;

        minWidth *= resolution;
        minHeight *= resolution;

        if (!this.enableFullScreen || minWidth !== this._pixelsWidth || minHeight !== this._pixelsHeight)
        {
            minWidth = nextPow2(minWidth);
            minHeight = nextPow2(minHeight);
            key = ((minWidth & 0xFFFF) << 16) | (minHeight & 0xFFFF);

            if (multisample > 1)
            {
                key += multisample * 0x100000000;
            }
        }

        if (!this.texturePool[key])
        {
            this.texturePool[key] = [];
        }

        let renderTexture = this.texturePool[key].pop();

        if (!renderTexture)
        {
            renderTexture = this.createTexture(minWidth, minHeight, multisample);
        }

        renderTexture.filterPoolKey = key;
        renderTexture.setResolution(resolution);

        return renderTexture;
    }

    /**
     * Gets extra texture of the same size as input renderTexture
     *
     * `getFilterTexture(input, 0.5)` or `getFilterTexture(0.5, input)`
     *
     * @param {PIXI.RenderTexture} input - renderTexture from which size and resolution will be copied
     * @param {number} [resolution] - override resolution of the renderTexture
     *  It overrides, it does not multiply
     * @param {PIXI.MSAA_QUALITY} [multisample=PIXI.MSAA_QUALITY.NONE] - number of samples of the renderTexture
     * @returns {PIXI.RenderTexture}
     */
    getFilterTexture(input: RenderTexture, resolution?: number, multisample?: MSAA_QUALITY): RenderTexture
    {
        const filterTexture = this.getOptimalTexture(input.width, input.height, resolution || input.resolution,
            multisample || MSAA_QUALITY.NONE);

        filterTexture.filterFrame = input.filterFrame;

        return filterTexture;
    }

    /**
     * Place a render texture back into the pool.
     * @param {PIXI.RenderTexture} renderTexture - The renderTexture to free
     */
    returnTexture(renderTexture: RenderTexture): void
    {
        const key = renderTexture.filterPoolKey;

        renderTexture.filterFrame = null;
        this.texturePool[key].push(renderTexture);
    }

    /**
     * Alias for returnTexture, to be compliant with FilterSystem interface
     * @param {PIXI.RenderTexture} renderTexture - The renderTexture to free
     */
    returnFilterTexture(renderTexture: RenderTexture): void
    {
        this.returnTexture(renderTexture);
    }

    /**
     * Clears the pool
     *
     * @param {boolean} [destroyTextures=true] - destroy all stored textures
     */
    clear(destroyTextures?: boolean): void
    {
        destroyTextures = destroyTextures !== false;
        if (destroyTextures)
        {
            for (const i in this.texturePool)
            {
                const textures = this.texturePool[i];

                if (textures)
                {
                    for (let j = 0; j < textures.length; j++)
                    {
                        textures[j].destroy(true);
                    }
                }
            }
        }

        this.texturePool = {};
    }

    /**
     * If screen size was changed, drops all screen-sized textures,
     * sets new screen size, sets `enableFullScreen` to true
     *
     * Size is measured in pixels, `renderer.view` can be passed here, not `renderer.screen`
     *
     * @param {PIXI.ISize} size - Initial size of screen
     */
    setScreenSize(size: ISize): void
    {
        if (size.width === this._pixelsWidth
            && size.height === this._pixelsHeight)
        {
            return;
        }

        const screenKey = RenderTexturePool.SCREEN_KEY;
        const textures = this.texturePool[screenKey];

        this.enableFullScreen = size.width > 0 && size.height > 0;

        if (textures)
        {
            for (let j = 0; j < textures.length; j++)
            {
                textures[j].destroy(true);
            }
        }
        this.texturePool[screenKey] = [];

        this._pixelsWidth = size.width;
        this._pixelsHeight = size.height;
    }

    /**
     * Key that is used to store fullscreen renderTextures in a pool
     *
     * @static
     * @const {string}
     */
    static SCREEN_KEY = 'screen';
}
