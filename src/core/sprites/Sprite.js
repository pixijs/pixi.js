var math = require('../math'),
    Texture = require('../textures/Texture'),
    Container = require('../display/Container'),
    Geometry2d = require('../display/Geometry2d'),
    utils = require('../utils'),
    CONST = require('../const'),
    tempPoint = new math.Point();

/**
 * The Sprite object is the base for all textured objects that are rendered to the screen
 *
 * A sprite can be created directly from an image like this:
 *
 * ```js
 * var sprite = new PIXI.Sprite.fromImage('assets/image.png');
 * ```
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 * @param texture {PIXI.Texture} The texture for this sprite
 */
function Sprite(texture)
{
    Container.call(this);

    /**
     * The anchor sets the origin point of the texture.
     * The default is 0,0 this means the texture's origin is the top left
     * Setting the anchor to 0.5,0.5 means the texture's origin is centered
     * Setting the anchor to 1,1 would mean the texture's origin point will be the bottom right corner
     *
     * @member {PIXI.Point}
     */
    this.anchor = new math.Point();

    /**
     * The texture that the sprite is using
     *
     * @member {PIXI.Texture}
     * @private
     */
    this._texture = null;

    /**
     * The width of the sprite (this is initially set by the texture)
     *
     * @member {number}
     * @private
     */
    this._width = 0;

    /**
     * The height of the sprite (this is initially set by the texture)
     *
     * @member {number}
     * @private
     */
    this._height = 0;

    /**
     * The tint applied to the sprite. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
     *
     * @member {number}
     * @default 0xFFFFFF
     */
    this.tint = 0xFFFFFF;

    /**
     * The blend mode to be applied to the sprite. Apply a value of `PIXI.BLEND_MODES.NORMAL` to reset the blend mode.
     *
     * @member {number}
     * @default PIXI.BLEND_MODES.NORMAL
     * @see PIXI.BLEND_MODES
     */
    this.blendMode = CONST.BLEND_MODES.NORMAL;

    /**
     * The shader that will be used to render the sprite. Set to null to remove a current shader.
     *
     * @member {PIXI.AbstractFilter|PIXI.Shader}
     */
    this.shader = null;

    /**
     * An internal cached value of the tint.
     *
     * @member {number}
     * @default 0xFFFFFF
     */
    this.cachedTint = 0xFFFFFF;

    // call texture setter
    this.texture = texture || Texture.EMPTY;
    this.textureDirty = true;
    this.geometry = new Geometry2d();
    this.geometry.size = 4;
}

// constructor
Sprite.prototype = Object.create(Container.prototype);
Sprite.prototype.constructor = Sprite;
module.exports = Sprite;

