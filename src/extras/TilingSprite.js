var core = require('../core'),
    CanvasTinter = require('../core/sprites/canvas/CanvasTinter'),
    TilingShader = require('./webgl/TilingShader'),
    tempArray = new Float32Array(4);

/**
 * A tiling sprite is a fast way of rendering a tiling image
 *
 * @class
 * @extends PIXI.Sprite
 * @memberof PIXI.extras
 * @param texture {Texture} the texture of the tiling sprite
 * @param width {number}  the width of the tiling sprite
 * @param height {number} the height of the tiling sprite
 */
function TilingSprite(texture, width, height)
{
    core.Sprite.call(this, texture);

    this._size._x = width || 100;
    this._size._y = height || 100;
    /**
     * The scaling of the image that is being tiled
     *
     * @member {PIXI.Point}
     */
    this.tileScale = new core.Point(1,1);

    /**
     * The offset position of the image that is being tiled
     *
     * @member {PIXI.Point}
     */
    this.tilePosition = new core.Point(0,0);

    //TODO: for v4.1 make dirty uvs separated, and tileScale/tilePosition observable

    /**
     * An internal WebGL UV cache.
     *
     * @member {PIXI.TextureUvs}
     * @private
     */
    this._uvs = new core.TextureUvs();

    this._canvasPattern = null;

    this._glDatas = [];
}

TilingSprite.prototype = Object.create(core.Sprite.prototype);
TilingSprite.prototype.constructor = TilingSprite;
module.exports = TilingSprite;

/**
 * Renders the object using the WebGL renderer
 *
 * @param renderer {PIXI.WebGLRenderer}
 * @private
 */
TilingSprite.prototype._renderWebGL = function (renderer)
{

    // tweak our texture temporarily..
    var texture = this._texture;

    if(!texture || !texture._uvs)
    {
        return;
    }

     // get rid of any thing that may be batching.
    renderer.flush();

    var gl = renderer.gl;
    var glData = this._glDatas[renderer.CONTEXT_UID];

    if(!glData)
    {
        glData = {
            shader:new TilingShader(gl),
            quad:new core.Quad(gl)
        };

        this._glDatas[renderer.CONTEXT_UID] = glData;

        glData.quad.initVao(glData.shader);
    }

    // if the sprite is trimmed and is not a tilingsprite then we need to add the extra space before transforming the sprite coords..
    var vertices = glData.quad.vertices;
    var geomVertices = this.geometry.vertices;
    for (var i=0;i<8;i++) {
        vertices[i] = geomVertices[i];
    }
    glData.quad.upload();

    renderer.bindShader(glData.shader);
    renderer.bindProjection(this.worldProjection);

    var textureUvs = texture._uvs,
        textureWidth = texture._frame.width,
        textureHeight = texture._frame.height,
        textureBaseWidth = texture.baseTexture.width,
        textureBaseHeight = texture.baseTexture.height;

    var uPixelSize = glData.shader.uniforms.uPixelSize;
    uPixelSize[0] = 1.0/textureBaseWidth;
    uPixelSize[1] = 1.0/textureBaseHeight;
    glData.shader.uniforms.uPixelSize = uPixelSize;

    var uFrame = glData.shader.uniforms.uFrame;
    uFrame[0] = textureUvs.x0;
    uFrame[1] = textureUvs.y0;
    uFrame[2] = textureUvs.x1 - textureUvs.x0;
    uFrame[3] = textureUvs.y2 - textureUvs.y0;
    glData.shader.uniforms.uFrame = uFrame;

    var width = this._size._x;
    var height = this._size._y;

    var uTransform = glData.shader.uniforms.uTransform;
    uTransform[0] = (this.tilePosition.x % (textureWidth * this.tileScale.x)) / width;
    uTransform[1] = (this.tilePosition.y % (textureHeight * this.tileScale.y)) / height;
    uTransform[2] = ( textureBaseWidth / width ) * this.tileScale.x;
    uTransform[3] = ( textureBaseHeight / height ) * this.tileScale.y;
    glData.shader.uniforms.translationMatrix = this.computedTransform.matrix2d.toArray(true);
    glData.shader.uniforms.uTransform = uTransform;
    glData.shader.uniforms.alpha = this.worldAlpha;

    var color = tempArray;

    core.utils.hex2rgb(this.tint, color);
    color[3] = this.worldAlpha;

    glData.shader.uniforms.uColor = color;

    renderer.bindTexture(this._texture, 0);
    renderer.state.setBlendMode( this.blendMode );
    glData.quad.draw();
};

/**
 * Renders the object using the Canvas renderer
 *
 * @param renderer {PIXI.CanvasRenderer} a reference to the canvas renderer
 * @private
 */
