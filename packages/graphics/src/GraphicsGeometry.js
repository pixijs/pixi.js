import { BatchGeometry } from '@pixi/core';
import { SHAPES } from '@pixi/math';
import { Bounds } from '@pixi/display';

import GraphicsData from './GraphicsData';
import buildCircle from './utils/buildCircle';
import buildLine from './utils/buildLine';
import buildPoly from './utils/buildPoly';
import buildRectangle from './utils/buildRectangle';
import buildRoundedRectangle from './utils/buildRoundedRectangle';
import { premultiplyTint } from '@pixi/utils';

const BATCH_POOL = [];
const DRAW_CALL_POOL = [];

let TICK = 0;
/**
 * Map of fill commands for each shape type.
 *
 * @member {Object}
 * @private
 */
const fillCommands = {};

fillCommands[SHAPES.POLY] = buildPoly;
fillCommands[SHAPES.CIRC] = buildCircle;
fillCommands[SHAPES.ELIP] = buildCircle;
fillCommands[SHAPES.RECT] = buildRectangle;
fillCommands[SHAPES.RREC] = buildRoundedRectangle;

/**
 * The Graphics class contains methods used to draw primitive shapes such as lines, circles and
 * rectangles to the display, and to color and fill them. GraphicsGeometry
 * is designed to not be continually update the geometry since it's expensive
 * to re-tesselate using **earcut**. Consider using {@link PIXI.Mesh} for this
 * use-case, it's much faster.
 *
 * @class
 * @extends PIXI.BatchGeometry
 * @memberof PIXI
 */
export default class GraphicsGeometry extends BatchGeometry
{
    constructor()
    {
        super();

        /**
         * An array of points to draw
         * @member {PIXI.Point[]}
         * @private
         */
        this.points = [];

        /**
         * The collection of colors
         * @member {number[]}
         * @private
         */
        this.colors = [];

        /**
         * The UVs collection
         * @member {number[]}
         * @private
         */
        this.uvs = [];

        /**
         * The indices of the vertices
         * @member {number[]}
         * @private
         */
        this.indices = [];

        /**
         * Reference to the texture IDs.
         * @member {number[]}
         * @private
         */
        this.textureIds = [];

        /**
         * The collection of drawn shapes.
         *
         * @member {PIXI.GraphicsData[]}
         * @private
         */
        this.graphicsData = [];

        /**
         * Graphics data representing holes in the graphicsData.
         *
         * @member {PIXI.GraphicsData[]}
         * @private
         */
        this.graphicsDataHoles = [];

        /**
         * Used to detect if the graphics object has changed. If this is set to true then the graphics
         * object will be recalculated.
         *
         * @member {number}
         * @private
         */
        this.dirty = 0;

        /**
         * Batches need to regenerated if the geometry is updated.
         *
         * @member {number}
         * @private
         */
        this.batchDirty = -1;

        /**
         * Used to check if the cache is dirty.
         *
         * @member {number}
         * @private
         */
        this.cacheDirty = -1;

        /**
         * Used to detect if we clear the graphics webGL data.
         *
         * @member {number}
         * @default 0
         * @private
         */
        this.clearDirty = 0;

        /**
         * List of current draw calls drived from the batches.
         *
         * @member {object[]}
         * @private
         */
        this.drawCalls = [];

        /**
         * Intermediate abstract format sent to batch system.
         * Can be converted to drawCalls or to batchable objects.
         *
         * @member {object[]}
         * @private
         */
        this.batches = [];

        /**
         * Index of the current last shape in the stack of calls.
         *
         * @member {number}
         * @private
         */
        this.shapeIndex = 0;

        /**
         * Cached bounds.
         *
         * @member {PIXI.Bounds}
         * @private
         */
        this._bounds = new Bounds();

        /**
         * The bounds dirty flag.
         *
         * @member {number}
         * @private
         */
        this.boundsDirty = -1;

        /**
         * Padding to add to the bounds.
         *
         * @member {number}
         * @default 0
         */
        this.boundsPadding = 0;

        this.batchable = false;

        this.indicesUint16 = null;

        this.uvsFloat32 = null;
    }

    /**
     * Get the current bounds of the graphic geometry.
     *
     * @member {PIXI.Bounds}
     * @readonly
     */
    get bounds()
    {
        if (this.boundsDirty !== this.dirty)
        {
            this.boundsDirty = this.dirty;
            this.calculateBounds();
        }

        return this._bounds;
    }

