import { AbstractMaskSystem } from './AbstractMaskSystem';

import type { Renderer } from '../Renderer';
import type { IMaskTarget, MaskData } from './MaskData';

/**
 * System plugin to the renderer to manage stencils (used for masks).
 *
 * @class
 * @extends PIXI.System
 * @memberof PIXI
 */
export class StencilSystem extends AbstractMaskSystem
{
    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer: Renderer)
    {
        super(renderer);

        this.glConst = WebGLRenderingContext.STENCIL_TEST;
    }

    getStackLength(): number
    {
        const maskData = this.maskStack[this.maskStack.length - 1];

        if (maskData)
        {
            return maskData._stencilCounter;
        }

        return 0;
    }

    /**
     * Applies the Mask and adds it to the current stencil stack.
     *
     * @param {PIXI.MaskData} maskData - The mask data
     */
    push(maskData: MaskData): void
    {
        const maskObject = maskData.maskObject;
        const { gl } = this.renderer;
        const prevMaskCount = maskData._stencilCounter;

        if (prevMaskCount === 0)
        {
            // force use stencil texture in current framebuffer
            this.renderer.framebuffer.forceStencil();
            gl.enable(gl.STENCIL_TEST);
        }

        maskData._stencilCounter++;

        // Increment the reference stencil value where the new mask overlaps with the old ones.
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.EQUAL, prevMaskCount, this._getBitwiseMask());
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

        maskObject.renderable = true;
        maskObject.render(this.renderer);
        this.renderer.batch.flush();
        maskObject.renderable = false;

        this._useCurrent();
    }

    /**
     * Pops stencil mask. MaskData is already removed from stack
     *
     * @param {PIXI.DisplayObject} maskObject - object of popped mask data
     */
    pop(maskObject: IMaskTarget): void
    {
        const gl = this.renderer.gl;

        if (this.getStackLength() === 0)
        {
            // the stack is empty!
            gl.disable(gl.STENCIL_TEST);
            gl.clear(gl.STENCIL_BUFFER_BIT);
            gl.clearStencil(0);
        }
        else
        {
            // Decrement the reference stencil value where the popped mask overlaps with the other ones
            gl.colorMask(false, false, false, false);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR);

            maskObject.renderable = true;
            maskObject.render(this.renderer);
            this.renderer.batch.flush();
            maskObject.renderable = false;

            this._useCurrent();
        }
    }

    /**
     * Setup renderer to use the current stencil data.
     * @private
     */
    _useCurrent(): void
    {
        const gl = this.renderer.gl;

        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.EQUAL, this.getStackLength(), this._getBitwiseMask());
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    }

    /**
     * Fill 1s equal to the number of acitve stencil masks.
     * @private
     * @return {number} The bitwise mask.
     */
    _getBitwiseMask(): number
    {
        return (1 << this.getStackLength()) - 1;
    }
}
