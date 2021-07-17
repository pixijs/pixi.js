import { Texture } from '@pixi/core';
import { SHAPES, Matrix } from '@pixi/math';
import { canvasUtils, CrossPlatformCanvasRenderingContext2D } from '@pixi/canvas-renderer';
import type { CanvasRenderer } from '@pixi/canvas-renderer';
import type { FillStyle, Graphics, GraphicsData, LineStyle } from '@pixi/graphics';
import type { Circle, Ellipse, Polygon, Rectangle, RoundedRectangle } from '@pixi/math';
import { PolygonUtils } from './utils/PolygonUtils';

/*
 * @author Mat Groves
 *
 * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
 * for creating the original PixiJS version!
 * Also a thanks to https://github.com/bchevalier for tweaking the tint and alpha so that they
 * now share 4 bytes on the vertex buffer
 *
 * Heavily inspired by LibGDX's CanvasGraphicsRenderer:
 * https://github.com/libgdx/libgdx/blob/1.0.0/gdx/src/com/badlogic/gdx/graphics/glutils/ShapeRenderer.java
 */

/**
 * Renderer dedicated to drawing and batching graphics objects.
 *
 * @class
 * @protected
 * @memberof PIXI
 */
export class CanvasGraphicsRenderer
{
    /** A reference to the current renderer */
    public renderer: CanvasRenderer;
    private _svgMatrix: DOMMatrix|boolean = null;
    private _tempMatrix: Matrix = new Matrix();

    /**
     * @param renderer - A reference to the current renderer.
     */
    constructor(renderer: CanvasRenderer)
    {
        this.renderer = renderer;
    }

    /**
     * calculates fill/stroke style for canvas
     *
     * @private
     * @param style - A graphics {@link PIXI.FILL_STYLE} where if `texture` is specified then a tinted CanvasPattern
     * will be used for the fill.stroke
     * @param tint - color to set the fill/stroke too.
     */
    private _calcCanvasStyle(style: FillStyle, tint: number): string|CanvasPattern
    {
        let res;

        if (style.texture && style.texture.baseTexture !== Texture.WHITE.baseTexture)
        {
            if (style.texture.valid)
            {
                res = canvasUtils.getTintedPattern(style.texture, tint);
                this.setPatternTransform(res, style.matrix || Matrix.IDENTITY);
            }
            else
            {
                res = '#808080';
            }
        }
        else
        {
            res = `#${(`00000${(tint | 0).toString(16)}`).substr(-6)}`;
        }

        return res;
    }

