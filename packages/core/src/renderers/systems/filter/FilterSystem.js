import WebGLSystem from '../WebGLSystem';

import RenderTexture from '../../../textures/RenderTexture';
import Quad from '../../utils/Quad';
import { Rectangle } from '@pixi/math';
import * as filterTransforms from '../../filters/filterTransforms';
import bitTwiddle from 'bit-twiddle';
import UniformGroup from '../../../shader/UniformGroup';

//
/**
 * @ignore
 * @class
 */
class FilterState
{
    /**
     *
     */
    constructor()
    {
        this.renderTexture = null;
        this.sourceFrame = new Rectangle();
        this.destinationFrame = new Rectangle();
        this.filters = [];
        this.target = null;
        this.resolution = 1;
    }
}

/**
 * @class
 * @memberof PIXI
 * @extends PIXI.WebGLSystem
 */
export default class FilterSystem extends WebGLSystem
{
    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer)
    {
        super(renderer);

        // todo add default!
        this.pool = {};

        this.quad = new Quad();
        this.tempRect = new Rectangle();

        this.activeState = {};

        this.globalUniforms = new UniformGroup({
            sourceFrame: this.tempRect,
            destinationFrame: this.tempRect,
        }, true);
    }

    /**
     * Adds a new filter to the System.
     *
     * @param {PIXI.DisplayObject} target - The target of the filter to render.
     * @param {PIXI.Filter[]} filters - The filters to apply.
     */
    push(target, filters)
    {
        const renderer = this.renderer;
        const filterStack = this.renderer.renderTexture.defaultFilterStack;
        const state = new FilterState();
        const resolution = filters[0].resolution;

        filterStack.push(state);

        state.resolution = resolution;

        // round to whole number based on resolution
        // TODO move that to the shader too?
        state.sourceFrame = target.filterArea ? this.transformFilterArea(this.tempRect,
            target.filterArea,
            target.transform) : target.getBounds(true);

        state.sourceFrame.round(resolution);
        state.sourceFrame.pad(filters[0].padding || 1);

        state.renderTexture = this.getPotFilterTexture(state.sourceFrame.width, state.sourceFrame.height, resolution);
        state.filters = filters;

        state.destinationFrame.width = state.renderTexture.width;
        state.destinationFrame.height = state.renderTexture.height;

        state.renderTexture.filterFrame = state.sourceFrame;
        renderer.renderTexture.bind(state.renderTexture, state.sourceFrame);// /, state.destinationFrame);
        renderer.renderTexture.clear();
    }

    /**
     * Pops off the filter and applies it.
     *
     */
    pop()
    {
        const renderer = this.renderer;
        const filterStack = renderer.renderTexture.defaultFilterStack;
        const state = filterStack.pop();
        const filters = state.filters;

        this.activeState = state;

        this.globalUniforms.uniforms.sourceFrame = state.sourceFrame;
        this.globalUniforms.uniforms.destinationFrame = state.destinationFrame;
        this.globalUniforms.update();

        const lastState = filterStack[filterStack.length - 1];

        if (filters.length === 1)
        {
            filters[0].apply(this, state.renderTexture, lastState.renderTexture, false, state);
            renderer.renderTexture.bind(null);

            this.returnFilterTexture(state.renderTexture);
        }
        else
        {
            let flip = state.renderTexture;
            let flop = this.getPotFilterTexture(
                flip.width,
                flip.height,
                state.resolution
            );

            flop.filterFrame = flip.filterFrame;

            let i = 0;

            for (i = 0; i < filters.length - 1; ++i)
            {
                filters[i].apply(this, flip, flop, true, state);

                const t = flip;

                flip = flop;
                flop = t;
            }

            filters[i].apply(this, flip, lastState.renderTexture, false, state);

            this.returnFilterTexture(flip);
            this.returnFilterTexture(flop);
        }
    }

    /**
     * Draws a filter.
     *
     * @param {PIXI.Filter} filter - The filter to draw.
     * @param {PIXI.RenderTarget} input - The input render target.
     * @param {PIXI.RenderTarget} output - The target to output to.
     * @param {boolean} clear - Should the output be cleared before rendering to it
     */
    applyFilter(filter, input, output, clear)
    {
        const renderer = this.renderer;

        renderer.renderTexture.bind(output, output ? output.filterFrame : null);

        if (clear)
        {
            // gl.disable(gl.SCISSOR_TEST);
            renderer.renderTexture.clear();
            // gl.enable(gl.SCISSOR_TEST);
        }

        // set the uniforms..
        filter.uniforms.uSampler = input;
        filter.uniforms.filterGlobals = this.globalUniforms;

        // TODO make it so that the order of this does not matter..
        // because it does at the moment cos of global uniforms.
        // they need to get resynced

        renderer.state.setState(filter.state);
        renderer.shader.bind(filter);
        renderer.geometry.bind(this.quad);
        renderer.geometry.draw(5);
    }

    /**
     * Calculates the mapped matrix.
     *
     * TODO playing around here.. this is temporary - (will end up in the shader)
     * this returns a matrix that will normalise map filter cords in the filter to screen space
     *
     * @param {PIXI.Matrix} outputMatrix - the matrix to output to.
     * @return {PIXI.Matrix} The mapped matrix.
     */
    calculateScreenSpaceMatrix(outputMatrix)
    {
        const currentState = this.activeState;

        return filterTransforms.calculateScreenSpaceMatrix(
            outputMatrix,
            currentState.sourceFrame,
            currentState.destinationFrame
        );
    }

    /**
     * This will map the filter coord so that a texture can be used based on the transform of a sprite
     *
     * @param {PIXI.Matrix} outputMatrix - The matrix to output to.
     * @param {PIXI.Sprite} sprite - The sprite to map to.
     * @return {PIXI.Matrix} The mapped matrix.
     */
    calculateSpriteMatrix(outputMatrix, sprite)
    {
        const currentState = this.activeState;

        return filterTransforms.calculateSpriteMatrix(
            outputMatrix,
            currentState.sourceFrame,
            currentState.destinationFrame,
            sprite
        );
    }

    /**
     * Destroys this Filter System.
     *
     * @param {boolean} [contextLost=false] context was lost, do not free shaders
     *
     */
    destroy(contextLost = false)
    {
        if (!contextLost)
        {
            this.emptyPool();
        }
        else
        {
            this.pool = {};
        }
    }

    /**
     * Gets a Power-of-Two render texture.
     *
     * TODO move to a seperate class could be on renderer?
     * also - could cause issue with multiple contexts?
     *
     * @private
     * @param {WebGLRenderingContext} gl - The webgl rendering context
     * @param {number} minWidth - The minimum width of the render target.
     * @param {number} minHeight - The minimum height of the render target.
     * @param {number} resolution - The resolution of the render target.
     * @return {PIXI.RenderTarget} The new render target.
     */
    getPotFilterTexture(minWidth, minHeight, resolution)
    {
        minWidth = bitTwiddle.nextPow2(minWidth);
        minHeight = bitTwiddle.nextPow2(minHeight);
        resolution = resolution || 1;

        const key = ((minWidth & 0xFFFF) << 16) | (minHeight & 0xFFFF);

        if (!this.pool[key])
        {
            this.pool[key] = [];
        }

        let renderTexture = this.pool[key].pop();

        if (!renderTexture)
        {
            // temporary bypass cache..
            // internally - this will cause a texture to be bound..
            renderTexture = RenderTexture.create({
                width: minWidth,
                height: minHeight,
                resolution,
            });
        }

        return renderTexture;
    }

    getFilterTexture(resolution)
    {
        const rt = this.activeState.renderTexture;

        const filterTexture = this.getPotFilterTexture(rt.width, rt.height, resolution || rt.baseTexture.resolution);

        filterTexture.filterFrame = rt.filterFrame;

        return filterTexture;
    }

    /**
     * Frees a render target back into the pool.
     *
     * @param {PIXI.RenderTarget} renderTarget - The renderTarget to free
     */
    returnFilterTexture(renderTexture)
    {
        renderTexture.filterFrame = null;

        const base = renderTexture.baseTexture;

        const minWidth = base.width;
        const minHeight = base.height;

        const key = ((minWidth & 0xFFFF) << 16) | (minHeight & 0xFFFF);

        this.pool[key].push(renderTexture);
    }

    /**
     * Empties the texture pool.
     *
     */
    emptyPool()
    {
        for (const i in this.pool)
        {
            const textures = this.pool[i];

            if (textures)
            {
                for (let j = 0; j < textures.length; j++)
                {
                    textures[j].destroy(true);
                }
            }
        }

        this.pool = {};
    }

    transformFilterArea(out, rectangle, transform)
    {
        const x0 = rectangle.x;
        const y0 = rectangle.y;

        const x1 = rectangle.x + rectangle.width;
        const y1 = rectangle.y + rectangle.height;

        const matrix = transform.worldTransform;
        const a = matrix.a;
        const b = matrix.b;
        const c = matrix.c;
        const d = matrix.d;
        const tx = matrix.tx;
        const ty = matrix.ty;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        let x = (a * x0) + (c * y0) + tx;
        let y = (b * x0) + (d * y0) + ty;

        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x1) + (c * y0) + tx;
        y = (b * x1) + (d * y0) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x0) + (c * y1) + tx;
        y = (b * x0) + (d * y1) + ty;
        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        x = (a * x1) + (c * y1) + tx;
        y = (b * x1) + (d * y1) + ty;

        minX = x < minX ? x : minX;
        minY = y < minY ? y : minY;
        maxX = x > maxX ? x : maxX;
        maxY = y > maxY ? y : maxY;

        out.x = minX;
        out.y = minY;

        out.width = maxX - minX;
        out.height = maxY - minY;

        return out;
    }
}
