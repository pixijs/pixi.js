import { BLEND_MODES } from '@pixi/constants';
import { Texture } from '@pixi/core';
import { Container } from '@pixi/display';
import { ObservablePoint, Point, Rectangle } from '@pixi/math';
import { settings } from '@pixi/settings';
import { sign } from '@pixi/utils';

import type { IBaseTextureOptions, Renderer, TextureSource } from '@pixi/core';
import type { IDestroyOptions } from '@pixi/display';
import type { IPointData } from '@pixi/math';

const tempPoint = new Point();
const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

export type SpriteSource = TextureSource|Texture;

export interface Sprite extends GlobalMixins.Sprite, Container {}

/**
 * The Sprite object is the base for all textured objects that are rendered to the screen
*
 * A sprite can be created directly from an image like this:
 *
 * ```js
 * let sprite = PIXI.Sprite.from('assets/image.png');
 * ```
 *
 * The more efficient way to create sprites is using a {@link PIXI.Spritesheet},
 * as swapping base textures when rendering to the screen is inefficient.
 *
 * ```js
 * PIXI.Loader.shared.add("assets/spritesheet.json").load(setup);
 *
 * function setup() {
 *   let sheet = PIXI.Loader.shared.resources["assets/spritesheet.json"].spritesheet;
 *   let sprite = new PIXI.Sprite(sheet.textures["image.png"]);
 *   ...
 * }
 * ```
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
export class Sprite extends Container
{
    public blendMode: BLEND_MODES;
    public indices: Uint16Array;
    public pluginName: string;

    _width: number;
    _height: number;
    _texture: Texture;
    _textureID: number;
    _cachedTint: number;
    protected _textureTrimmedID: number;
    protected uvs: Float32Array;
    protected _anchor: ObservablePoint;
    protected vertexData: Float32Array;

    private vertexTrimmedData: Float32Array;
    private _roundPixels: boolean;
    private _transformID: number;
    private _transformTrimmedID: number;
    private _tint: number;

    // Internal-only properties
    _tintRGB: number;

    /**
     * @param {PIXI.Texture} [texture] - The texture for this sprite.
     */
    constructor(texture?: Texture)
    {
        super();

        /**
         * The anchor point defines the normalized coordinates
         * in the texture that map to the position of this
         * sprite.
         *
         * By default, this is `(0,0)` (or `texture.defaultAnchor`
         * if you have modified that), which means the position
         * `(x,y)` of this `Sprite` will be the top-left corner.
         *
         * Note: Updating `texture.defaultAnchor` after
         * constructing a `Sprite` does _not_ update its anchor.
         *
         * {@link https://docs.cocos2d-x.org/cocos2d-x/en/sprites/manipulation.html}
         *
         * @default `texture.defaultAnchor`
         * @member {PIXI.ObservablePoint}
         * @private
         */
        this._anchor = new ObservablePoint(
            this._onAnchorUpdate,
            this,
            (texture ? texture.defaultAnchor.x : 0),
            (texture ? texture.defaultAnchor.y : 0)
        );

        /**
         * The texture that the sprite is using
         *
         * @private
         * @member {PIXI.Texture}
         */
        this._texture = null;

        /**
         * The width of the sprite (this is initially set by the texture)
         *
         * @protected
         * @member {number}
         */
        this._width = 0;

        /**
         * The height of the sprite (this is initially set by the texture)
         *
         * @protected
         * @member {number}
         */
        this._height = 0;

        /**
         * The tint applied to the sprite. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 0xFFFFFF
         */
        this._tint = null;

        /**
         * The tint applied to the sprite. This is a RGB value. A value of 0xFFFFFF will remove any tint effect.
         *
         * @private
         * @member {number}
         * @default 16777215
         */
        this._tintRGB = null;

        this.tint = 0xFFFFFF;

        /**
         * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        this.blendMode = BLEND_MODES.NORMAL;

        /**
         * Cached tint value so we can tell when the tint is changed.
         * Value is used for 2d CanvasRenderer.
         *
         * @protected
         * @member {number}
         * @default 0xFFFFFF
         */
        this._cachedTint = 0xFFFFFF;

        /**
         * this is used to store the uvs data of the sprite, assigned at the same time
         * as the vertexData in calculateVertices()
         *
         * @private
         * @member {Float32Array}
         */
        this.uvs = null;

        // call texture setter
        this.texture = texture || Texture.EMPTY;

        /**
         * this is used to store the vertex data of the sprite (basically a quad)
         *
         * @private
         * @member {Float32Array}
         */
        this.vertexData = new Float32Array(8);

        /**
         * This is used to calculate the bounds of the object IF it is a trimmed sprite
         *
         * @private
         * @member {Float32Array}
         */
        this.vertexTrimmedData = null;

        this._transformID = -1;
        this._textureID = -1;

        this._transformTrimmedID = -1;
        this._textureTrimmedID = -1;

        // Batchable stuff..
        // TODO could make this a mixin?
        this.indices = indices;

        /**
         * Plugin that is responsible for rendering this element.
         * Allows to customize the rendering process without overriding '_render' & '_renderCanvas' methods.
         *
         * @member {string}
         * @default 'batch'
         */
        this.pluginName = 'batch';

        /**
         * used to fast check if a sprite is.. a sprite!
         * @member {boolean}
         */
        this.isSprite = true;

        /**
         * Internal roundPixels field
         *
         * @member {boolean}
         * @default PIXI.settings.ROUND_PIXELS
         * @private
         */
        this._roundPixels = settings.ROUND_PIXELS;
    }

    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @protected
     */
    protected _onTextureUpdate(): void
    {
        this._textureID = -1;
        this._textureTrimmedID = -1;
        this._cachedTint = 0xFFFFFF;

        // so if _width is 0 then width was not set..
        if (this._width)
        {
            this.scale.x = sign(this.scale.x) * this._width / this._texture.orig.width;
        }

        if (this._height)
        {
            this.scale.y = sign(this.scale.y) * this._height / this._texture.orig.height;
        }
    }

    /**
     * Called when the anchor position updates.
     *
     * @private
     */
    private _onAnchorUpdate(): void
    {
        this._transformID = -1;
        this._transformTrimmedID = -1;
    }

    /**
     * calculates worldTransform * vertices, store it in vertexData
     */
    public calculateVertices(): void
    {
        const texture = this._texture;

        if (this._transformID === this.transform._worldID && this._textureID === texture._updateID)
        {
            return;
        }

        // update texture UV here, because base texture can be changed without calling `_onTextureUpdate`
        if (this._textureID !== texture._updateID)
        {
            this.uvs = this._texture._uvs.uvsFloat32;
        }

        this._transformID = this.transform._worldID;
        this._textureID = texture._updateID;

        // set the vertex data

        const wt = this.transform.worldTransform;
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        let tx = wt.tx;
        let ty = wt.ty;
        const vertexData = this.vertexData;
        const trim = texture.trim;
        const orig = texture.orig;
        const anchor = this._anchor;

        let w0 = 0;
        let w1 = 0;
        let h0 = 0;
        let h1 = 0;

        if (trim)
        {
            // if the sprite is trimmed and is not a tilingsprite then we need to add the extra
            // space before transforming the sprite coords.
            w1 = trim.x - (anchor._x * orig.width);
            w0 = trim.width;

            h1 = trim.y - (anchor._y * orig.height);
            h0 = trim.height;
        }
        else
        {
            w1 = -anchor._x * orig.width;
            w0 = orig.width;

            h1 = -anchor._y * orig.height;
            h0 = orig.height;
        }

        if (this._roundPixels)
        {
            tx = Math.round(tx);
            ty = Math.round(ty);

            const sx = Math.sqrt((a * a) + (b * b));
            const sy = Math.sqrt((c * c) + (d * d));

            w0 = Math.round(w0 * sx) / sx;
            w1 = Math.round(w1 * sx) / sx;
            h0 = Math.round(h0 * sy) / sy;
            h1 = Math.round(h1 * sy) / sy;
        }

        w0 += w1;
        h0 += h1;

        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;

        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;

        // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;

        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    /**
     * calculates worldTransform * vertices for a non texture with a trim. store it in vertexTrimmedData
     * This is used to ensure that the true width and height of a trimmed texture is respected
     */
    public calculateTrimmedVertices(): void
    {
        if (!this.vertexTrimmedData)
        {
            this.vertexTrimmedData = new Float32Array(8);
        }
        else if (this._transformTrimmedID === this.transform._worldID && this._textureTrimmedID === this._texture._updateID)
        {
            return;
        }

        this._transformTrimmedID = this.transform._worldID;
        this._textureTrimmedID = this._texture._updateID;

        // lets do some special trim code!
        const texture = this._texture;
        const vertexData = this.vertexTrimmedData;
        const orig = texture.orig;
        const anchor = this._anchor;

        // lets calculate the new untrimmed bounds..
        const wt = this.transform.worldTransform;
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        let tx = wt.tx;
        let ty = wt.ty;

        let w1 = -anchor._x * orig.width;
        let w0 = orig.width;

        let h1 = -anchor._y * orig.height;
        let h0 = orig.height;

        if (this._roundPixels)
        {
            tx = Math.round(tx);
            ty = Math.round(ty);

            const sx = Math.sqrt((a * a) + (b * b));
            const sy = Math.sqrt((c * c) + (d * d));

            w0 = Math.round(w0 * sx) / sx;
            w1 = Math.round(w1 * sx) / sx;
            h0 = Math.round(h0 * sy) / sy;
            h1 = Math.round(h1 * sy) / sy;
        }

        w0 += w1;
        h0 += h1;

        // xy
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;

        // xy
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;

        // xy
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;

        // xy
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    /**
    *
    * Renders the object using the WebGL renderer
    *
    * @protected
    * @param {PIXI.Renderer} renderer - The webgl renderer to use.
    */
    protected _render(renderer: Renderer): void
    {
        this.calculateVertices();

        renderer.batch.setObjectRenderer(renderer.plugins[this.pluginName]);
        renderer.plugins[this.pluginName].render(this);
    }

    /**
     * Updates the bounds of the sprite.
     *
     * @protected
     */
    protected _calculateBounds(): void
    {
        const trim = this._texture.trim;
        const orig = this._texture.orig;

        // First lets check to see if the current texture has a trim..
        if (!trim || (trim.width === orig.width && trim.height === orig.height))
        {
            // no trim! lets use the usual calculations..
            this.calculateVertices();
            this._bounds.addQuad(this.vertexData);
        }
        else
        {
            // lets calculate a special trimmed bounds...
            this.calculateTrimmedVertices();
            this._bounds.addQuad(this.vertexTrimmedData);
        }
    }

    /**
     * Gets the local bounds of the sprite object.
     *
     * @param {PIXI.Rectangle} [rect] - Optional output rectangle.
     * @return {PIXI.Rectangle} The bounds.
     */
    public getLocalBounds(rect?: Rectangle): Rectangle
    {
        // we can do a fast local bounds if the sprite has no children!
        if (this.children.length === 0)
        {
            this._bounds.minX = this._texture.orig.width * -this._anchor._x;
            this._bounds.minY = this._texture.orig.height * -this._anchor._y;
            this._bounds.maxX = this._texture.orig.width * (1 - this._anchor._x);
            this._bounds.maxY = this._texture.orig.height * (1 - this._anchor._y);

            if (!rect)
            {
                if (!this._localBoundsRect)
                {
                    this._localBoundsRect = new Rectangle();
                }

                rect = this._localBoundsRect;
            }

            return this._bounds.getRectangle(rect);
        }

        return super.getLocalBounds.call(this, rect);
    }

    /**
     * Tests if a point is inside this sprite
     *
     * @param {PIXI.IPointData} point - the point to test
     * @return {boolean} the result of the test
     */
    public containsPoint(point: IPointData): boolean
    {
        this.worldTransform.applyInverse(point, tempPoint);

        const width = this._texture.orig.width;
        const height = this._texture.orig.height;
        const x1 = -width * this.anchor.x;
        let y1 = 0;

        if (tempPoint.x >= x1 && tempPoint.x < x1 + width)
        {
            y1 = -height * this.anchor.y;

            if (tempPoint.y >= y1 && tempPoint.y < y1 + height)
            {
                return true;
            }
        }

        return false;
    }

    /**
     * Destroys this sprite and optionally its texture and children
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
     *  have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
     *      method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well
     * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well
     */
    public destroy(options?: IDestroyOptions|boolean): void
    {
        super.destroy(options);

        this._texture.off('update', this._onTextureUpdate, this);

        this._anchor = null;

        const destroyTexture = typeof options === 'boolean' ? options : options && options.texture;

        if (destroyTexture)
        {
            const destroyBaseTexture = typeof options === 'boolean' ? options : options && options.baseTexture;

            this._texture.destroy(!!destroyBaseTexture);
        }

        this._texture = null;
    }

    // some helper functions..

    /**
     * Helper function that creates a new sprite based on the source you provide.
     * The source can be - frame id, image url, video url, canvas element, video element, base texture
     *
     * @static
     * @param {string|PIXI.Texture|HTMLCanvasElement|HTMLVideoElement} source - Source to create texture from
     * @param {object} [options] - See {@link PIXI.BaseTexture}'s constructor for options.
     * @return {PIXI.Sprite} The newly created sprite
     */
    static from(source: SpriteSource, options?: IBaseTextureOptions): Sprite
    {
        const texture = (source instanceof Texture)
            ? source
            : Texture.from(source, options);

        return new Sprite(texture);
    }

    /**
     * If true PixiJS will Math.round() x/y values when rendering, stopping pixel interpolation.
     * Advantages can include sharper image quality (like text) and faster rendering on canvas.
     * The main disadvantage is movement of objects may appear less smooth.
     * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}.
     *
     * @member {boolean}
     * @default PIXI.settings.ROUND_PIXELS
     */
    set roundPixels(value: boolean)
    {
        if (this._roundPixels !== value)
        {
            this._transformID = -1;
        }
        this._roundPixels = value;
    }

    get roundPixels(): boolean
    {
        return this._roundPixels;
    }

    /**
     * The width of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     */
    get width(): number
    {
        return Math.abs(this.scale.x) * this._texture.orig.width;
    }

    set width(value: number)
    {
        const s = sign(this.scale.x) || 1;

        this.scale.x = s * value / this._texture.orig.width;
        this._width = value;
    }

    /**
     * The height of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     */
    get height(): number
    {
        return Math.abs(this.scale.y) * this._texture.orig.height;
    }

    set height(value: number)
    {
        const s = sign(this.scale.y) || 1;

        this.scale.y = s * value / this._texture.orig.height;
        this._height = value;
    }

    /**
     * The anchor sets the origin point of the sprite. The default value is taken from the {@link PIXI.Texture|Texture}
     * and passed to the constructor.
     *
     * The default is `(0,0)`, this means the sprite's origin is the top left.
     *
     * Setting the anchor to `(0.5,0.5)` means the sprite's origin is centered.
     *
     * Setting the anchor to `(1,1)` would mean the sprite's origin point will be the bottom right corner.
     *
     * If you pass only single parameter, it will set both x and y to the same value as shown in the example below.
     *
     * @example
     * const sprite = new PIXI.Sprite(texture);
     * sprite.anchor.set(0.5); // This will set the origin to center. (0.5) is same as (0.5, 0.5).
     *
     * @member {PIXI.ObservablePoint}
     */
    get anchor(): ObservablePoint
    {
        return this._anchor;
    }

    set anchor(value: ObservablePoint)
    {
        this._anchor.copyFrom(value);
    }

    /**
     * The tint applied to the sprite. This is a hex value.
     * A value of 0xFFFFFF will remove any tint effect.
     *
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
        this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
    }

    /**
     * The texture that the sprite is using
     *
     * @member {PIXI.Texture}
     */
    get texture(): Texture
    {
        return this._texture;
    }

    set texture(value: Texture)
    {
        if (this._texture === value)
        {
            return;
        }

        if (this._texture)
        {
            this._texture.off('update', this._onTextureUpdate, this);
        }

        this._texture = value || Texture.EMPTY;
        this._cachedTint = 0xFFFFFF;

        this._textureID = -1;
        this._textureTrimmedID = -1;

        if (value)
        {
            // wait for the texture to load
            if (value.baseTexture.valid)
            {
                this._onTextureUpdate();
            }
            else
            {
                value.once('update', this._onTextureUpdate, this);
            }
        }
    }
}