    /**
     * Renders a Graphics object to a canvas.
     *
     * @param graphics - the actual graphics object to render
     */
    public render(graphics: Graphics): void
    {
        const renderer = this.renderer;
        const context = renderer.context;
        const worldAlpha = graphics.worldAlpha;
        const transform = graphics.transform.worldTransform;

        renderer.setContextTransform(transform);
        renderer.setBlendMode(graphics.blendMode);

        const graphicsData = graphics.geometry.graphicsData;

        let contextFillStyle;
        let contextStrokeStyle;

        const tintR = ((graphics.tint >> 16) & 0xFF) / 255;
        const tintG = ((graphics.tint >> 8) & 0xFF) / 255;
        const tintB = (graphics.tint & 0xFF) / 255;

        for (let i = 0; i < graphicsData.length; i++)
        {
            const data = graphicsData[i];
            const shape = data.shape;
            const fillStyle = data.fillStyle;
            const lineStyle = data.lineStyle;

            const fillColor = data.fillStyle.color | 0;
            const lineColor = data.lineStyle.color | 0;

            if (data.matrix)
            {
                renderer.setContextTransform(transform.copyTo(this._tempMatrix).append(data.matrix));
            }

            if (fillStyle.visible)
            {
                const fillTint = (
                    (((fillColor >> 16) & 0xFF) / 255 * tintR * 255 << 16)
                    + (((fillColor >> 8) & 0xFF) / 255 * tintG * 255 << 8)
                    + (((fillColor & 0xFF) / 255) * tintB * 255)
                );

                contextFillStyle = this._calcCanvasStyle(fillStyle, fillTint);
            }
            if (lineStyle.visible)
            {
                const lineTint = (
                    (((lineColor >> 16) & 0xFF) / 255 * tintR * 255 << 16)
                    + (((lineColor >> 8) & 0xFF) / 255 * tintG * 255 << 8)
                    + (((lineColor & 0xFF) / 255) * tintB * 255)
                );

                contextStrokeStyle = this._calcCanvasStyle(lineStyle, lineTint);
            }

            context.lineWidth = lineStyle.width;
            context.lineCap = lineStyle.cap;
            context.lineJoin = lineStyle.join;
            context.miterLimit = lineStyle.miterLimit;

            if (data.type === SHAPES.POLY)
            {
                context.beginPath();

                const tempShape = shape as Polygon;
                let points = tempShape.points;
                const holes = data.holes;
                let outerArea;
                let innerArea;
                let px;
                let py;
                let holesDirection: boolean[];

                context.moveTo(points[0], points[1]);

                for (let j = 2; j < points.length; j += 2)
                {
                    context.lineTo(points[j], points[j + 1]);
                }

                if (tempShape.closeStroke)
                {
                    context.closePath();
                }

                if (holes.length > 0)
                {
                    holesDirection = [];
                    outerArea = 0;
                    px = points[0];
                    py = points[1];
                    for (let j = 2; j + 2 < points.length; j += 2)
                    {
                        outerArea += ((points[j] - px) * (points[j + 3] - py))
                            - ((points[j + 2] - px) * (points[j + 1] - py));
                    }

                    for (let k = 0; k < holes.length; k++)
                    {
                        points = (holes[k].shape as Polygon).points;

                        if (!points)
                        {
                            continue;
                        }

                        innerArea = 0;
                        px = points[0];
                        py = points[1];
                        for (let j = 2; j + 2 < points.length; j += 2)
                        {
                            innerArea += ((points[j] - px) * (points[j + 3] - py))
                                - ((points[j + 2] - px) * (points[j + 1] - py));
                        }

                        if (innerArea * outerArea < 0)
                        {
                            context.moveTo(points[0], points[1]);

                            for (let j = 2; j < points.length; j += 2)
                            {
                                context.lineTo(points[j], points[j + 1]);
                            }
                        }
                        else
                        {
                            context.moveTo(points[points.length - 2], points[points.length - 1]);

                            for (let j = points.length - 4; j >= 0; j -= 2)
                            {
                                context.lineTo(points[j], points[j + 1]);
                            }
                        }

                        if ((holes[k].shape as Polygon).closeStroke)
                        {
                            context.closePath();
                        }

                        holesDirection[k] = innerArea * outerArea < 0;
                    }
                }

                if (fillStyle.visible)
                {
                    context.globalAlpha = fillStyle.alpha * worldAlpha;
                    context.fillStyle = contextFillStyle;
                    context.fill();
                }

                if (lineStyle.visible)
                {
                    this.paintPolygonStroke(
                        tempShape, lineStyle, contextStrokeStyle, holes, holesDirection, worldAlpha, context
                    );
                }
            }
            else if (data.type === SHAPES.RECT)
            {
                const tempShape = shape as Rectangle;

                if (fillStyle.visible)
                {
                    context.globalAlpha = fillStyle.alpha * worldAlpha;
                    context.fillStyle = contextFillStyle;
                    context.fillRect(tempShape.x, tempShape.y, tempShape.width, tempShape.height);
                }

                if (lineStyle.visible)
                {
                    const alignmentOffset = lineStyle.width * (0.5 - (1 - lineStyle.alignment));
                    const width = tempShape.width + (2 * alignmentOffset);
                    const height = tempShape.height + (2 * alignmentOffset);

                    context.globalAlpha = lineStyle.alpha * worldAlpha;
                    context.strokeStyle = contextStrokeStyle;
                    context.strokeRect(tempShape.x - alignmentOffset, tempShape.y - alignmentOffset, width, height);
                }
            }
            else if (data.type === SHAPES.CIRC)
            {
                const tempShape = shape as Circle;

                // TODO - need to be Undefined!
                context.beginPath();
                context.arc(tempShape.x, tempShape.y, tempShape.radius, 0, 2 * Math.PI);
                context.closePath();

                if (fillStyle.visible)
                {
                    context.globalAlpha = fillStyle.alpha * worldAlpha;
                    context.fillStyle = contextFillStyle;
                    context.fill();
                }

                if (lineStyle.visible)
                {
                    if (lineStyle.alignment !== 0.5)
                    {
                        const alignmentOffset = lineStyle.width * (0.5 - (1 - lineStyle.alignment));

                        context.beginPath();
                        context.arc(tempShape.x, tempShape.y, tempShape.radius + alignmentOffset, 0, 2 * Math.PI);
                        context.closePath();
                    }

                    context.globalAlpha = lineStyle.alpha * worldAlpha;
                    context.strokeStyle = contextStrokeStyle;
                    context.stroke();
                }
            }
            else if (data.type === SHAPES.ELIP)
            {
                const tempShape = shape as Ellipse;
                const drawShapeOverStroke = lineStyle.alignment === 1;

                if (!drawShapeOverStroke)
                {
                    this.paintEllipse(tempShape, fillStyle, lineStyle, contextFillStyle, worldAlpha, context);
                }

                if (lineStyle.visible)
                {
                    if (lineStyle.alignment !== 0.5)
                    {
                        const kappa = 0.5522848;
                        const alignmentOffset = lineStyle.width * (0.5 - (1 - lineStyle.alignment));
                        const sW = (tempShape.width + alignmentOffset) * 2;
                        const sH = (tempShape.height + alignmentOffset) * 2;
                        const sX = tempShape.x - (sW / 2);
                        const sY = tempShape.y - (sH / 2);
                        const sOx = (sW / 2) * kappa;
                        const sOy = (sH / 2) * kappa;
                        const sXe = sX + sW;
                        const sYe = sY + sH;
                        const sXm = sX + (sW / 2);
                        const sYm = sY + (sH / 2);

                        context.beginPath();
                        context.moveTo(sX, sYm);
                        context.bezierCurveTo(sX, sYm - sOy, sXm - sOx, sY, sXm, sY);
                        context.bezierCurveTo(sXm + sOx, sY, sXe, sYm - sOy, sXe, sYm);
                        context.bezierCurveTo(sXe, sYm + sOy, sXm + sOx, sYe, sXm, sYe);
                        context.bezierCurveTo(sXm - sOx, sYe, sX, sYm + sOy, sX, sYm);
                        context.closePath();
                    }

                    context.globalAlpha = lineStyle.alpha * worldAlpha;
                    context.strokeStyle = contextStrokeStyle;
                    context.stroke();
                }

                if (drawShapeOverStroke)
                {
                    this.paintEllipse(tempShape, fillStyle, lineStyle, contextFillStyle, worldAlpha, context);
                }
            }
            else if (data.type === SHAPES.RREC)
            {
                const tempShape = shape as RoundedRectangle;
                const drawShapeOverStroke = lineStyle.alignment === 1;

                if (!drawShapeOverStroke)
                {
                    this.paintRoundedRectangle(tempShape, fillStyle, lineStyle, contextFillStyle, worldAlpha, context);
                }

                if (lineStyle.visible)
                {
                    if (lineStyle.alignment !== 0.5)
                    {
                        const width = tempShape.width;
                        const height = tempShape.height;
                        const alignmentOffset = lineStyle.width * (0.5 - (1 - lineStyle.alignment));
                        const sRx = tempShape.x - alignmentOffset;
                        const sRy = tempShape.y - alignmentOffset;
                        const sWidth = tempShape.width + (2 * alignmentOffset);
                        const sHeight = tempShape.height + (2 * alignmentOffset);
                        const radiusOffset = alignmentOffset * (lineStyle.alignment >= 1
                            ? Math.min(sWidth / width, sHeight / height) : Math.min(width / sWidth, height / sHeight));
                        let sRadius = tempShape.radius + radiusOffset;
                        const sMaxRadius = Math.min(sWidth, sHeight) / 2;

                        sRadius = sRadius > sMaxRadius ? sMaxRadius : sRadius;

                        context.beginPath();
                        context.moveTo(sRx, sRy + sRadius);
                        context.lineTo(sRx, sRy + sHeight - sRadius);
                        context.quadraticCurveTo(sRx, sRy + sHeight, sRx + sRadius, sRy + sHeight);
                        context.lineTo(sRx + sWidth - sRadius, sRy + sHeight);
                        context.quadraticCurveTo(sRx + sWidth, sRy + sHeight, sRx + sWidth, sRy + sHeight - sRadius);
                        context.lineTo(sRx + sWidth, sRy + sRadius);
                        context.quadraticCurveTo(sRx + sWidth, sRy, sRx + sWidth - sRadius, sRy);
                        context.lineTo(sRx + sRadius, sRy);
                        context.quadraticCurveTo(sRx, sRy, sRx, sRy + sRadius);
                        context.closePath();
                    }

                    context.globalAlpha = lineStyle.alpha * worldAlpha;
                    context.strokeStyle = contextStrokeStyle;
                    context.stroke();
                }

                if (drawShapeOverStroke)
                {
                    this.paintRoundedRectangle(tempShape, fillStyle, lineStyle, contextFillStyle, worldAlpha, context);
                }
            }
        }
    }

