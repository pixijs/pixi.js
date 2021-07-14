import { MSAA_QUALITY } from '@pixi/constants';

import type { Framebuffer } from './Framebuffer';

/**
 * Internal framebuffer for WebGL context
 * @class
 * @memberof PIXI
 */
export class GLFramebuffer
{
    public framebuffer: WebGLFramebuffer;
    public stencil: WebGLRenderbuffer;
    public multisample: MSAA_QUALITY;
    public msaaBuffer: WebGLRenderbuffer;
    public blitFramebuffer: Framebuffer;
    dirtyId: number;
    dirtyFormat: number;
    dirtySize: number;
    mipLevel: number;

    constructor(framebuffer: WebGLTexture)
    {
        /**
         * The WebGL framebuffer
         * @member {WebGLFramebuffer}
         */
        this.framebuffer = framebuffer;
        /**
         * stencil+depth , usually costs 32bits per pixel
         * @member {WebGLRenderbuffer}
         */
        this.stencil = null;
        /**
         * latest known version of framebuffer
         * @member {number}
         * @protected
         */
        this.dirtyId = -1;
        /**
         * latest known version of framebuffer format
         * @member {number}
         * @protected
         */
        this.dirtyFormat = -1;
        /**
         * latest known version of framebuffer size
         * @member {number}
         * @protected
         */
        this.dirtySize = -1;

        /**
         * Detected AA samples number
         * @member {PIXI.MSAA_QUALITY}
         */
        this.multisample = MSAA_QUALITY.NONE;

        /**
         * In case MSAA, we use this Renderbuffer instead of colorTextures[0] when we write info
         * @member {WebGLRenderbuffer}
         */
        this.msaaBuffer = null;

        /**
         * In case we use MSAA, this is actual framebuffer that has colorTextures[0]
         * The contents of that framebuffer are read when we use that renderTexture in sprites
         * @member {PIXI.Framebuffer}
         */
        this.blitFramebuffer = null;

        /**
         * store the current mipmap of the textures the framebuffer will write too.
         */
        this.mipLevel = 0;
    }
}