TilingSprite.prototype._renderCanvas = function (renderer)
{
    var texture = this._texture;

    if (!texture.baseTexture.hasLoaded)
    {
      return;
    }

    var context = renderer.context,
        transform = this.projectionMatrix2d,
        resolution = renderer.resolution,
        baseTexture = texture.baseTexture,
        modX = (this.tilePosition.x / this.tileScale.x) % texture._frame.width,
        modY = (this.tilePosition.y / this.tileScale.y) % texture._frame.height;

    // create a nice shiny pattern!
    // TODO this needs to be refreshed if texture changes..
    if(!this._canvasPattern)
    {
        // cut an object from a spritesheet..
        var tempCanvas = new core.CanvasRenderTarget(texture._frame.width, texture._frame.height);

        // Tint the tiling sprite
        if (this.tint !== 0xFFFFFF)
        {
            if (this.cachedTint !== this.tint)
            {
                this.cachedTint = this.tint;

                this.tintedTexture = CanvasTinter.getTintedTexture(this, this.tint);
            }
            tempCanvas.context.drawImage(this.tintedTexture, 0, 0);
        }
        else
        {
            tempCanvas.context.drawImage(baseTexture.source, -texture._frame.x, -texture._frame.y);
        }
        this._canvasPattern = tempCanvas.context.createPattern( tempCanvas.canvas, 'repeat' );
    }

    // set context state..
    context.globalAlpha = this.worldAlpha;
    context.setTransform(transform.a * resolution,
                       transform.b * resolution,
                       transform.c * resolution,
                       transform.d * resolution,
                       transform.tx * resolution,
                       transform.ty * resolution);

    // TODO - this should be rolled into the setTransform above..
    context.scale(this.tileScale.x,this.tileScale.y);

    context.translate(modX + (this.anchor.x * -this._size._x),
                      modY + (this.anchor.y * -this._size._y));

    // check blend mode
    var compositeOperation = renderer.blendModes[this.blendMode];
    if (compositeOperation !== renderer.context.globalCompositeOperation)
    {
        context.globalCompositeOperation = compositeOperation;
    }

    // fill the pattern!
    context.fillStyle = this._canvasPattern;
    context.fillRect(-modX,
                     -modY,
                     this._size._x / this.tileScale.x,
                     this._size._y / this.tileScale.y);


    //TODO - pretty sure this can be deleted...
    //context.translate(-this.tilePosition.x + (this.anchor.x * this._width), -this.tilePosition.y + (this.anchor.y * this._height));
    //context.scale(1 / this.tileScale.x, 1 / this.tileScale.y);
};


TilingSprite.prototype.calculateVertices = function () {
    var width = this._size._x;
    var height = this._size._y;

    var w0 = width * (1-this.anchor.x);
    var w1 = width * -this.anchor.x;

    var h0 = height * (1-this.anchor.y);
    var h1 = height * -this.anchor.y;
    this.geometry.setRectCoords(0, w1, h1, w0, h0);
};

/**
 * Checks if a point is inside this tiling sprite
 * @param point {PIXI.Point} the point to check
 */
TilingSprite.prototype.containsLocalPoint = function( point )
{
    var width = this._size._x;
    var height = this._size._y;
    var x1 = -width * this.anchor.x;
    var y1;

    if ( point.x > x1 && point.x < x1 + width )
    {
        y1 = -height * this.anchor.y;

        if ( point.y > y1 && point.y < y1 + height )
        {
            return true;
        }
    }

    return false;
};

/**
 * Destroys this tiling sprite
 *
 */
TilingSprite.prototype.destroy = function () {
    core.Sprite.prototype.destroy.call(this);

    this.tileScale = null;
    this._tileScaleOffset = null;
    this.tilePosition = null;

    this._uvs = null;
};

/**
 * Helper function that creates a tiling sprite that will use a texture from the TextureCache based on the frameId
 * The frame ids are created when a Texture packer file has been loaded
 *
 * @static
 * @param frameId {string} The frame Id of the texture in the cache
 * @return {PIXI.extras.TilingSprite} A new TilingSprite using a texture from the texture cache matching the frameId
 * @param width {number}  the width of the tiling sprite
 * @param height {number} the height of the tiling sprite
 */
TilingSprite.fromFrame = function (frameId,width,height)
{
    var texture = core.utils.TextureCache[frameId];

    if (!texture)
    {
        throw new Error('The frameId "' + frameId + '" does not exist in the texture cache ' + this);
    }

    return new TilingSprite(texture,width,height);
};

/**
 * Helper function that creates a sprite that will contain a texture based on an image url
 * If the image is not in the texture cache it will be loaded
 *
 * @static
 * @param imageId {string} The image url of the texture
 * @param width {number}  the width of the tiling sprite
 * @param height {number} the height of the tiling sprite
 * @param [crossorigin=(auto)] {boolean} if you want to specify the cross-origin parameter
 * @param [scaleMode=PIXI.SCALE_MODES.DEFAULT] {number} if you want to specify the scale mode, see {@link PIXI.SCALE_MODES} for possible values
 * @return {PIXI.extras.TilingSprite} A new TilingSprite using a texture from the texture cache matching the image id
 */
TilingSprite.fromImage = function (imageId, width, height, crossorigin, scaleMode)
{
    return new TilingSprite(core.Texture.fromImage(imageId, crossorigin, scaleMode),width,height);
};