    /**
     * Paint stroke for polygon and holes
     *
     * @private
     * @param shape - Shape to be drawn
     * @param lineStyle - Line style for the shape
     * @param contextStrokeStyle - The strokeStyle for the canvas context
     * @param holes - Holes to be added to the shape
     * @param holesDirection -
     * @param worldAlpha - The multiplied alpha of the displayObject
     * @param context - The canvas context
     */
    private paintPolygonStroke(
        shape: Polygon, lineStyle: LineStyle, contextStrokeStyle: string|CanvasPattern,
        holes: GraphicsData[], holesDirection: boolean[],
        worldAlpha: number, context: CrossPlatformCanvasRenderingContext2D
    ): void
    {
        if (lineStyle.alignment !== 0.5)
        {
            const alignmentOffset = lineStyle.width * (0.5 - (1 - lineStyle.alignment));
            let offsetPoints = PolygonUtils.offsetPolygon(shape.points, alignmentOffset);
            let points;

            context.beginPath();
            context.moveTo(offsetPoints[0], offsetPoints[1]);

            for (let j = 2; j < offsetPoints.length; j += 2)
            {
                context.lineTo(offsetPoints[j], offsetPoints[j + 1]);
            }

            if (shape.closeStroke)
            {
                context.closePath();
            }

            for (let k = 0; k < holes.length; k++)
            {
                points = (holes[k].shape as Polygon).points;
                offsetPoints = PolygonUtils.offsetPolygon(points, alignmentOffset);

                if (holesDirection[k])
                {
                    context.moveTo(offsetPoints[0], offsetPoints[1]);

                    for (let j = 2; j < offsetPoints.length; j += 2)
                    {
                        context.lineTo(offsetPoints[j], offsetPoints[j + 1]);
                    }
                }
                else
                {
                    context.moveTo(offsetPoints[offsetPoints.length - 2], offsetPoints[offsetPoints.length - 1]);

                    for (let j = offsetPoints.length - 4; j >= 0; j -= 2)
                    {
                        context.lineTo(offsetPoints[j], offsetPoints[j + 1]);
                    }
                }

                if ((holes[k].shape as Polygon).closeStroke)
                {
                    context.closePath();
                }
            }
        }

        context.globalAlpha = lineStyle.alpha * worldAlpha;
        context.strokeStyle = contextStrokeStyle;
        context.stroke();
    }

