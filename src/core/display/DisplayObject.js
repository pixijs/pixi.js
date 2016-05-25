var math = require('../math'),
    EventEmitter = require('eventemitter3'),
    Transform2d = require('../c2d/Transform2d'),
    ComputedTransform2d = require('../c2d/ComputedTransform2d'),
    utils = require('../utils'),
    _tempDisplayObjectParent = null;

/**
 * The base class for all objects that are rendered on the screen.
 * This is an abstract class and should not be used on its own rather it should be extended.
 *
 * @class
 * @extends EventEmitter
 * @mixes PIXI.interaction.interactiveTarget
 * @memberof PIXI
 */
function DisplayObject()
{
    EventEmitter.call(this);

    /**
     * DisplayObject uid, for making a map out of it
     * @member {null}
     */
    this.uid = utils.incDisplayObject();

    /**
     * Local transform
     * @member {PIXI.Transform2d}
     */
    this.transform = null;

    /**
     * World transform
     * @type {PIXI.Transform2d}
     */
    this.computedTransform = null;

    /**
     * Projected transform, need for canvas mode
     * @type {PIXI.Transform2d}
     */
    this.projectedTransform = null;

    /**
     * World projection, for camera
     * @type {PIXI.Transform2d}
     */
    this.worldProjection = null;

    /**
     * Local geometry, for sprites and meshes
     *
     * @member {PIXI.Geometry2d}
     */
    this.geometry = null;

    /**
     * Geometry transformed to world coordinates
     *
     * @member {PIXI.ComputedGeometry2d}
     */
    this.computedGeometry = null;

    /**
     * Geometry transformed to projected coordinates
     *
     * @member {PIXI.ComputedGeometry2d}
     */
    this.projectedGeometry = null;

    /**
     * Local geometry special for fast calculation of bounds
     *
     * @member {PIXI.GeometrySet}
     */
    this._localBounds = null;

    /**
     * The opacity of the object.
     *
     * @member {number}
     */
    this.alpha = 1;

    /**
     * The visibility of the object. If false the object will not be drawn, and
     * the updateTransform function will not be called.
     *
     * @member {boolean}
     */
    this.visible = true;

    /**
     * Can this object be rendered, if false the object will not be drawn but the updateTransform
     * methods will still be called.
     *
     * @member {boolean}
     */
    this.renderable = true;

    /**
     * The display object container that contains this display object.
     *
     * @member {PIXI.Container}
     * @readOnly
     */
    this.parent = null;

    /**
     * The multiplied alpha of the displayObject
     *
     * @member {number}
     * @readOnly
     */
    this.worldAlpha = 1;

    /**
     * The area the filter is applied to. This is used as more of an optimisation
     * rather than figuring out the dimensions of the displayObject each frame you can set this rectangle
     *
     * Also works as an interaction mask
     *
     * @member {PIXI.Rectangle}
     */
    this.filterArea = null;

    /**
     * The original, cached computed bounds of the object
     *
     * @member {PIXI.Rectangle}
     * @private
     */
    this._computedBounds = new math.Rectangle(0, 0, 1, 1);

    /**
     * The original, cached bounds of the object
     *
     * @member {PIXI.Rectangle}
     * @private
     */
    this._bounds = new math.Rectangle(0, 0, 1, 1);

    /**
     * The most up-to-date projected bounds of the object
     *
     * @member {PIXI.Rectangle}
     * @private
     */
    this._currentBounds = null;

    /**
     * The most up-to-date computed bounds of the object
     *
     * @member {PIXI.Rectangle}
     * @private
     */
    this._currentComputedBounds = null;

    /**
     * Whether we have to check our bounds before raycasting this thing
     * @type {boolean}
     */
    this.isRaycastCheckingBoundsFirst = false;

    /**
     * Whether we can raycast it
     * @type {boolean}
     */
    this.isRaycastPossible = false;

    /**
     * The original, cached mask of the object
     *
     * @member {PIXI.Rectangle}
     * @private
     */
    this._mask = null;

    /**
     * At rendering stage, if some proxy swapped its context to ours, then we can read the original context here
     * @member {PIXI.DisplayObjectProxy}
     */
    this.proxyContext = null;

    /**
     * Order in updateTransform
     * @member {number}
     */
    this.updateOrder = 0;

    /**
     * Order in displayList of camera
     * @member {number}
     */
    this.displayOrder = 0;

    /**
     * if object has zIndex, it will be used for display ordering
     * @member {boolean}
     */
    this.inheritZIndex = true;

    /**
     * z-index is used for display ordering
     * You MUST specify camera.enableDisplayList=true for this to work
     * Two objects with same z-index will be sorted in zOrder and then in display order
     * @member {number}
     * @private
     */
    this._zIndex = 0;

    /**
     * z-order is used for display ordering
     * Two objects with same z-index will be sorted by zOrder and then by updateOrder
     * @member {number}
     */
    this.zOrder = 0;

    this.initTransform(true);
}

