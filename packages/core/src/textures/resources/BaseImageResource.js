import Resource from './Resource';

/**
 * Base for all the image/canvas resources
 * @class
 * @extends PIXI.resources.Resource
 * @memberof PIXI.resources
 */
export default class BaseImageResource extends Resource
{
    /**
     * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|SVGElement} source
     */
    constructor(source)
    {
        super();

        /**
         * The source element
         * @member {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|SVGElement}
         * @readonly
         */
        this.source = source;
    }

    /**
     * Upload the texture to the GPU.
     * @param {PIXI.Renderer} renderer Upload to the renderer
     * @param {PIXI.BaseTexture} baseTexture Reference to parent texture
     */
    upload(renderer, baseTexture)
    {
        renderer.gl.texImage2D(
            baseTexture.target,
            0,
            baseTexture.format,
            baseTexture.format,
            baseTexture.type,
            this.source
        );

        return true;
    }

    /**
     * Destroy this BaseImageResource
     * @override
     * @param {PIXI.BaseTexture} [fromTexture] Optional base texture
     */
    destroy(fromTexture)
    {
        if (super.destroy(fromTexture))
        {
            this.source = null;
        }
    }

    /**
     * Override the width getter
     * @member {number}
     * @override
     * @readonly
     */
    get width()
    {
        return this.source.width;
    }

    /**
     * Override the height getter
     * @member {number}
     * @override
     * @readonly
     */
    get height()
    {
        return this.source.height;
    }
}
