import { TYPES } from '@pixi/constants';
import { ObjectRenderer, Shader, State } from '@pixi/core';
import { Matrix } from '@pixi/math';
import { correctBlendMode, premultiplyRgba, premultiplyTint } from '@pixi/utils';
import { ParticleBuffer } from './ParticleBuffer';
import fragment from './particles.frag';
import vertex from './particles.vert';

import type { DisplayObject } from '@pixi/display';
import type { ParticleContainer } from './ParticleContainer';
import type { Renderer } from '@pixi/core';

export interface IParticleRendererProperty {
    attributeName: string;
    size: number;
    type?: TYPES;
    uploadFunction: (...params: any[]) => any;
    offset: number;
}

/*
 * @author Mat Groves
 *
 * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
 * for creating the original PixiJS version!
 * Also a thanks to https://github.com/bchevalier for tweaking the tint and alpha so that they now
 * share 4 bytes on the vertex buffer
 *
 * Heavily inspired by LibGDX's ParticleRenderer:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/ParticleRenderer.java
 */

/**
 * Renderer for Particles that is designer for speed over feature set.
 *
 * @class
 * @memberof PIXI
 */
export class ParticleRenderer extends ObjectRenderer
{
    public readonly state: State;
    public shader: Shader;
    public tempMatrix: Matrix;
    public properties: IParticleRendererProperty[];

    /**
     * @param {PIXI.Renderer} renderer - The renderer this sprite batch works for.
     */
    constructor(renderer: Renderer)
    {
        super(renderer);

        // 65535 is max vertex index in the index buffer (see ParticleRenderer)
        // so max number of particles is 65536 / 4 = 16384
        // and max number of element in the index buffer is 16384 * 6 = 98304
        // Creating a full index buffer, overhead is 98304 * 2 = 196Ko
        // let numIndices = 98304;

        /**
         * The default shader that is used if a sprite doesn't have a more specific one.
         *
         * @member {PIXI.Shader}
         */
        this.shader = null;

        this.properties = null;

        this.tempMatrix = new Matrix();

        this.properties = [
            // verticesData
            {
                attributeName: 'aVertexPosition',
                size: 2,
                uploadFunction: this.uploadVertices,
                offset: 0,
            },
            // positionData
            {
                attributeName: 'aPositionCoord',
                size: 2,
                uploadFunction: this.uploadPosition,
                offset: 0,
            },
            // rotationData
            {
                attributeName: 'aRotation',
                size: 1,
                uploadFunction: this.uploadRotation,
                offset: 0,
            },
            // uvsData
            {
                attributeName: 'aTextureCoord',
                size: 2,
                uploadFunction: this.uploadUvs,
                offset: 0,
            },
            // tintData
            {
                attributeName: 'aColor',
                size: 1,
                type: TYPES.UNSIGNED_BYTE,
                uploadFunction: this.uploadTint,
                offset: 0,
            },
        ];

        this.shader = Shader.from(vertex, fragment, {});

        /**
         * The WebGL state in which this renderer will work.
         *
         * @member {PIXI.State}
         * @readonly
         */
        this.state = State.for2d();
    }