// constructor
DisplayObject.prototype = Object.create(EventEmitter.prototype);
DisplayObject.prototype.constructor = DisplayObject;
module.exports = DisplayObject;


Object.defineProperties(DisplayObject.prototype, {
    /**
     * z-index is used for display ordering
     * You MUST specify it in your camera too, otherwise it wont work
     * Two objects with same z-index will be sorted in zOrder and then in display order
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    zIndex: {
        get: function() {
            return this._zIndex;
        },
        set: function(value) {
            this._zIndex = value;
            this.inheritZIndex = false;
        }
    },

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     *
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    x: {
        get: function ()
        {
            return this.transform.position.x;
        },
        set: function (value)
        {
            this.transform.position.x = value;
        }
    },

    /**
     * The position of the displayObject on the y axis relative to the local coordinates of the parent.
     *
     * @member {number}
     * @memberof PIXI.DisplayObject#
     */
    y: {
        get: function ()
        {
            return this.transform.position.y;
        },
        set: function (value)
        {
            this.transform.position.y = value;
        }
    },

    /**
     * Current transform of the object based on world (parent) factors
     * This thing will work in 3d too
     *
     * @member {PIXI.Matrix}
     * @readOnly
     */
    projectionMatrix: {
        get: function ()
        {
            return this.updateProjectedTransform().matrix;
        }
    },

    /**
     * Current transform of the object based on world (parent) factors
     * Its a legacy function
     *
     * @member {PIXI.Matrix}
     * @readOnly
     */
    projectionMatrix2d: {
        get: function ()
        {
            return this.updateProjectedTransform().matrix2d;
        }
    },

    /**
     * Current transform of the object based on local factors: position, scale, other stuff
     *
     * @member {PIXI.Matrix}
     * @readOnly
     */
    localTransform: {
        get: function ()
        {
            return this.transform.matrix;
        }
    },

    /**
     * The coordinate of the object relative to the local coordinates of the parent.
     *
     * @member {PIXI.Point}
     */
    position: {
        get: function()
        {
            return this.transform.position;
        },
        set: function(value) {
            this.transform.position.copy(value);
        }
    },

    /**
     * The scale factor of the object.
     *
     * @member {PIXI.Point}
     */
    scale: {
        get: function() {
            return this.transform.scale;
        },
        set: function(value) {
            this.transform.scale.copy(value);
        }
    },

    /**
     * The pivot point of the displayObject that it rotates around
     *
     * @member {PIXI.Point}
     */
    pivot: {
        get: function() {
            return this.transform.pivot;
        },
        set: function(value) {
            this.transform.pivot.copy(value);
        }
    },

    /**
     * The skew factor for the object in radians.
     *
     * @member {PIXI.Point}
     */
    skew: {
        get: function() {
            return this.transform.skew;
        },
        set: function(value) {
            this.transform.skew.copy(value);
        }
    },

    /**
     * The rotation of the object in radians.
     *
     * @member {number}
     */
    rotation: {
        get: function ()
        {
            return this.transform.rotation;
        },
        set: function (value)
        {
            this.transform.rotation = value;
        }
    },

    /**
     * Indicates if the sprite is globally visible.
     *
     * @member {boolean}
     * @memberof PIXI.DisplayObject#
     * @readonly
     */
    worldVisible: {
        get: function ()
        {
            var item = this;

            do {
                if (!item.visible)
                {
                    return false;
                }

                item = item.parent;
            } while (item);

            return true;
        }
    },

    /**
     * Sets a mask for the displayObject. A mask is an object that limits the visibility of an object to the shape of the mask applied to it.
     * In PIXI a regular mask must be a PIXI.Graphics or a PIXI.Sprite object. This allows for much faster masking in canvas as it utilises shape clipping.
     * To remove a mask, set this property to null.
     *
     * @todo For the moment, PIXI.CanvasRenderer doesn't support PIXI.Sprite as mask.
     *
     * @member {PIXI.Graphics|PIXI.Sprite}
     * @memberof PIXI.DisplayObject#
     */
    mask: {
        get: function ()
        {
            return this._mask;
        },
        set: function (value)
        {
            if (this._mask)
            {
                this._mask.renderable = true;
            }

            this._mask = value;

            if (this._mask)
            {
                this._mask.renderable = false;
            }
        }
    },

    /**
     * Sets the filters for the displayObject.
     * * IMPORTANT: This is a webGL only feature and will be ignored by the canvas renderer.
     * To remove filters simply set this property to 'null'
     *
     * @member {PIXI.AbstractFilter[]}
     * @memberof PIXI.DisplayObject#
     */
    filters: {
        get: function ()
        {
            return this._filters && this._filters.slice();
        },
        set: function (value)
        {
            this._filters = value && value.slice();
        }
    }

});

