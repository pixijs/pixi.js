import { AbstractMultiResource } from './AbstractMultiResource';
import { TARGETS } from '@pixi/constants';
import { BaseTexture } from '../BaseTexture';

import type { BaseImageResource } from './BaseImageResource';
import type { Renderer } from '../../Renderer';
import type { GLTexture } from '../GLTexture';
import type { ISize } from '@pixi/math';

/**
 * A resource that contains a number of sources.
 *
 * @class
 * @extends PIXI.Resource
 * @memberof PIXI
 */
export class ArrayResource extends AbstractMultiResource
{
    /**
     * @param {number|Array<*>} source - Number of items in array or the collection
     *        of image URLs to use. Can also be resources, image elements, canvas, etc.
     * @param {object} [options] - Options to apply to {@link PIXI.autoDetectResource}
     * @param {number} [options.width] - Width of the resource
     * @param {number} [options.height] - Height of the resource
     */
    constructor(source: number|Array<any>, options?: ISize)
    {
        const { width, height } = options || {};

        let urls;
        let length: number;

        if (Array.isArray(source))
        {
            urls = source;
            length = source.length;
        }
        else
        {
            length = source;
        }

        super(length, { width, height });

        if (urls)
        {
            this.initFromArray(urls, options);
        }
    }
    /**
     * Set a baseTexture by ID,
     * ArrayResource just takes resource from it, nothing more
     *
     * @param {PIXI.BaseTexture} baseTexture
     * @param {number} index - Zero-based index of resource to set
     * @return {PIXI.ArrayResource} Instance for chaining
     */
    addBaseTextureAt(baseTexture: BaseTexture, index: number): this
    {
        if (baseTexture.resource)
        {
            this.addResourceAt(baseTexture.resource, index);
        }
        else
        {
            throw new Error('ArrayResource does not support RenderTexture');
        }

        return this;
    }

    /**
     * Add binding
     * @member {PIXI.BaseTexture}
     * @override
     */
    bind(baseTexture: BaseTexture): void
    {
        super.bind(baseTexture);

        baseTexture.target = TARGETS.TEXTURE_2D_ARRAY;
    }

    /**
     * Upload the resources to the GPU.
     * @param {PIXI.Renderer} renderer
     * @param {PIXI.BaseTexture} texture
     * @param {PIXI.GLTexture} glTexture
     * @returns {boolean} whether texture was uploaded
     */
    upload(renderer: Renderer, texture: BaseTexture, glTexture: GLTexture): boolean
    {
        const { length, itemDirtyIds, items } = this;
        const { gl } = renderer;

        if (glTexture.dirtyId < 0)
        {
            gl.texImage3D(
                gl.TEXTURE_2D_ARRAY,
                0,
                glTexture.internalFormat,
                this._width,
                this._height,
                length,
                0,
                texture.format,
                glTexture.type,
                null
            );
        }

        for (let i = 0; i < length; i++)
        {
            const item = items[i];

            if (itemDirtyIds[i] < item.dirtyId)
            {
                itemDirtyIds[i] = item.dirtyId;
                if (item.valid)
                {
                    gl.texSubImage3D(
                        gl.TEXTURE_2D_ARRAY,
                        0,
                        0, // xoffset
                        0, // yoffset
                        i, // zoffset
                        item.resource.width,
                        item.resource.height,
                        1,
                        texture.format,
                        glTexture.type,
                        (item.resource as BaseImageResource).source
                    );
                }
            }
        }

        return true;
    }
}