    /**
     * Paint Ellipse
     *
     * @private
     * @param shape - Shape to be drawn
     * @param fillStyle - Fill for the shape
     * @param lineStyle - Line style for the shape
     * @param contextFillStyle - The canvas context fill style
     * @param worldAlpha - The multiplied alpha of the displayObject
     * @param context - The canvas context
     */
    private paintEllipse(
        shape: Ellipse, fillStyle: FillStyle, lineStyle: LineStyle,
        contextFillStyle: string|CanvasPattern, worldAlpha: number,
        context: CrossPlatformCanvasRenderingContext2D): void
    {
        // ellipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas
        const w = shape.width * 2;
        const h = shape.height * 2;

        const x = shape.x - (w / 2);
        const y = shape.y - (h / 2);

        const kappa = 0.5522848;
        const ox = (w / 2) * kappa; // control point offset horizontal
        const oy = (h / 2) * kappa; // control point offset vertical
        const xe = x + w; // x-end
        const ye = y + h; // y-end
        const xm = x + (w / 2); // x-middle
        const ym = y + (h / 2); // y-middle

        context.beginPath();
        context.moveTo(x, ym);
        context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
        context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
        context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
        context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
        context.closePath();

        if (lineStyle.alignment === 0)
        {
            context.clip();
        }

        if (fillStyle.visible)
        {
            context.globalAlpha = fillStyle.alpha * worldAlpha;
            context.fillStyle = contextFillStyle;
            context.fill();
        }
    }