    /**
     * Clears the graphics that were drawn to this Graphics object, and resets fill and line style settings.
     *
     * @return {PIXI.GraphicsGeometry} This GraphicsGeometry object. Good for chaining method calls
     */
    clear()
    {
        if (this.graphicsData.length > 0)
        {
            this.boundsDirty = -1;
            this.dirty++;
            this.clearDirty++;
            this.graphicsData.length = 0;
            this.shapeIndex = 0;

            this.points.length = 0;
            this.colors.length = 0;
            this.uvs.length = 0;
            this.indices.length = 0;
            this.textureIds.length = 0;

            for (let i = 0; i < this.drawCalls.length; i++)
            {
                this.drawCalls[i].textures.length = 0;
                DRAW_CALL_POOL.push(this.drawCalls[i]);
            }

            this.drawCalls.length = 0;

            for (let i = 0; i < this.batches.length; i++)
            {
                const batch =  this.batches[i];

                batch.start = 0;
                batch.attribStart = 0;
                batch.style = null;
                BATCH_POOL.push(batch);
            }

            this.batches.length = 0;
        }

        return this;
    }

    /**
     * Draws the given shape to this Graphics object. Can be any of Circle, Rectangle, Ellipse, Line or Polygon.
     *
     * @param {PIXI.Circle|PIXI.Ellipse|PIXI.Polygon|PIXI.Rectangle|PIXI.RoundedRectangle} shape - The shape object to draw.
     * @param {PIXI.FillStyle} fillStyle - Defines style of the fill.
     * @param {PIXI.LineStyle} lineStyle - Defines style of the lines.
     * @param {PIXI.Matrix} matrix - Transform applied to the points of the shape.
     * @return {PIXI.GraphicsGeomery} Returns geometry for chaining.
     */
    drawShape(shape, fillStyle, lineStyle, matrix)
    {
        const data = new GraphicsData(shape, fillStyle, lineStyle, matrix);

        this.graphicsData.push(data);
        this.dirty++;

        return this;
    }

    /**
     * Draws the given shape to this Graphics object. Can be any of Circle, Rectangle, Ellipse, Line or Polygon.
     *
     * @param {PIXI.Circle|PIXI.Ellipse|PIXI.Polygon|PIXI.Rectangle|PIXI.RoundedRectangle} shape - The shape object to draw.
     * @param {PIXI.Matrix} matrix - Transform applied to the points of the shape.
     * @return {PIXI.GraphicsGeomery} Returns geometry for chaining.
     */
    drawHole(shape, matrix)
    {
        if (!this.graphicsData.length)
        {
            return null;
        }

        const data = new GraphicsData(shape, null, null, matrix);

        const lastShape = this.graphicsData[this.graphicsData.length - 1];

        lastShape.holes.push(data);

        this.dirty++;

        return data;
    }

    /**
     * Destroys the Graphics object.
     *
     * @param {object|boolean} [options] - Options parameter. A boolean will act as if all
     *  options have been set to that value
     * @param {boolean} [options.children=false] - if set to true, all the children will have
     *  their destroy method called as well. 'options' will be passed on to those calls.
     * @param {boolean} [options.texture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the texture of the child sprite
     * @param {boolean} [options.baseTexture=false] - Only used for child Sprites if options.children is set to true
     *  Should it destroy the base texture of the child sprite
     */
    destroy(options)
    {
        super.destroy(options);

        // destroy each of the GraphicsData objects
        for (let i = 0; i < this.graphicsData.length; ++i)
        {
            this.graphicsData[i].destroy();
        }

        this.points.length = 0;
        this.points = null;
        this.colors.length = 0;
        this.colors = null;
        this.uvs.length = 0;
        this.uvs = null;
        this.indices.length = 0;
        this.indices = null;
        this.indexBuffer.destroy();
        this.indexBuffer = null;
        this.graphicsData.length = 0;
        this.graphicsData = null;
        this.graphicsDataHoles.length = 0;
        this.graphicsDataHoles = null;
        this.drawCalls.length = 0;
        this.drawCalls = null;
        this.batches.length = 0;
        this.batches = null;
        this._bounds = null;
    }