Object.defineProperties(Sprite.prototype, {
    /**
     * The width of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Sprite#
     */
    width: {
        get: function ()
        {
            return Math.abs(this.scale.x) * this.texture.crop.width;
        },
        set: function (value)
        {
            var sign = utils.sign(this.scale.x) || 1;
            this.scale.x = sign * value / this.texture.crop.width;
            this._width = value;
        }
    },

    /**
     * The height of the sprite, setting this will actually modify the scale to achieve the value set
     *
     * @member {number}
     * @memberof PIXI.Sprite#
     */
    height: {
        get: function ()
        {
            return  Math.abs(this.scale.y) * this.texture.crop.height;
        },
        set: function (value)
        {
            var sign = utils.sign(this.scale.y) || 1;
            this.scale.y = sign * value / this.texture.crop.height;
            this._height = value;
        }
    },

    /**
     * The texture that the sprite is using
     *
     * @member {PIXI.Texture}
     * @memberof PIXI.Sprite#
     */
    texture: {
        get: function ()
        {
            return  this._texture;
        },
        set: function (value)
        {
            if (this._texture === value)
            {
                return;
            }

            this._texture = value;
            this.cachedTint = 0xFFFFFF;

            this.textureDirty = true;

            if (value)
            {
                // wait for the texture to load
                if (value.baseTexture.hasLoaded)
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
});

/**
 * When the texture is updated, this event will fire to update the scale and frame
 *
 * @private
 */
Sprite.prototype._onTextureUpdate = function ()
{
    this.textureDirty = true;

    // so if _width is 0 then width was not set..
    if (this._width)
    {
        this.scale.x = utils.sign(this.scale.x) * this._width / this.texture.crop.width;
    }

    if (this._height)
    {
        this.scale.y = utils.sign(this.scale.y) * this._height / this.texture.crop.height;
    }
};

Sprite.prototype.calculateVertices = function ()
{
    var texture = this._texture,
        w0, w1, h0, h1,
        trim = texture.trim,
        crop = texture.crop;

    if (trim)
    {
        // if the sprite is trimmed and is not a tilingsprite then we need to add the extra space before transforming the sprite coords..
        w1 = trim.x - this.anchor.x * crop.width;
        w0 = w1 + trim.width;

        h1 = trim.y - this.anchor.y * crop.height;
        h0 = h1 + trim.height;

    }
    else
    {
        w0 = (crop.width ) * (1-this.anchor.x);
        w1 = (crop.width ) * -this.anchor.x;

        h0 = crop.height * (1-this.anchor.y);
        h1 = crop.height * -this.anchor.y;
    }

    this.geometry.setRectCoords(0, w1, h1, w0, h0);
    this.updateGeometry();
};

/**
*
* Renders the object using the WebGL renderer
*
* @param renderer {PIXI.WebGLRenderer}
* @private
*/
Sprite.prototype._renderWebGL = function (renderer)
{
    if(this.transform.updated || this.textureDirty)
    {
        this.textureDirty = false;
        // set the vertex data
        this.calculateVertices();
    }

    renderer.setObjectRenderer(renderer.plugins.sprite);
    renderer.plugins.sprite.render(this);
};

/**
* Renders the object using the Canvas renderer
*
* @param renderer {PIXI.CanvasRenderer} The renderer
* @private
*/
Sprite.prototype._renderCanvas = function (renderer)
{
    renderer.plugins.sprite.render(this);
};

/**
* Tests if a point is inside this sprite
*
* @param point {PIXI.Point} the point to test
* @return {boolean} the result of the test
*/
Sprite.prototype.containsPoint = function( point )
{
    this.worldTransform.applyInverse(point,  tempPoint);

    var width = this._texture.crop.width;
    var height = this._texture.crop.height;
    var x1 = -width * this.anchor.x;
    var y1;

    if ( tempPoint.x > x1 && tempPoint.x < x1 + width )
    {
        y1 = -height * this.anchor.y;

        if ( tempPoint.y > y1 && tempPoint.y < y1 + height )
        {
            return true;
        }
    }

    return false;
};


/**
 * Destroys this sprite and optionally its texture
 *
 * @param [destroyTexture=false] {boolean} Should it destroy the current texture of the sprite as well
 * @param [destroyBaseTexture=false] {boolean} Should it destroy the base texture of the sprite as well
 */
Sprite.prototype.destroy = function (destroyTexture, destroyBaseTexture)
{
    Container.prototype.destroy.call(this);

    this.anchor = null;

    if (destroyTexture)
    {
        this._texture.destroy(destroyBaseTexture);
    }

    this._texture = null;
    this.shader = null;
};

// some helper functions..

/**
 * Helper function that creates a new sprite based on the source you provide.
 * The soucre can be - frame id, image url, video url, canvae element, video element, base texture
 *
 * @static
 * @param source {}
 * @return {PIXI.Texture} A Texture
 */
Sprite.from = function (source)
{
    return new Sprite(Texture.from(source));
}

/**
 * Helper function that creates a sprite that will contain a texture from the TextureCache based on the frameId
 * The frame ids are created when a Texture packer file has been loaded
 *
 * @static
 * @param frameId {string} The frame Id of the texture in the cache
 * @param [crossorigin=(auto)] {boolean} if you want to specify the cross-origin parameter
 * @param [scaleMode=PIXI.SCALE_MODES.DEFAULT] {number} if you want to specify the scale mode, see {@link PIXI.SCALE_MODES} for possible values
 * @return {PIXI.Sprite} A new Sprite using a texture from the texture cache matching the frameId
 */
Sprite.fromFrame = function (frameId)
{
    var texture = utils.TextureCache[frameId];

    if (!texture)
    {
        throw new Error('The frameId "' + frameId + '" does not exist in the texture cache');
    }

    return new Sprite(texture);
};

/**
 * Helper function that creates a sprite that will contain a texture based on an image url
 * If the image is not in the texture cache it will be loaded
 *
 * @static
 * @param imageId {string} The image url of the texture
 * @return {PIXI.Sprite} A new Sprite using a texture from the texture cache matching the image id
 */
Sprite.fromImage = function (imageId, crossorigin, scaleMode)
{
    return new Sprite(Texture.fromImage(imageId, crossorigin, scaleMode));
};