    /**
     * Renders the particle container object.
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     */
    public render(container: ParticleContainer): void
    {
        const children = container.children;
        const maxSize = container._maxSize;
        const batchSize = container._batchSize;
        const renderer = this.renderer;
        let totalChildren = children.length;

        if (totalChildren === 0)
        {
            return;
        }
        else if (totalChildren > maxSize && !container.autoResize)
        {
            totalChildren = maxSize;
        }

        let buffers = container._buffers;

        if (!buffers)
        {
            buffers = container._buffers = this.generateBuffers(container);
        }

        const baseTexture = (children[0] as any)._texture.baseTexture;

        // if the uvs have not updated then no point rendering just yet!
        this.state.blendMode = correctBlendMode(container.blendMode, baseTexture.alphaMode);
        renderer.state.set(this.state);

        const gl = renderer.gl;

        const m = container.worldTransform.copyTo(this.tempMatrix);

        if (container.roundPixels)
        {
            m.tx = Math.round(m.tx);
            m.ty = Math.round(m.ty);
        }

        m.prepend(renderer.globalUniforms.uniforms.projectionMatrix);

        this.shader.uniforms.translationMatrix = m.toArray(true);

        this.shader.uniforms.uColor = premultiplyRgba(container.tintRgb,
            container.worldAlpha, this.shader.uniforms.uColor, baseTexture.alphaMode);

        this.shader.uniforms.uSampler = baseTexture;

        this.renderer.shader.bind(this.shader);

        let updateStatic = false;

        // now lets upload and render the buffers..
        for (let i = 0, j = 0; i < totalChildren; i += batchSize, j += 1)
        {
            let amount = (totalChildren - i);

            if (amount > batchSize)
            {
                amount = batchSize;
            }

            if (j >= buffers.length)
            {
                buffers.push(this._generateOneMoreBuffer(container));
            }

            const buffer = buffers[j];

            // we always upload the dynamic
            buffer.uploadDynamic(children, i, amount);

            const bid = container._bufferUpdateIDs[j] || 0;

            updateStatic = updateStatic || (buffer._updateID < bid);
            // we only upload the static content when we have to!
            if (updateStatic)
            {
                buffer._updateID = container._updateID;
                buffer.uploadStatic(children, i, amount);
            }

            // bind the buffer
            renderer.geometry.bind(buffer.geometry);
            gl.drawElements(gl.TRIANGLES, amount * 6, gl.UNSIGNED_SHORT, 0);
        }
    }

    /**
     * Creates one particle buffer for each child in the container we want to render and updates internal properties
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     * @return {PIXI.ParticleBuffer[]} The buffers
     * @private
     */
    private generateBuffers(container: ParticleContainer): ParticleBuffer[]
    {
        const buffers = [];
        const size = container._maxSize;
        const batchSize = container._batchSize;
        const dynamicPropertyFlags = container._properties;

        for (let i = 0; i < size; i += batchSize)
        {
            buffers.push(new ParticleBuffer(this.properties, dynamicPropertyFlags, batchSize));
        }

        return buffers;
    }

    /**
     * Creates one more particle buffer, because container has autoResize feature
     *
     * @param {PIXI.ParticleContainer} container - The container to render using this ParticleRenderer
     * @return {PIXI.ParticleBuffer} generated buffer
     * @private
     */
    private _generateOneMoreBuffer(container: ParticleContainer): ParticleBuffer
    {
        const batchSize = container._batchSize;
        const dynamicPropertyFlags = container._properties;

        return new ParticleBuffer(this.properties, dynamicPropertyFlags, batchSize);
    }