    /**
     * Check to see if a point is contained within this geometry.
     *
     * @param {PIXI.Point} point - Point to check if it's contained.
     * @return {Boolean} `true` if the point is contained within geometry.
     */
    containsPoint(point)
    {
        const graphicsData = this.graphicsData;

        for (let i = 0; i < graphicsData.length; ++i)
        {
            const data = graphicsData[i];

            if (!data.fillStyle.visible)
            {
                continue;
            }

            // only deal with fills..
            if (data.shape)
            {
                if (data.shape.contains(point.x, point.y))
                {
                    if (data.holes)
                    {
                        for (let i = 0; i < data.holes.length; i++)
                        {
                            const hole = data.holes[i];

                            if (hole.shape.contains(point.x, point.y))
                            {
                                return false;
                            }
                        }
                    }

                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Generates intermediate batch data. Either gets converted to drawCalls
     * or used to convert to batch objects directly by the Graphics object.
     * @private
     */
    updateBatches()
    {
        if (this.dirty === this.cacheDirty) return;
        if (this.graphicsData.length === 0) return;

        if (this.dirty !== this.cacheDirty)
        {
            for (let i = 0; i < this.graphicsData.length; i++)
            {
                const data = this.graphicsData[i];

                if (data.fillStyle && !data.fillStyle.texture.baseTexture.valid) return;
                if (data.lineStyle && !data.lineStyle.texture.baseTexture.valid) return;
            }
        }

        this.cacheDirty = this.dirty;

        const uvs = this.uvs;

        let batchPart = this.batches.pop()
            || BATCH_POOL.pop()
            || { style: null, size: 0, start: 0, attribStart: 0, attribSize: 0 };

        batchPart.style = batchPart.style
            || this.graphicsData[0].fillStyle
            || this.graphicsData[0].lineStyle;

        let currentTexture = batchPart.style.texture.baseTexture;
        let currentColor = batchPart.style.color + batchPart.style.alpha;

        this.batches.push(batchPart);

        // TODO - this can be simplified
        for (let i = this.shapeIndex; i < this.graphicsData.length; i++)
        {
            this.shapeIndex++;

            const data = this.graphicsData[i];
            const command = fillCommands[data.type];

            const fillStyle = data.fillStyle;
            const lineStyle = data.lineStyle;

            // build out the shapes points..
            command.build(data);

            if (data.matrix)
            {
                this.transformPoints(data.points, data.matrix);
            }

            for (let j = 0; j < 2; j++)
            {
                const style = (j === 0) ? fillStyle : lineStyle;

                if (!style.visible) continue;

                const nextTexture = style.texture.baseTexture;

                if (currentTexture !== nextTexture || (style.color + style.alpha) !== currentColor)
                {
                    // TODO use a const
                    nextTexture.wrapMode = 10497;
                    currentTexture = nextTexture;
                    currentColor = style.color + style.alpha;

                    const index = this.indices.length;
                    const attribIndex = this.points.length / 2;

                    batchPart.size = index - batchPart.start;
                    batchPart.attribSize = attribIndex - batchPart.attribStart;

                    if (batchPart.size > 0)
                    {
                        batchPart = BATCH_POOL.pop() || { style, size: 0, start: 0, attribStart: 0, attribSize: 0 };
                        this.batches.push(batchPart);
                    }

                    batchPart.style = style;
                    batchPart.start = index;
                    batchPart.attribStart = attribIndex;

                    // TODO add this to the render part..
                }

                const start = this.points.length / 2;

                if (j === 0)
                {
                    if (data.holes.length)
                    {
                        this.proccessHoles(data.holes);

                        buildPoly.triangulate(data, this);
                    }
                    else
                    {
                        command.triangulate(data, this);
                    }
                }
                else
                {
                    buildLine(data, this);
                }

                const size = (this.points.length / 2) - start;

                this.addUvs(this.points, uvs, style.texture, start, size, style.matrix);
            }
        }

        const index = this.indices.length;
        const attrib = this.points.length / 2;

        batchPart.size = index - batchPart.start;
        batchPart.attribSize = attrib - batchPart.attribStart;
        this.indicesUint16 = new Uint16Array(this.indices);

        // TODO make this a const..
        this.batchable = false;// this.points.length < GraphicsGeometry.BATCHABLE_SIZE * 2;

        if (this.batchable)
        {
            this.batchDirty++;

            this.uvsFloat32 = new Float32Array(this.uvs);

            // offset the indices so that it works with the batcher...
            for (let i = 0; i < this.batches.length; i++)
            {
                const batch = this.batches[i];

                for (let j = 0; j < batch.size; j++)
                {
                    const index = batch.start + j;

                    this.indicesUint16[index] = this.indicesUint16[index] - batch.attribStart;
                }
            }
        }
        else
        {
            this.buildDrawCalls();
        }
    }

    /**
     * Converts intermediate batches data to drawCalls.
     * @private
     */
    buildDrawCalls()
    {
        TICK++;

        for (let i = 0; i < this.drawCalls.length; i++)
        {
            this.drawCalls[i].textures.length = 0;
            DRAW_CALL_POOL.push(this.drawCalls[i]);
        }

        this.drawCalls.length = 0;

        let lastIndex = this.indices.length;

        const uvs = this.uvs;
        const colors = this.colors;
        const textureIds = this.textureIds;

        let currentGroup =  DRAW_CALL_POOL.pop() || { textures: [], textureCount: 0, size: 0, start: 0, type: 4 };

        currentGroup.textureCount = 0;
        currentGroup.start = 0;

        let textureCount = 0;
        let currentTexture = null;
        let textureId = 0;

        lastIndex = 0;

        this.drawCalls.push(currentGroup);

        // TODO - this can be simplified
        for (let i = 0; i < this.batches.length; i++)
        {
            const data = this.batches[i];

            // TODO add some full on MAX_TEXTURE CODE..
            const MAX_TEXTURES = 8;

            const style = data.style;

            const nextTexture = style.texture.baseTexture;

            if (currentTexture !== nextTexture)
            {
                currentTexture = nextTexture;

                if (nextTexture._enabled !== TICK)
                {
                    if (textureCount === MAX_TEXTURES)
                    {
                        TICK++;
                        textureCount = 0;

                        const index = data.start;

                        currentGroup.size = index - lastIndex;

                        currentGroup = DRAW_CALL_POOL.pop() || { textures: [], textureCount: 0, size: 0, start: 0, type: 4 };

                        currentGroup.textureCount = 0;

                        currentGroup.start = lastIndex;
                        this.drawCalls.push(currentGroup);

                        lastIndex = index;
                    }

                    // TODO add this to the render part..
                    nextTexture.touched = 1;// touch;
                    nextTexture._enabled = TICK;
                    nextTexture._id = textureCount;
                    nextTexture.wrapMode = 10497;

                    currentGroup.textures[currentGroup.textureCount++] = nextTexture;
                    textureCount++;
                }
            }

            const size = data.attribSize;

            textureId = nextTexture._id;

            this.addColors(colors, style.color, style.alpha, size);
            this.addTextureIds(textureIds, textureId, size);
        }

        const index = this.indices.length;

        currentGroup.size = index - lastIndex;

        // upload..
        // merge for now!
        const verts = this.points;

        // verts are 2 positions.. so we * by 3 as there are 6 properties.. then 4 cos its bytes
        const glPoints = new ArrayBuffer(verts.length * 3 * 4);
        const f32 = new Float32Array(glPoints);
        const u32 = new Uint32Array(glPoints);

        let p = 0;

        for (let i = 0; i < verts.length / 2; i++)
        {
            f32[p++] = verts[i * 2];
            f32[p++] = verts[(i * 2) + 1];

            f32[p++] = uvs[i * 2];
            f32[p++] = uvs[(i * 2) + 1];

            u32[p++] = colors[i];

            f32[p++] = textureIds[i];
        }

        this._buffer.update(glPoints);
        this._indexBuffer.update(this.indicesUint16);
    }

    /**
     * Process the holes data.
     *
     * @param {PIXI.GraphicsData[]} holes - Holes to render
     * @private
     */
    proccessHoles(holes)
    {
        for (let i = 0; i < holes.length; i++)
        {
            const hole = holes[i];

            const command = fillCommands[hole.type];

            command.build(hole);

            if (hole.matrix)
            {
                this.transformPoints(hole.points, hole.matrix);
            }
        }
    }

    /**
     * Update the local bounds of the object. Expensive to use performance-wise.
     * @private
     */
    calculateBounds()
    {
        let minX = Infinity;
        let maxX = -Infinity;

        let minY = Infinity;
        let maxY = -Infinity;

        if (this.graphicsData.length)
        {
            let shape = null;
            let x = 0;
            let y = 0;
            let w = 0;
            let h = 0;

            for (let i = 0; i < this.graphicsData.length; i++)
            {
                const data = this.graphicsData[i];

                const type = data.type;
                const lineWidth = data.lineStyle ? data.lineStyle.width : 0;

                shape = data.shape;

                if (type === SHAPES.RECT || type === SHAPES.RREC)
                {
                    x = shape.x - (lineWidth / 2);
                    y = shape.y - (lineWidth / 2);
                    w = shape.width + lineWidth;
                    h = shape.height + lineWidth;

                    minX = x < minX ? x : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y < minY ? y : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === SHAPES.CIRC)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.radius + (lineWidth / 2);
                    h = shape.radius + (lineWidth / 2);

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else if (type === SHAPES.ELIP)
                {
                    x = shape.x;
                    y = shape.y;
                    w = shape.width + (lineWidth / 2);
                    h = shape.height + (lineWidth / 2);

                    minX = x - w < minX ? x - w : minX;
                    maxX = x + w > maxX ? x + w : maxX;

                    minY = y - h < minY ? y - h : minY;
                    maxY = y + h > maxY ? y + h : maxY;
                }
                else
                {
                    // POLY
                    const points = shape.points;
                    let x2 = 0;
                    let y2 = 0;
                    let dx = 0;
                    let dy = 0;
                    let rw = 0;
                    let rh = 0;
                    let cx = 0;
                    let cy = 0;

                    for (let j = 0; j + 2 < points.length; j += 2)
                    {
                        x = points[j];
                        y = points[j + 1];
                        x2 = points[j + 2];
                        y2 = points[j + 3];
                        dx = Math.abs(x2 - x);
                        dy = Math.abs(y2 - y);
                        h = lineWidth;
                        w = Math.sqrt((dx * dx) + (dy * dy));

                        if (w < 1e-9)
                        {
                            continue;
                        }

                        rw = ((h / w * dy) + dx) / 2;
                        rh = ((h / w * dx) + dy) / 2;
                        cx = (x2 + x) / 2;
                        cy = (y2 + y) / 2;

                        minX = cx - rw < minX ? cx - rw : minX;
                        maxX = cx + rw > maxX ? cx + rw : maxX;

                        minY = cy - rh < minY ? cy - rh : minY;
                        maxY = cy + rh > maxY ? cy + rh : maxY;
                    }
                }
            }
        }
        else
        {
            minX = 0;
            maxX = 0;
            minY = 0;
            maxY = 0;
        }

        const padding = this.boundsPadding;

        this._bounds.minX = minX - padding;
        this._bounds.maxX = maxX + padding;

        this._bounds.minY = minY - padding;
        this._bounds.maxY = maxY + padding;
    }

    /**
     * Transform points using matrix.
     *
     * @private
     * @param {number[]} points - Points to transform
     * @param {PIXI.Matrix} matrix - Transform matrix
     */
    transformPoints(points, matrix)
    {
        for (let i = 0; i < points.length / 2; i++)
        {
            const x = points[(i * 2)];
            const y = points[(i * 2) + 1];

            points[(i * 2)] = (matrix.a * x) + (matrix.c * y) + matrix.tx;
            points[(i * 2) + 1] = (matrix.b * x) + (matrix.d * y) + matrix.ty;
        }
    }

    /**
     * Add colors.
     *
     * @private
     * @param {number[]} colors - List of colors to add to
     * @param {number} color - Color to add
     * @param {number} alpha - Alpha to use
     * @param {number} size - Number of colors to add
     */
    addColors(colors, color, alpha, size)
    {
        // TODO use the premultiply bits Ivan added
        const rgb = (color >> 16) + (color & 0xff00) + ((color & 0xff) << 16);

        const rgba =  premultiplyTint(rgb, alpha);

        while (size-- > 0)
        {
            colors.push(rgba);
        }
    }

    /**
     * Add texture id that the shader/fragment wants to use.
     *
     * @private
     * @param {number[]} textureIds
     * @param {number} id
     * @param {number} size
     */
    addTextureIds(textureIds, id, size)
    {
        while (size-- > 0)
        {
            textureIds.push(id);
        }
    }

    /**
     * Generates the UVs for a shape.
     *
     * @private
     * @param {number[]} verts - Vertices
     * @param {number[]} uvs - UVs
     * @param {PIXI.Texture} texture - Reference to Texture
     * @param {number} start - Index buffer start index.
     * @param {number} size - The size/length for index buffer.
     * @param {PIXI.Matrix} [matrix] - Optional transform for all points.
     */
    addUvs(verts, uvs, texture, start, size, matrix)
    {
        let index = 0;

        while (index < size)
        {
            let x = verts[(start + index) * 2];
            let y = verts[((start + index) * 2) + 1];

            if (matrix)
            {
                const nx = (matrix.a * x) + (matrix.c * y) + matrix.tx;

                y = (matrix.b * x) + (matrix.d * y) + matrix.ty;
                x = nx;
            }

            index++;

            const frame = texture.frame;

            uvs.push(x / frame.width, y / frame.height);
        }
    }
}

/**
 * The maximum number of points to consider an object "batchable",
 * able to be batched by the renderer's batch system.
 *
 * @memberof PIXI.GraphicsGeometry
 * @static
 * @member {number}
 * @default 100
 */
GraphicsGeometry.BATCHABLE_SIZE = 100;
