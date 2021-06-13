import { BLEND_MODES } from '@pixi/constants';
import { Container } from '@pixi/display';
import { hex2rgb } from '@pixi/utils';
import { settings } from '@pixi/settings';

import type { BaseTexture, Renderer } from '@pixi/core';
import type { ParticleBuffer } from './ParticleBuffer';
import type { IDestroyOptions } from '@pixi/display';

export interface IParticleProperties {
    vertices?: boolean;
    position?: boolean;
    rotation?: boolean;
    uvs?: boolean;
    tint?: boolean;
    alpha?: boolean;
    scale?: boolean;
}

/**
 * The ParticleContainer class is a really fast version of the Container built solely for speed,
 * so use when you need a lot of sprites or particles.
 *
 * The tradeoff of the ParticleContainer is that most advanced functionality will not work.
 * ParticleContainer implements the basic object transform (position, scale, rotation)
 * and some advanced functionality like tint (as of v4.5.6).
 *
 * Other more advanced functionality like masking, children, filters, etc will not work on sprites in this batch.
 *
 * It's extremely easy to use:
 * ```js
 * let container = new ParticleContainer();
 *
 * for (let i = 0; i < 100; ++i)
 * {
 *     let sprite = PIXI.Sprite.from("myImage.png");
 *     container.addChild(sprite);
 * }
 * ```
 *
 * And here you have a hundred sprites that will be rendered at the speed of light.
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
export class ParticleContainer extends Container
{
    public readonly blendMode: BLEND_MODES;
    public autoResize: boolean;
    public roundPixels: boolean;
    public baseTexture: BaseTexture;
    public tintRgb: Float32Array;

    _maxSize: number;
    _buffers: ParticleBuffer[];
    _batchSize: number;
    _properties: boolean[];
    _bufferUpdateIDs: number[];
    _updateID: number;
    private _tint: number;

    /**
     * @param {number} [maxSize=1500] - The maximum number of particles that can be rendered by the container.
     *  Affects size of allocated buffers.
     * @param {object} [properties] - The properties of children that should be uploaded to the gpu and applied.
     * @param {boolean} [properties.vertices=false] - When true, vertices be uploaded and applied.
     *                  if sprite's ` scale/anchor/trim/frame/orig` is dynamic, please set `true`.
     * @param {boolean} [properties.position=true] - When true, position be uploaded and applied.
     * @param {boolean} [properties.rotation=false] - When true, rotation be uploaded and applied.
     * @param {boolean} [properties.uvs=false] - When true, uvs be uploaded and applied.
     * @param {boolean} [properties.tint=false] - When true, alpha and tint be uploaded and applied.
     * @param {number} [batchSize=16384] - Number of particles per batch. If less than maxSize, it uses maxSize instead.
     * @param {boolean} [autoResize=false] - If true, container allocates more batches in case
     *  there are more than `maxSize` particles.
     */
    constructor(maxSize = 1500, properties: IParticleProperties, batchSize = 16384, autoResize = false)
    {
        super();

        // Making sure the batch size is valid
        // 65535 is max vertex index in the index buffer (see ParticleRenderer)
        // so max number of particles is 65536 / 4 = 16384
        const maxBatchSize = 16384;

        if (batchSize > maxBatchSize)
        {
            batchSize = maxBatchSize;
        }

        /**
         * Set properties to be dynamic (true) / static (false)
         *
         * @member {boolean[]}
         * @private
         */
        this._properties = [false, true, false, false, false];

        /**
         * @member {number}
         * @private
         */
        this._maxSize = maxSize;

        /**
         * @member {number}
         * @private
         */
        this._batchSize = batchSize;

        /**
         * @member {Array<PIXI.Buffer>}
         * @private
         */
        this._buffers = null;

        /**
         * for every batch stores _updateID corresponding to the last change in that batch
         * @member {number[]}
         * @private
         */
        this._bufferUpdateIDs = [];

        /**
         * when child inserted, removed or changes position this number goes up
         * @member {number[]}
         * @private
         */
        this._updateID = 0;

        /**
         * @member {boolean}
         *
         */
        this.interactiveChildren = false;

        /**
         * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL`
         * to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        this.blendMode = BLEND_MODES.NORMAL;

        /**
         * If true, container allocates more batches in case there are more than `maxSize` particles.
         * @member {boolean}
         * @default false
         */
        this.autoResize = autoResize;

        /**
         * If true PixiJS will Math.round() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}.
         *
         * @member {boolean}
         * @default PIXI.settings.ROUND_PIXELS
         */
        this.roundPixels = settings.ROUND_PIXELS;

        /**
         * The texture used to render the children.
         *
         * @readonly
         * @member {PIXI.BaseTexture}
         */
        this.baseTexture = null;

        this.setProperties(properties);

        /**
         * The tint applied to the container.
         * This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        this._tint = 0;
        this.tintRgb = new Float32Array(4);
        this.tint = 0xFFFFFF;
    }

    /**
     * Sets the private properties array to dynamic / static based on the passed properties object
     *
     * @param {object} properties - The properties to be uploaded
     */
    public setProperties(properties: IParticleProperties): void
    {
        if (properties)
        {
            this._properties[0] = 'vertices' in properties || 'scale' in properties
                ? !!properties.vertices || !!properties.scale : this._properties[0];
            this._properties[1] = 'position' in properties ? !!properties.position : this._properties[1];
            this._properties[2] = 'rotation' in properties ? !!properties.rotation : this._properties[2];
            this._properties[3] = 'uvs' in properties ? !!properties.uvs : this._properties[3];
            this._properties[4] = 'tint' in properties || 'alpha' in properties
                ? !!properties.tint || !!properties.alpha : this._properties[4];
        }
    }

    /**
     * Updates the object transform for rendering
     *
     * @private
     */
    updateTransform(): void
    {
        // TODO don't need to!
        this.displayObjectUpdateTransform();
    }

    /**
     * The tint applied to the container. This is a hex value.
     * A value of 0xFFFFFF will remove any tint effect.
     ** IMPORTANT: This is a WebGL only feature and will be ignored by the canvas renderer.
     * @member {number}
     * @default 0xFFFFFF
     */
    get tint(): number
    {
        return this._tint;
    }

    set tint(value: number)
    {
        this._tint = value;
        hex2rgb(value, this.tintRgb);
    }

    /**
     * Renders the container using the WebGL renderer
     *
     * @private
     * @param {PIXI.Renderer} renderer - The webgl renderer
     */
    public render(renderer: Renderer): void
    {
        if (!this.visible || this.worldAlpha <= 0 || !this.children.length || !this.renderable)
        {
            return;
        }

        if (!this.baseTexture)
        {
            this.baseTexture = (this.children[0] as any)._texture.baseTexture;
            if (!this.baseTexture.valid)
            {
                this.baseTexture.once('update', () => this.onChildrenChange(0));
            }
        }

        renderer.batch.setObjectRenderer(renderer.plugins.particle);
        renderer.plugins.particle.render(this);
    }

    /**
     * Set the flag that static data should be updated to true
     *
     * @private
     * @param {number} smallestChildIndex - The smallest child index
     */
    protected onChildrenChange(smallestChildIndex: number): void
    {
        const bufferIndex = Math.floor(smallestChildIndex / this._batchSize);

        while (this._bufferUpdateIDs.length < bufferIndex)
        {
            this._bufferUpdateIDs.push(0);
        }
        this._bufferUpdateIDs[bufferIndex] = ++this._updateID;
    }

    public dispose(): void
    {
        if (this._buffers)
        {
            for (let i = 0; i < this._buffers.length; ++i)
            {
                this._buffers[i].destroy();
            }

            this._buffers = null;
        }
    }

    /**
     * Destroys the container
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their
     *  destroy method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the texture of the child sprite
     * @param {boolean} [options.baseTexture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the base texture of the child sprite
     */
    public destroy(options?: IDestroyOptions|boolean): void
    {
        super.destroy(options);

        this.dispose();

        this._properties = null;
        this._buffers = null;
        this._bufferUpdateIDs = null;
    }
}
