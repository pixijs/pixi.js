import { ALPHA_MODES } from '@pixi/constants';
import { BufferResource } from './BufferResource';

import type { BaseTexture } from '../BaseTexture';
import type { Renderer } from '../../Renderer';
import type { GLTexture } from '../GLTexture';
/**
 * Resource type for DepthTexture.
 * @class
 * @extends PIXI.BufferResource
 * @memberof PIXI
 */
export class DepthResource extends BufferResource
{
    /**
     * Upload the texture to the GPU.
     * @param {PIXI.Renderer} renderer - Upload to the renderer
     * @param {PIXI.BaseTexture} baseTexture - Reference to parent texture
     * @param {PIXI.GLTexture} glTexture - glTexture
     * @returns {boolean} true is success
     */
    upload(renderer: Renderer, baseTexture: BaseTexture, glTexture: GLTexture): boolean
    {
        const gl = renderer.gl;

        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, baseTexture.alphaMode === ALPHA_MODES.UNPACK);

        const width = baseTexture.realWidth;
        const height = baseTexture.realHeight;

        if (glTexture.width === width && glTexture.height === height)
        {
            gl.texSubImage2D(
                baseTexture.target,
                0,
                0,
                0,
                width,
                height,
                baseTexture.format,
                glTexture.type,
                this.data,
            );
        }
        else
        {
            glTexture.width = width;
            glTexture.height = height;

            gl.texImage2D(
                baseTexture.target,
                0,
                glTexture.internalFormat,
                width,
                height,
                0,
                baseTexture.format,
                glTexture.type,
                this.data,
            );
        }

        return true;
    }
}
