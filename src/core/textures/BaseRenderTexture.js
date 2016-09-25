import BaseTexture from './BaseTexture';
import CONST from '../const';

/**
 * A BaseRenderTexture is a special texture that allows any Pixi display object to be rendered to it.
 *
 * __Hint__: All DisplayObjects (i.e. Sprites) that render to a BaseRenderTexture should be preloaded
 * otherwise black rectangles will be drawn instead.
 *
 * A BaseRenderTexture takes a snapshot of any Display Object given to its render method. The position
 * and rotation of the given Display Objects is ignored. For example:
 *
 * ```js
 * let renderer = PIXI.autoDetectRenderer(1024, 1024, { view: canvas, ratio: 1 });
 * let baseRenderTexture = new PIXI.BaseRenderTexture(renderer, 800, 600);
 * let sprite = PIXI.Sprite.fromImage("spinObj_01.png");
 *
 * sprite.position.x = 800/2;
 * sprite.position.y = 600/2;
 * sprite.anchor.x = 0.5;
 * sprite.anchor.y = 0.5;
 *
 * baseRenderTexture.render(sprite);
 * ```
 *
 * The Sprite in this case will be rendered to a position of 0,0. To render this sprite at its actual
 * position a Container should be used:
 *
 * ```js
 * let doc = new PIXI.Container();
 *
 * doc.addChild(sprite);
 *
 * let baseRenderTexture = new PIXI.BaseRenderTexture(100, 100);
 * let renderTexture = new PIXI.RenderTexture(baseRenderTexture);
 *
 * renderer.render(doc, renderTexture);  // Renders to center of RenderTexture
 * ```
 *
 * @class
 * @extends PIXI.BaseTexture
 * @memberof PIXI
 * @param [width=100] {number} The width of the base render texture
 * @param [height=100] {number} The height of the base render texture
 * @param [scaleMode=PIXI.SCALE_MODES.DEFAULT] {number} See {@link PIXI.SCALE_MODES} for possible values
 * @param [resolution=1] {number} The resolution / device pixel ratio of the texture being generated
 */
class BaseRenderTexture extends BaseTexture
{
    constructor(width=100, height=100, scaleMode, resolution)
    {
        super(null, scaleMode);

        this.resolution = resolution || CONST.RESOLUTION;

        this.width = width;
        this.height = height;

        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;

        this.scaleMode = scaleMode || CONST.SCALE_MODES.DEFAULT;
        this.hasLoaded = true;

        /**
         * A map of renderer IDs to webgl renderTargets
         *
         * @member {object<number, WebGLTexture>}
         * @private
         */
        this._glRenderTargets = [];

        /**
         * A reference to the canvas render target (we only need one as this can be shared accross renderers)
         *
         * @member {object<number, WebGLTexture>}
         * @private
         */
        this._canvasRenderTarget = null;

        /**
         * This will let the renderer know if the texture is valid. If it's not then it cannot be rendered.
         *
         * @member {boolean}
         */
        this.valid = false;
    }

    /**
     * Resizes the BaseRenderTexture.
     *
     * @param width {number} The width to resize to.
     * @param height {number} The height to resize to.
     */
    resize(width, height)
    {

        if (width === this.width && height === this.height)
        {
            return;
        }

        this.valid = (width > 0 && height > 0);

        this.width = width;
        this.height = height;

        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;

        if (!this.valid)
        {
            return;
        }

        this.emit('update', this);

    }

    /**
     * Destroys this texture
     *
     */
    destroy()
    {
        super.destroy(true);
        this.renderer = null;
    }
}

export default BaseRenderTexture;
