import WebGLSystem from './WebGLSystem';
import { Rectangle } from '@pixi/math';

const tempRect = new Rectangle();

/**
 * @class
 * @extends PIXI.WebGLSystem
 * @memberof PIXI
 */

export default class RenderTextureSystem extends WebGLSystem
{
    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer)
    {
        super(renderer);

        this.clearColor = renderer._backgroundColorRgba;

        // TODO moe this property somewhere else!
        this.defaultMaskStack = [];
        this.defaultFilterStack = [{}];

        // empty render texture?
        this.renderTexture = null;

        this.destinationFrame = new Rectangle();
    }

    bind(renderTexture, sourceFrame, destinationFrame)
    {
        // TODO - do we want this??
        if (this.renderTexture === renderTexture) return;
        this.renderTexture = renderTexture;

        const renderer = this.renderer;

        if (renderTexture)
        {
            const baseTexture = renderTexture.baseTexture;

            if (!destinationFrame)
            {
                tempRect.width = baseTexture.realWidth;
                tempRect.height = baseTexture.realHeight;

                destinationFrame = tempRect;
            }

            if (!sourceFrame)
            {
                sourceFrame = destinationFrame;
            }

            this.renderer.framebuffer.bind(baseTexture.frameBuffer, destinationFrame);

            this.renderer.projection.update(destinationFrame, sourceFrame, baseTexture.resolution, false);
            this.renderer.stencil.setMaskStack(baseTexture.stencilMaskStack);
        }
        else
        {
            // TODO these validation checks happen deeper down..
            // thing they can be avoided..
            if (!destinationFrame)
            {
                tempRect.width = renderer.width;
                tempRect.height = renderer.height;

                destinationFrame = tempRect;
            }

            if (!sourceFrame)
            {
                sourceFrame = destinationFrame;
            }

            renderer.framebuffer.bind(null, destinationFrame);

            // TODO store this..
            this.renderer.projection.update(destinationFrame, sourceFrame, this.renderer.resolution, true);
            this.renderer.stencil.setMaskStack(this.defaultMaskStack);
        }

        this.destinationFrame.copyFrom(destinationFrame);
    }

    /**
     * Erases the render texture and fills the drawing area with a colour
     *
     * @param {number} [clearColor] - The colour
     * @return {PIXI.Renderer} Returns itself.
     */
    clear(clearColor)
    {
        if (this.renderTexture)
        {
            clearColor = clearColor || this.renderTexture.baseTexture.clearColor;
        }
        else
        {
            clearColor = clearColor || this.clearColor;
        }

        this.renderer.framebuffer.clear(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    }

    resize()// screenWidth, screenHeight)
    {
        // resize the root only!
        this.bind(null);
    }
}
