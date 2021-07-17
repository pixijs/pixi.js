import { Polygon, SHAPES } from '@pixi/math';

import type { CanvasRenderer } from '../CanvasRenderer';
import type { Graphics } from '@pixi/graphics';
import type { MaskData } from '@pixi/core';
import type { Container } from '@pixi/display';

/**
 * A set of functions used to handle masking.
 *
 * Sprite masking is not supported on the CanvasRenderer.
 *
 * @class
 * @memberof PIXI
 */
export class CanvasMaskManager
{
    /** A reference to the current renderer */
    private renderer: CanvasRenderer;
    private _foundShapes: Array<Graphics> = [];

    /** @param renderer - A reference to the current renderer */
    constructor(renderer: CanvasRenderer)
    {
        this.renderer = renderer;
    }

    /**
     * This method adds it to the current stack of masks.
     *
     * @param maskData - the maskData that will be pushed
     */
    pushMask(maskData: MaskData | Graphics): void
    {
        const renderer = this.renderer;
        const maskObject = ((maskData as MaskData).maskObject || maskData) as Container;

        renderer.context.save();

        // TODO support sprite alpha masks??
        // lots of effort required. If demand is great enough..

        const foundShapes = this._foundShapes;

        this.recursiveFindShapes(maskObject, foundShapes);
        if (foundShapes.length > 0)
        {
            const { context } = renderer;

            context.beginPath();

            for (let i = 0; i < foundShapes.length; i++)
            {
                const shape = foundShapes[i];
                const transform = shape.transform.worldTransform;

                this.renderer.setContextTransform(transform);

                this.renderGraphicsShape(shape);
            }

            foundShapes.length = 0;
            context.clip();
        }
    }

    /**
     * Renders all PIXI.Graphics shapes in a subtree.
     *
     * @param container - container to scan.
     * @param out - where to put found shapes
     */
    recursiveFindShapes(container: Container, out: Array<Graphics>): void
    {
        if ((container as Graphics).geometry && (container as Graphics).geometry.graphicsData)
        {
            out.push(container as Graphics);
        }

        const { children } = container;

        if (children)
        {
            for (let i = 0; i < children.length; i++)
            {
                this.recursiveFindShapes(children[i] as Container, out);
            }
        }
    }

    /**
     * Renders a PIXI.Graphics shape.
     *
     * @param graphics - The object to render.
     */
    renderGraphicsShape(graphics: Graphics): void
    {
        graphics.finishPoly();

        const context = this.renderer.context;
        const graphicsData = graphics.geometry.graphicsData;
        const len = graphicsData.length;

        if (len === 0)
        {
            return;
        }

        for (let i = 0; i < len; i++)
        {
            const data = graphicsData[i];
            const shape = data.shape;

            if (shape.type === SHAPES.POLY)
            {
                let points = shape.points;
                const holes = data.holes;
                let outerArea;
                let innerArea;
                let px;
                let py;

                context.moveTo(points[0], points[1]);

                for (let j = 1; j < points.length / 2; j++)
                {
                    context.lineTo(points[j * 2], points[(j * 2) + 1]);
                }
                if (holes.length > 0)
                {
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
                    }
                }
                // if the first and last point are the same close the path - much neater :)
                if (points[0] === points[points.length - 2] && points[1] === points[points.length - 1])
                {
                    context.closePath();
                }
            }
            else if (shape.type === SHAPES.RECT)
            {
                context.rect(shape.x, shape.y, shape.width, shape.height);
                context.closePath();
            }
            else if (shape.type === SHAPES.CIRC)
            {
                // TODO - need to be Undefined!
                context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI);
                context.closePath();
            }
            else if (shape.type === SHAPES.ELIP)
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

                context.moveTo(x, ym);
                context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                context.closePath();
            }
            else if (shape.type === SHAPES.RREC)
            {
                const rx = shape.x;
                const ry = shape.y;
                const width = shape.width;
                const height = shape.height;
                let radius = shape.radius;

                const maxRadius = Math.min(width, height) / 2;

                radius = radius > maxRadius ? maxRadius : radius;

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
            }
        }
    }

    /**
     * Restores the current drawing context to the state it was before the mask was applied.
     *
     * @param renderer - The renderer context to use.
     */
    popMask(renderer: CanvasRenderer): void
    {
        renderer.context.restore();
        renderer.invalidateBlendMode();
    }

    /** Destroys this canvas mask manager. */
    public destroy(): void
    {
        /* empty */
    }
}