    /**
     * Paint Rounded Rectangle
     *
     * @private
     * @param shape - Shape to be drawn
     * @param fillStyle - Fill for the shape
     * @param lineStyle - Line style for the shape
     * @param contextFillStyle - The canvas context fill style
     * @param worldAlpha - The multiplied alpha of the displayObject
     * @param context - The canvas context
     */
    private paintRoundedRectangle(
        shape: RoundedRectangle, fillStyle: FillStyle, lineStyle: LineStyle,
        contextFillStyle: string|CanvasPattern, worldAlpha: number,
        context: CrossPlatformCanvasRenderingContext2D
    ): void
    {
        const rx = shape.x;
        const ry = shape.y;
        const width = shape.width;
        const height = shape.height;
        let radius = shape.radius;

        const maxRadius = Math.min(width, height) / 2;

        radius = radius > maxRadius ? maxRadius : radius;

        context.beginPath();
        context.moveTo(rx, ry + radius);
        context.lineTo(rx, ry + height - radius);
        context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height);
        context.lineTo(rx + width - radius, ry + height);
        context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius);
        context.lineTo(rx + width, ry + radius);
        context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry);
        context.lineTo(rx + radius, ry);
        context.quadraticCurveTo(rx, ry, rx, ry + radius);
        context.closePath();

        if (lineStyle.alignment === 0)
        {
            context.clip();
        }

        if (fillStyle.visible)
        {
            context.globalAlpha = fillStyle.alpha * worldAlpha;
            context.fillStyle = contextFillStyle;
            context.fill();
        }
    }

    public setPatternTransform(pattern: CanvasPattern, matrix: Matrix): void
    {
        if (this._svgMatrix === false)
        {
            return;
        }
        if (!this._svgMatrix)
        {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

            if (svg && svg.createSVGMatrix)
            {
                this._svgMatrix = svg.createSVGMatrix();
            }
            if (!this._svgMatrix || !pattern.setTransform)
            {
                this._svgMatrix = false;

                return;
            }
        }

        (this._svgMatrix as DOMMatrix).a = matrix.a;
        (this._svgMatrix as DOMMatrix).b = matrix.b;
        (this._svgMatrix as DOMMatrix).c = matrix.c;
        (this._svgMatrix as DOMMatrix).d = matrix.d;
        (this._svgMatrix as DOMMatrix).e = matrix.tx;
        (this._svgMatrix as DOMMatrix).f = matrix.ty;
        pattern.setTransform((this._svgMatrix as DOMMatrix).inverse());
    }

    /** destroy graphics object */
    public destroy(): void
    {
        this.renderer = null;
        this._svgMatrix = null;
        this._tempMatrix = null;
    }
}