/**
 * initialize or change transforms here.
 * @param isStatic use static optimizations. Set "false" for particles
 */
DisplayObject.prototype.initTransform = function(isStatic) {
    this.transform = new Transform2d(isStatic);
    this.computedTransform = new ComputedTransform2d();
};

DisplayObject.prototype.displayObjectInitTransform = DisplayObject.prototype.initTransform;

/*
 * Updates the object transform for rendering
 *
 * TODO - Optimization pass!
 */
DisplayObject.prototype.updateTransform = function ()
{
    this.updateOrder = utils.incUpdateOrder();
    this.displayOrder = 0;
    this._currentBounds = null;
    this._currentComputedBounds = null;
    // multiply the alphas..
    this.worldAlpha = this.alpha * this.parent.worldAlpha;
    this.worldProjection = this.parent.worldProjection;
    this.transform.update();
    this.computedTransform = this.parent.computedTransform.updateChildTransform(this.computedTransform, this.transform);
    return this.computedTransform;
};

/**
 * Updates the object geometry. Assume that geometry actually exist.
 * @returns {*}
 */
DisplayObject.prototype.updateGeometry = function ()
{
    this.computedGeometry = this.computedTransform.updateChildGeometry(this.computedGeometry, this.geometry);
    return this.computedGeometry;
};

/**
 * Updates the object geometry. Assume that geometry actually exist.
 * @returns {*}
 */
DisplayObject.prototype.updateProjectedGeometry = function ()
{
    this.computedGeometry = this.computedTransform.updateChildGeometry(this.computedGeometry, this.geometry);
    if (this.worldProjection && this.computedGeometry) {
        //TODO: in some cases its better to use projectedTransform, for example if mesh is too big
        this.projectedGeometry = this.worldProjection.updateChildGeometry(this.projectedGeometry, this.computedGeometry);
        return this.projectedGeometry;
    }
    this.projectedGeometry = null;
    return this.computedGeometry;
};