    /**
     * Uploads the vertices.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their vertices uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    public uploadVertices(
        children: DisplayObject[], startIndex: number, amount: number,
        array: number[], stride: number, offset: number
    ): void
    {
        if (children.length === 0)
        {
            return;
        }

        const container = children[0].parent as ParticleContainer;
        let sx;
        let sy;

        if (container.roundPixels)
        {
            const { a, b, c, d } = container.worldTransform;

            sx = Math.sqrt((a * a) + (b * b));
            sy = Math.sqrt((c * c) + (d * d));
        }

        let w0 = 0;
        let w1 = 0;
        let h0 = 0;
        let h1 = 0;

        for (let i = 0; i < amount; ++i)
        {
            const sprite: any = children[startIndex + i];
            const texture = sprite._texture;
            const trim = texture.trim;
            const orig = texture.orig;

            if (trim)
            {
                // if the sprite is trimmed and is not a tilingsprite then we need to add the
                // extra space before transforming the sprite coords..
                w1 = trim.x - (sprite.anchor.x * orig.width);
                w0 = trim.width;

                h1 = trim.y - (sprite.anchor.y * orig.height);
                h0 = trim.height;
            }
            else
            {
                w1 = -sprite.anchor.x * orig.width;
                w0 = orig.width;

                h1 = -sprite.anchor.y * orig.height;
                h0 = orig.height;
            }

            w0 *= sprite.scale.x;
            w1 *= sprite.scale.x;
            h0 *= sprite.scale.y;
            h1 *= sprite.scale.y;

            if (container.roundPixels)
            {
                w0 = Math.round(w0 * sx) / sx;
                w1 = Math.round(w1 * sx) / sx;
                h0 = Math.round(h0 * sy) / sy;
                h1 = Math.round(h1 * sy) / sy;
            }

            w0 += w1;
            h0 += h1;

            array[offset] = w1;
            array[offset + 1] = h1;

            array[offset + stride] = w0;
            array[offset + stride + 1] = h1;

            array[offset + (stride * 2)] = w0;
            array[offset + (stride * 2) + 1] = h0;

            array[offset + (stride * 3)] = w1;
            array[offset + (stride * 3) + 1] = h0;

            offset += stride * 4;
        }
    }

    /**
     * Uploads the position.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their positions uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    public uploadPosition(
        children: DisplayObject[], startIndex: number, amount: number,
        array: number[], stride: number, offset: number
    ): void
    {
        for (let i = 0; i < amount; i++)
        {
            const spritePosition = children[startIndex + i].position;

            array[offset] = spritePosition.x;
            array[offset + 1] = spritePosition.y;

            array[offset + stride] = spritePosition.x;
            array[offset + stride + 1] = spritePosition.y;

            array[offset + (stride * 2)] = spritePosition.x;
            array[offset + (stride * 2) + 1] = spritePosition.y;

            array[offset + (stride * 3)] = spritePosition.x;
            array[offset + (stride * 3) + 1] = spritePosition.y;

            offset += stride * 4;
        }
    }

    /**
     * Uploads the rotation.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    public uploadRotation(
        children: DisplayObject[], startIndex: number, amount: number,
        array: number[], stride: number, offset: number
    ): void
    {
        for (let i = 0; i < amount; i++)
        {
            const spriteRotation = children[startIndex + i].rotation;

            array[offset] = spriteRotation;
            array[offset + stride] = spriteRotation;
            array[offset + (stride * 2)] = spriteRotation;
            array[offset + (stride * 3)] = spriteRotation;

            offset += stride * 4;
        }
    }

    /**
     * Uploads the Uvs
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    public uploadUvs(
        children: DisplayObject[], startIndex: number, amount: number,
        array: number[], stride: number, offset: number
    ): void
    {
        for (let i = 0; i < amount; ++i)
        {
            const textureUvs = (children[startIndex + i] as any)._texture._uvs;

            if (textureUvs)
            {
                array[offset] = textureUvs.x0;
                array[offset + 1] = textureUvs.y0;

                array[offset + stride] = textureUvs.x1;
                array[offset + stride + 1] = textureUvs.y1;

                array[offset + (stride * 2)] = textureUvs.x2;
                array[offset + (stride * 2) + 1] = textureUvs.y2;

                array[offset + (stride * 3)] = textureUvs.x3;
                array[offset + (stride * 3) + 1] = textureUvs.y3;

                offset += stride * 4;
            }
            else
            {
                // TODO you know this can be easier!
                array[offset] = 0;
                array[offset + 1] = 0;

                array[offset + stride] = 0;
                array[offset + stride + 1] = 0;

                array[offset + (stride * 2)] = 0;
                array[offset + (stride * 2) + 1] = 0;

                array[offset + (stride * 3)] = 0;
                array[offset + (stride * 3) + 1] = 0;

                offset += stride * 4;
            }
        }
    }

    /**
     * Uploads the tint.
     *
     * @param {PIXI.DisplayObject[]} children - the array of display objects to render
     * @param {number} startIndex - the index to start from in the children array
     * @param {number} amount - the amount of children that will have their rotation uploaded
     * @param {number[]} array - The vertices to upload.
     * @param {number} stride - Stride to use for iteration.
     * @param {number} offset - Offset to start at.
     */
    public uploadTint(
        children: DisplayObject[], startIndex: number, amount: number,
        array: number[], stride: number, offset: number
    ): void
    {
        for (let i = 0; i < amount; ++i)
        {
            const sprite: any = children[startIndex + i];
            const premultiplied = sprite._texture.baseTexture.alphaMode > 0;
            const alpha = sprite.alpha;

            // we dont call extra function if alpha is 1.0, that's faster
            const argb = alpha < 1.0 && premultiplied
                ? premultiplyTint(sprite._tintRGB, alpha) : sprite._tintRGB + (alpha * 255 << 24);

            array[offset] = argb;
            array[offset + stride] = argb;
            array[offset + (stride * 2)] = argb;
            array[offset + (stride * 3)] = argb;

            offset += stride * 4;
        }
    }

    /**
     * Destroys the ParticleRenderer.
     */
    public destroy(): void
    {
        super.destroy();

        if (this.shader)
        {
            this.shader.destroy();
            this.shader = null;
        }

        this.tempMatrix = null;
    }
}
