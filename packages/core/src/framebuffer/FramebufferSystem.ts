import { Rectangle } from '@pixi/math';
import { ENV, BUFFER_BITS, MSAA_QUALITY } from '@pixi/constants';
import { settings } from '../settings';
import { Framebuffer } from './Framebuffer';
import { GLFramebuffer } from './GLFramebuffer';

import type { ISystem } from '../ISystem';
import type { Renderer } from '../Renderer';
import type { IRenderingContext } from '../IRenderingContext';

const tempRectangle = new Rectangle();

/**
 * System plugin to the renderer to manage framebuffers.
 *
 * @class
 * @extends PIXI.System
 * @memberof PIXI
 */
export class FramebufferSystem implements ISystem
{
    public readonly managedFramebuffers: Array<Framebuffer>;
    public current: Framebuffer;
    public viewport: Rectangle;
    public hasMRT: boolean;
    public writeDepthTexture: boolean;
    protected CONTEXT_UID: number;
    protected gl: IRenderingContext;
    protected unknownFramebuffer: Framebuffer;
    protected msaaSamples: Array<number>;
    public renderer: Renderer;

    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer: Renderer)
    {
        this.renderer = renderer;

        /**
         * A list of managed framebuffers
         * @member {PIXI.Framebuffer[]}
         * @readonly
         */
        this.managedFramebuffers = [];

        /**
         * Framebuffer value that shows that we don't know what is bound
         * @member {Framebuffer}
         * @readonly
         */
        this.unknownFramebuffer = new Framebuffer(10, 10);

        this.msaaSamples = null;
    }

    /**
     * Sets up the renderer context and necessary buffers.
     */
    protected contextChange(): void
    {
        const gl = this.gl = this.renderer.gl;

        this.CONTEXT_UID = this.renderer.CONTEXT_UID;
        this.current = this.unknownFramebuffer;
        this.viewport = new Rectangle();
        this.hasMRT = true;
        this.writeDepthTexture = true;

        this.disposeAll(true);

        // webgl2
        if (this.renderer.context.webGLVersion === 1)
        {
            // webgl 1!
            let nativeDrawBuffersExtension = this.renderer.context.extensions.drawBuffers;
            let nativeDepthTextureExtension = this.renderer.context.extensions.depthTexture;

            if (settings.PREFER_ENV === ENV.WEBGL_LEGACY)
            {
                nativeDrawBuffersExtension = null;
                nativeDepthTextureExtension = null;
            }

            if (nativeDrawBuffersExtension)
            {
                gl.drawBuffers = (activeTextures: number[]): void =>
                    nativeDrawBuffersExtension.drawBuffersWEBGL(activeTextures);
            }
            else
            {
                this.hasMRT = false;
                gl.drawBuffers = (): void =>
                {
                    // empty
                };
            }

            if (!nativeDepthTextureExtension)
            {
                this.writeDepthTexture = false;
            }
        }
        else
        {
            // WebGL2
            // cache possible MSAA samples
            this.msaaSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES);
        }
    }

    /**
     * Bind a framebuffer
     *
     * @param {PIXI.Framebuffer} [framebuffer]
     * @param {PIXI.Rectangle} [frame] - frame, default is framebuffer size
     * @param {number} [mipLevel] - optional mip level to set on the framebuffer - defaults to 0
     */
    bind(framebuffer?: Framebuffer, frame?: Rectangle, mipLevel = 0): void
    {
        const { gl } = this;

        if (framebuffer)
        {
            // TODO caching layer!

            const fbo = framebuffer.glFramebuffers[this.CONTEXT_UID] || this.initFramebuffer(framebuffer);

            if (this.current !== framebuffer)
            {
                this.current = framebuffer;
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
            }
            // make sure all textures are unbound..

            if (fbo.mipLevel !== mipLevel)
            {
                framebuffer.dirtyId++;
                framebuffer.dirtyFormat++;
                fbo.mipLevel = mipLevel;
            }

            // now check for updates...
            if (fbo.dirtyId !== framebuffer.dirtyId)
            {
                fbo.dirtyId = framebuffer.dirtyId;

                if (fbo.dirtyFormat !== framebuffer.dirtyFormat)
                {
                    fbo.dirtyFormat = framebuffer.dirtyFormat;
                    fbo.dirtySize = framebuffer.dirtySize;
                    this.updateFramebuffer(framebuffer, mipLevel);
                }
                else if (fbo.dirtySize !== framebuffer.dirtySize)
                {
                    fbo.dirtySize = framebuffer.dirtySize;
                    this.resizeFramebuffer(framebuffer);
                }
            }

            for (let i = 0; i < framebuffer.colorTextures.length; i++)
            {
                const tex = framebuffer.colorTextures[i];

                this.renderer.texture.unbind(tex.parentTextureArray || tex);
            }

            if (framebuffer.depthTexture)
            {
                this.renderer.texture.unbind(framebuffer.depthTexture);
            }

            if (frame)
            {
                const mipWidth = (frame.width >> mipLevel);
                const mipHeight = (frame.height >> mipLevel);

                const scale = mipWidth / frame.width;

                this.setViewport(
                    frame.x * scale,
                    frame.y * scale,
                    mipWidth,
                    mipHeight
                );
            }
            else
            {
                const mipWidth = (framebuffer.width >> mipLevel);
                const mipHeight = (framebuffer.height >> mipLevel);

                this.setViewport(0, 0, mipWidth, mipHeight);
            }
        }
        else
        {
            if (this.current)
            {
                this.current = null;
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }

            if (frame)
            {
                this.setViewport(frame.x, frame.y, frame.width, frame.height);
            }
            else
            {
                this.setViewport(0, 0, this.renderer.width, this.renderer.height);
            }
        }
    }

    /**
     * Set the WebGLRenderingContext's viewport.
     *
     * @param {Number} x - X position of viewport
     * @param {Number} y - Y position of viewport
     * @param {Number} width - Width of viewport
     * @param {Number} height - Height of viewport
     */
    setViewport(x: number, y: number, width: number, height: number): void
    {
        const v = this.viewport;

        x = Math.round(x);
        y = Math.round(y);
        width = Math.round(width);
        height = Math.round(height);

        if (v.width !== width || v.height !== height || v.x !== x || v.y !== y)
        {
            v.x = x;
            v.y = y;
            v.width = width;
            v.height = height;

            this.gl.viewport(x, y, width, height);
        }
    }

    /**
     * Get the size of the current width and height. Returns object with `width` and `height` values.
     *
     * @member {object}
     * @readonly
     */
    get size(): { x: number; y: number; width: number; height: number }
    {
        if (this.current)
        {
            // TODO store temp
            return { x: 0, y: 0, width: this.current.width, height: this.current.height };
        }

        return { x: 0, y: 0, width: this.renderer.width, height: this.renderer.height };
    }

    /**
     * Clear the color of the context
     *
     * @param {Number} r - Red value from 0 to 1
     * @param {Number} g - Green value from 0 to 1
     * @param {Number} b - Blue value from 0 to 1
     * @param {Number} a - Alpha value from 0 to 1
     * @param {PIXI.BUFFER_BITS} [mask=BUFFER_BITS.COLOR | BUFFER_BITS.DEPTH] - Bitwise OR of masks
     *  that indicate the buffers to be cleared, by default COLOR and DEPTH buffers.
     */
    clear(r: number, g: number, b: number, a: number, mask: BUFFER_BITS = BUFFER_BITS.COLOR | BUFFER_BITS.DEPTH): void
    {
        const { gl } = this;

        // TODO clear color can be set only one right?
        gl.clearColor(r, g, b, a);
        gl.clear(mask);
    }

    /**
     * Initialize framebuffer for this context
     *
     * @protected
     * @param {PIXI.Framebuffer} framebuffer
     * @returns {PIXI.GLFramebuffer} created GLFramebuffer
     */
    initFramebuffer(framebuffer: Framebuffer): GLFramebuffer
    {
        const { gl } = this;
        const fbo = new GLFramebuffer(gl.createFramebuffer());

        fbo.multisample = this.detectSamples(framebuffer.multisample);
        framebuffer.glFramebuffers[this.CONTEXT_UID] = fbo;

        this.managedFramebuffers.push(framebuffer);
        framebuffer.disposeRunner.add(this);

        return fbo;
    }

    /**
     * Resize the framebuffer
     *
     * @protected
     * @param {PIXI.Framebuffer} framebuffer
     */
    resizeFramebuffer(framebuffer: Framebuffer): void
    {
        const { gl } = this;

        const fbo = framebuffer.glFramebuffers[this.CONTEXT_UID];

        if (fbo.msaaBuffer)
        {
            gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.msaaBuffer);
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample,
                gl.RGBA8, framebuffer.width, framebuffer.height);
        }

        if (fbo.stencil)
        {
            gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.stencil);

            if (fbo.msaaBuffer)
            {
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample,
                    gl.DEPTH24_STENCIL8, framebuffer.width, framebuffer.height);
            }
            else
            {
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, framebuffer.width, framebuffer.height);
            }
        }

        const colorTextures = framebuffer.colorTextures;

        for (let i = 0; i < colorTextures.length; i++)
        {
            const texture = colorTextures[i];
            const parentTexture = texture.parentTextureArray || texture;

            this.renderer.texture.bind(parentTexture, 0);
        }

        if (framebuffer.depthTexture)
        {
            this.renderer.texture.bind(framebuffer.depthTexture, 0);
        }
    }

    /**
     * Update the framebuffer
     *
     * @protected
     * @param {PIXI.Framebuffer} framebuffer
     * @param {number} mipLevel
     */
    updateFramebuffer(framebuffer: Framebuffer, mipLevel: number): void
    {
        const { gl } = this;

        const fbo = framebuffer.glFramebuffers[this.CONTEXT_UID];

        // bind the color texture
        const colorTextures = framebuffer.colorTextures;

        let count = colorTextures.length;

        if (!gl.drawBuffers)
        {
            count = Math.min(count, 1);
        }

        if (fbo.multisample > 1 && this.canMultisampleFramebuffer(framebuffer))
        {
            fbo.msaaBuffer = fbo.msaaBuffer || gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.msaaBuffer);
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample,
                gl.RGBA8, framebuffer.width, framebuffer.height);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, fbo.msaaBuffer);
        }
        else if (fbo.msaaBuffer)
        {
            gl.deleteRenderbuffer(fbo.msaaBuffer);
            fbo.msaaBuffer = null;
        }

        const activeTextures = [];

        for (let i = 0; i < count; i++)
        {
            const texture = colorTextures[i];
            const parentTexture = texture.parentTextureArray || texture;

            this.renderer.texture.bind(parentTexture, 0);

            if (i === 0 && fbo.msaaBuffer)
            {
                continue;
            }

            gl.framebufferTexture2D(gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0 + i,
                texture.target,
                parentTexture._glTextures[this.CONTEXT_UID].texture,
                mipLevel);

            activeTextures.push(gl.COLOR_ATTACHMENT0 + i);
        }

        if (activeTextures.length > 1)
        {
            gl.drawBuffers(activeTextures);
        }

        if (framebuffer.depthTexture)
        {
            const writeDepthTexture = this.writeDepthTexture;

            if (writeDepthTexture)
            {
                const depthTexture = framebuffer.depthTexture;

                this.renderer.texture.bind(depthTexture, 0);

                gl.framebufferTexture2D(gl.FRAMEBUFFER,
                    gl.DEPTH_ATTACHMENT,
                    gl.TEXTURE_2D,
                    depthTexture._glTextures[this.CONTEXT_UID].texture,
                    mipLevel);
            }
        }

        if (!fbo.stencil && (framebuffer.stencil || framebuffer.depth))
        {
            fbo.stencil = gl.createRenderbuffer();

            gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.stencil);

            if (fbo.msaaBuffer)
            {
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample,
                    gl.DEPTH24_STENCIL8, framebuffer.width, framebuffer.height);
            }
            else
            {
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, framebuffer.width, framebuffer.height);
            }
            // TODO.. this is depth AND stencil?
            if (!framebuffer.depthTexture)
            { // you can't have both, so one should take priority if enabled
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, fbo.stencil);
            }
        }
        else if (fbo.stencil)
        {
            gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.stencil);

            if (fbo.msaaBuffer)
            {
                gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample,
                    gl.DEPTH24_STENCIL8, framebuffer.width, framebuffer.height);
            }
            else
            {
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, framebuffer.width, framebuffer.height);
            }
        }
    }

    /**
     * Returns true if the frame buffer can be multisampled
     *
     * @protected
     * @param {PIXI.Framebuffer} framebuffer
     */
    protected canMultisampleFramebuffer(framebuffer: Framebuffer): boolean
    {
        return this.renderer.context.webGLVersion !== 1
            && framebuffer.colorTextures.length <= 1 && !framebuffer.depthTexture;
    }

    /**
     * Detects number of samples that is not more than a param but as close to it as possible
     *
     * @param {PIXI.MSAA_QUALITY} samples - number of samples
     * @returns {PIXI.MSAA_QUALITY} - recommended number of samples
     */
    protected detectSamples(samples: MSAA_QUALITY): MSAA_QUALITY
    {
        const { msaaSamples } = this;
        let res = MSAA_QUALITY.NONE;

        if (samples <= 1 || msaaSamples === null)
        {
            return res;
        }
        for (let i = 0; i < msaaSamples.length; i++)
        {
            if (msaaSamples[i] <= samples)
            {
                res = msaaSamples[i];
                break;
            }
        }

        if (res === 1)
        {
            res = MSAA_QUALITY.NONE;
        }

        return res;
    }

    /**
     * Only works with WebGL2
     *
     * blits framebuffer to another of the same or bigger size
     * after that target framebuffer is bound
     *
     * Fails with WebGL warning if blits multisample framebuffer to different size
     *
     * @param {PIXI.Framebuffer} [framebuffer] - by default it blits "into itself", from renderBuffer to texture.
     * @param {PIXI.Rectangle} [sourcePixels] - source rectangle in pixels
     * @param {PIXI.Rectangle} [destPixels] - dest rectangle in pixels, assumed to be the same as sourcePixels
     */
    public blit(framebuffer?: Framebuffer, sourcePixels?: Rectangle, destPixels?: Rectangle): void
    {
        const { current, renderer, gl, CONTEXT_UID } = this;

        if (renderer.context.webGLVersion !== 2)
        {
            return;
        }

        if (!current)
        {
            return;
        }
        const fbo = current.glFramebuffers[CONTEXT_UID];

        if (!fbo)
        {
            return;
        }
        if (!framebuffer)
        {
            if (!fbo.msaaBuffer)
            {
                return;
            }
            if (!fbo.blitFramebuffer)
            {
                fbo.blitFramebuffer = new Framebuffer(current.width, current.height);
                fbo.blitFramebuffer.addColorTexture(0, current.colorTextures[0]);
            }
            framebuffer = fbo.blitFramebuffer;
            framebuffer.width = current.width;
            framebuffer.height = current.height;
        }

        if (!sourcePixels)
        {
            sourcePixels = tempRectangle;
            sourcePixels.width = current.width;
            sourcePixels.height = current.height;
        }
        if (!destPixels)
        {
            destPixels = sourcePixels;
        }

        const sameSize = sourcePixels.width === destPixels.width && sourcePixels.height === destPixels.height;

        this.bind(framebuffer);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo.framebuffer);
        gl.blitFramebuffer(sourcePixels.x, sourcePixels.y, sourcePixels.width, sourcePixels.height,
            destPixels.x, destPixels.y, destPixels.width, destPixels.height,
            gl.COLOR_BUFFER_BIT, sameSize ? gl.NEAREST : gl.LINEAR
        );
    }

    /**
     * Disposes framebuffer
     * @param {PIXI.Framebuffer} framebuffer - framebuffer that has to be disposed of
     * @param {boolean} [contextLost=false] - If context was lost, we suppress all delete function calls
     */
    disposeFramebuffer(framebuffer: Framebuffer, contextLost?: boolean): void
    {
        const fbo = framebuffer.glFramebuffers[this.CONTEXT_UID];
        const gl = this.gl;

        if (!fbo)
        {
            return;
        }

        delete framebuffer.glFramebuffers[this.CONTEXT_UID];

        const index = this.managedFramebuffers.indexOf(framebuffer);

        if (index >= 0)
        {
            this.managedFramebuffers.splice(index, 1);
        }

        framebuffer.disposeRunner.remove(this);

        if (!contextLost)
        {
            gl.deleteFramebuffer(fbo.framebuffer);

            if (fbo.msaaBuffer)
            {
                gl.deleteRenderbuffer(fbo.msaaBuffer);
            }

            if (fbo.stencil)
            {
                gl.deleteRenderbuffer(fbo.stencil);
            }
        }
    }

    /**
     * Disposes all framebuffers, but not textures bound to them
     * @param {boolean} [contextLost=false] - If context was lost, we suppress all delete function calls
     */
    disposeAll(contextLost?: boolean): void
    {
        const list = this.managedFramebuffers;

        (this.managedFramebuffers as any) = [];

        for (let i = 0; i < list.length; i++)
        {
            this.disposeFramebuffer(list[i], contextLost);
        }
    }

    /**
     * Forcing creation of stencil buffer for current framebuffer, if it wasn't done before.
     * Used by MaskSystem, when its time to use stencil mask for Graphics element.
     *
     * Its an alternative for public lazy `framebuffer.enableStencil`, in case we need stencil without rebind.
     *
     * @private
     */
    forceStencil(): void
    {
        const framebuffer = this.current;

        if (!framebuffer)
        {
            return;
        }

        const fbo = framebuffer.glFramebuffers[this.CONTEXT_UID];

        if (!fbo || fbo.stencil)
        {
            return;
        }
        framebuffer.enableStencil();

        const w = framebuffer.width;
        const h = framebuffer.height;
        const gl = this.gl;
        const stencil = gl.createRenderbuffer();

        gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);

        if (fbo.msaaBuffer)
        {
            gl.renderbufferStorageMultisample(gl.RENDERBUFFER, fbo.multisample, gl.DEPTH24_STENCIL8, w, h);
        }
        else
        {
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
        }

        fbo.stencil = stencil;
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    }

    /**
     * resets framebuffer stored state, binds screen framebuffer
     *
     * should be called before renderTexture reset()
     */
    reset(): void
    {
        this.current = this.unknownFramebuffer;
        this.viewport = new Rectangle();
    }

    /**
     * @ignore
     */
    destroy(): void
    {
        this.renderer = null;
    }
}