/**
 * Updates projection matrix. Used by interaction manager and canvas renderer, throught legacy property worldTransform
 *
 * @returns {PIXI.Transform2d} Projected or computed transform
 */
DisplayObject.prototype.updateProjectedTransform = function() {
    var wp = this.worldProjection;
    if (wp) {
        this.projectedTransform = wp.updateChildTransform(this.projectedTransform || new ComputedTransform2d(), this.computedTransform);
        return this.projectedTransform;
    }
    return this.computedTransform;
};

// performance increase to avoid using call.. (10x faster)
DisplayObject.prototype.displayObjectUpdateTransform = DisplayObject.prototype.updateTransform;

/**
 *
 * Retrieves the computed bounds of the displayObject as a rectangle object
 *
 * @param matrix {PIXI.Matrix}
 * @return {PIXI.Rectangle} the rectangular bounding area
 */
DisplayObject.prototype.getComputedBounds = function () // jshint unused:false
{
    if (this._localBounds) {
        return this._localBounds.getComputedBounds(this.computedTransform);
    }
    if (!this._currentComputedBounds) {
        var geom = this.updateGeometry();
        if (!geom || !geom.valid) {
            return math.Rectangle.EMPTY;
        }
        this._currentComputedBounds = geom.getBounds();
    }
    return this._currentComputedBounds;
};

/**
 *
 * Retrieves the projected bounds of the displayObject as a rectangle object
 *
 * @param matrix {PIXI.Matrix}
 * @return {PIXI.Rectangle} the rectangular bounding area
 */
DisplayObject.prototype.getBounds = function () // jshint unused:false
{
    if (this._localBounds) {
        return this._localBounds.getBounds(this.computedTransform, this.projectedTransform);
    }

    var geom = this.updateProjectedGeometry();
    if (!geom || !geom.valid) {
        return math.Rectangle.EMPTY;
    }
    if (!this._currentBounds) {
        this._currentBounds = geom.getBounds();
    }
    return this._currentBounds;
};

/**
 * Retrieves the local bounds of the displayObject as a rectangle object
 *
 * @return {PIXI.Rectangle} the rectangular bounding area
 */
DisplayObject.prototype.getLocalBounds = function ()
{
    if (this._localBounds) {
        return this._localBounds.getBounds(this.computedTransform, this.worldProjection);
    }

    var geom = this.geometry;
    if (!geom) {
        return math.Rectangle.EMPTY;
    }
    return geom.getBounds();
};

/**
 * Calculates the global position of the display object
 *
 * @param position {PIXI.Point} The world origin to calculate from
 * @return {PIXI.Point} A point object representing the position of this object
 */
DisplayObject.prototype.toGlobal = function (position)
{
    // this parent check is for just in case the item is a root object.
    // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
    // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
    if(!this.parent)
    {
        this.parent = _tempDisplayObjectParent;
        this.displayObjectUpdateTransform();
        this.parent = null;
    }
    else
    {
        this.displayObjectUpdateTransform();
    }

    // don't need to update the lot
    return this.projectionMatrix.apply(position);
};

/**
 * Calculates the local position of the display object relative to another point
 *
 * @param position {PIXI.Point} The world origin to calculate from
 * @param [from] {PIXI.DisplayObject} The DisplayObject to calculate the global position from
 * @param [point] {PIXI.Point} A Point object in which to store the value, optional (otherwise will create a new Point)
 * @return {PIXI.Point} A point object representing the position of this object
 */
DisplayObject.prototype.toLocal = function (position, from, point)
{
    if (from)
    {
        position = from.toGlobal(position);
    }

    // this parent check is for just in case the item is a root object.
    // If it is we need to give it a temporary parent so that displayObjectUpdateTransform works correctly
    // this is mainly to avoid a parent check in the main loop. Every little helps for performance :)
    if(!this.parent)
    {
        this.parent = _tempDisplayObjectParent;
        this.displayObjectUpdateTransform();
        this.parent = null;
    }
    else
    {
        this.displayObjectUpdateTransform();
    }

    // simply apply the matrix..
    return this.projectionMatrix.applyInverse(position, point);
};

