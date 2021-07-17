import { BaseTexture } from '../textures/BaseTexture';
import { Framebuffer } from '../framebuffer/Framebuffer';
import { MIPMAP_MODES, MSAA_QUALITY } from '@pixi/constants';

import type { IBaseTextureOptions } from '../textures/BaseTexture';
import type { MaskData } from '../mask/MaskData';

export interface BaseRenderTexture extends GlobalMixins.BaseRenderTexture, BaseTexture {}

/**
 * A BaseRenderTexture is a special texture that allows any PixiJS display object to be rendered to it.
 *
 * __Hint__: All DisplayObjects (i.e. Sprites) that render to a BaseRenderTexture should be preloaded
 * otherwise black rectangles will be drawn instead.
 *
 * A BaseRenderTexture takes a snapshot of any Display Object given to its render method. The position
 * and rotation of the given Display Objects is ignored. For example:
 *
 * ```js
 * let renderer = PIXI.autoDetectRenderer();
 * let baseRenderTexture = new PIXI.BaseRenderTexture({ width: 800, height: 600 });
 * let renderTexture = new PIXI.RenderTexture(baseRenderTexture);
 * let sprite = PIXI.Sprite.from("spinObj_01.png");
 *
 * sprite.position.x = 800/2;
 * sprite.position.y = 600/2;
 * sprite.anchor.x = 0.5;
 * sprite.anchor.y = 0.5;
 *
 * renderer.render(sprite, {renderTexture});
 * ```
 *
 * The Sprite in this case will be rendered using its local transform. To render this sprite at 0,0
 * you can clear the transform
 *
 * ```js
 *
 * sprite.setTransform()
 *
 * let baseRenderTexture = new PIXI.BaseRenderTexture({ width: 100, height: 100 });
 * let renderTexture = new PIXI.RenderTexture(baseRenderTexture);
 *
 * renderer.render(sprite, {renderTexture});  // Renders to center of RenderTexture
 * ```
 *
 * @class
 * @extends PIXI.BaseTexture
 * @memberof PIXI
 */
export class BaseRenderTexture extends BaseTexture
{
    public clearColor: number[];
    public framebuffer: Framebuffer;
    maskStack: Array<MaskData>;
    filterStack: Array<any>;

    /**
     * @param {object} [options]
     * @param {number} [options.width=100] - The width of the base render texture.
     * @param {number} [options.height=100] - The height of the base render texture.
     * @param {PIXI.SCALE_MODES} [options.scaleMode=PIXI.settings.SCALE_MODE] - See {@link PIXI.SCALE_MODES}
     *   for possible values.
     * @param {number} [options.resolution=PIXI.settings.RESOLUTION] - The resolution / device pixel ratio
     *   of the texture being generated.
     * @param {PIXI.MSAA_QUALITY} [options.multisample=PIXI.MSAA_QUALITY.NONE] - The number of samples of the frame buffer.
     */
    constructor(options?: IBaseTextureOptions)
    {
        if (typeof options === 'number')
        {
            /* eslint-disable prefer-rest-params */
            // Backward compatibility of signature
            const width = arguments[0];
            const height = arguments[1];
            const scaleMode = arguments[2];
            const resolution = arguments[3];

            options = { width, height, scaleMode, resolution };
            /* eslint-enable prefer-rest-params */
        }

        options.width = options.width || 100;
        options.height = options.height || 100;
        options.multisample = options.multisample !== undefined ? options.multisample : MSAA_QUALITY.NONE;

        super(null, options);

        // Set defaults
        this.mipmap = MIPMAP_MODES.OFF;
        this.valid = true;

        this.clearColor = [0, 0, 0, 0];

        this.framebuffer = new Framebuffer(this.realWidth, this.realHeight)
            .addColorTexture(0, this);
        this.framebuffer.multisample = options.multisample;

        // TODO - could this be added the systems?

        /**
         * The data structure for the stencil masks.
         *
         * @member {PIXI.MaskData[]}
         */
        this.maskStack = [];

        /**
         * The data structure for the filters.
         *
         * @member {Object[]}
         */
        this.filterStack = [{}];
    }

    /**
     * Resizes the BaseRenderTexture.
     *
     * @param {number} desiredWidth - The desired width to resize to.
     * @param {number} desiredHeight - The desired height to resize to.
     */
    resize(desiredWidth: number, desiredHeight: number): void
    {
        this.framebuffer.resize(desiredWidth * this.resolution, desiredHeight * this.resolution);
        this.setRealSize(this.framebuffer.width, this.framebuffer.height);
    }

    /**
     * Frees the texture and framebuffer from WebGL memory without destroying this texture object.
     * This means you can still use the texture later which will upload it to GPU
     * memory again.
     *
     * @fires PIXI.BaseTexture#dispose
     */
    dispose(): void
    {
        this.framebuffer.dispose();

        super.dispose();
    }

    /**
     * Destroys this texture.
     */
    destroy(): void
    {
        super.destroy();

        this.framebuffer.destroyDepthTexture();
        this.framebuffer = null;
    }
}