/**
 *
 * @param {PIXI.DisplayPoint} point
 * @param {boolean} ignoreBoundsCheck Ignore bounds check
 * @returns {PIXI.Raycast2d} raycast result. Can be null. Can be not valid. MUTABLE OBJECT, DO NOT CHANGE!
 */
DisplayObject.prototype.raycast = function(point, ignoreBoundsCheck) {
    if (!ignoreBoundsCheck && !this.hitArea && this.isRaycastCheckingBoundsFirst && !this.getBounds().contains(point.x, point.y)) {
        return null;
    }
    if (this.worldProjection) {
        point = this.worldProjection.updateRaycast( point );
    }
    point = this.computedTransform.updateRaycast( point );
    if (point && point.valid) {
        point.intersects = this.hitArea ? this.hitArea.contains( point.x, point.y ) : this.containsLocalPoint( point );
    }
    return point;
};

DisplayObject.prototype.containsPoint = function(point) {
    var rc = this.raycast(point);
    return rc && rc.valid && rc.intersects;
};

/**
 * Interaction local point
 * @param point
 * @returns {boolean}
 */
DisplayObject.prototype.containsLocalPoint = function() {
    //NOPE
    return false;
};

/**
 * Renders the object using the WebGL renderer
 *
 * @param renderer {PIXI.WebGLRenderer} The renderer
 * @private
 */
DisplayObject.prototype.renderWebGL = function (renderer) // jshint unused:false
{
    // OVERWRITE;
};

/**
 * Renders the object using the Canvas renderer
 *
 * @param renderer {PIXI.CanvasRenderer} The renderer
 * @private
 */
DisplayObject.prototype.renderCanvas = function (renderer) // jshint unused:false
{
    // OVERWRITE;
};

/**
 * Set the parent Container of this DisplayObject
 *
 * @param container {Container} The Container to add this DisplayObject to
 * @return {Container} The Container that this DisplayObject was added to
 */
DisplayObject.prototype.setParent = function (container)
{
    if (!container || !container.addChild)
    {
        throw new Error('setParent: Argument must be a Container');
    }

    container.addChild(this);
    return container;
};

/**
 * Convenience function to set the postion, scale, skew and pivot at once.
 *
 * @param [x=0] {number} The X position
 * @param [y=0] {number} The Y position
 * @param [scaleX=1] {number} The X scale value
 * @param [scaleY=1] {number} The Y scale value
 * @param [rotation=0] {number} The rotation
 * @param [skewX=0] {number} The X skew value
 * @param [skewY=0] {number} The Y skew value
 * @param [pivotX=0] {number} The X pivot value
 * @param [pivotY=0] {number} The Y pivot value
 * @return {PIXI.DisplayObject}
 */
DisplayObject.prototype.setTransform = function(x, y, scaleX, scaleY, rotation, skewX, skewY, pivotX, pivotY) //jshint ignore:line
{
    this.position.x = x || 0;
    this.position.y = y || 0;
    this.scale.x = !scaleX ? 1 : scaleX;
    this.scale.y = !scaleY ? 1 : scaleY;
    this.rotation = rotation || 0;
    this.skew.x = skewX || 0;
    this.skew.y = skewY || 0;
    this.pivot.x = pivotX || 0;
    this.pivot.y = pivotY || 0;
    return this;
};

/**
 * Base destroy method for generic display objects
 *
 */
DisplayObject.prototype.destroy = function ()
{
    this.transform.destroy();
    this.parent = null;

    this._bounds = null;
    this._currentBounds = null;
    this._mask = null;

    this.transform = null;
    this.computedTransform = null;
    this.projectedTransform = null;
    this.projection = null;
    this.worldProjection = null;
    this.filterArea = null;
};

_tempDisplayObjectParent = new DisplayObject();
