import { settings } from '@pixi/settings';

/**
 * Creates a Canvas element of the given size to be used as a target for rendering to.
 *
 * @class
 * @memberof PIXI.utils
 */
export class CanvasRenderTarget
{
    /** The Canvas object that belongs to this CanvasRenderTarget. */
    public canvas: HTMLCanvasElement;

    /** A CanvasRenderingContext2D object representing a two-dimensional rendering context. */
    public context: CanvasRenderingContext2D;

    /**
     * The resolution / device pixel ratio of the canvas
     * @default 1
     */
    public resolution: number;

    /**
     * @param width - the width for the newly created canvas
     * @param height - the height for the newly created canvas
     * @param {number} [resolution=PIXI.settings.RESOLUTION] - The resolution / device pixel ratio of the canvas
     */
    constructor(width: number, height: number, resolution?: number)
    {
        this.canvas = document.createElement('canvas');

        this.context = this.canvas.getContext('2d');

        this.resolution = resolution || settings.RESOLUTION;

        this.resize(width, height);
    }

    /**
     * Clears the canvas that was created by the CanvasRenderTarget class.
     *
     * @private
     */
    clear(): void
    {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Resizes the canvas to the specified width and height.
     *
     * @param desiredWidth - the desired width of the canvas
     * @param desiredHeight - the desired height of the canvas
     */
    resize(desiredWidth: number, desiredHeight: number): void
    {
        this.canvas.width = Math.round(desiredWidth * this.resolution);
        this.canvas.height = Math.round(desiredHeight * this.resolution);
    }

    /** Destroys this canvas. */
    destroy(): void
    {
        this.context = null;
        this.canvas = null;
    }

    /**
     * The width of the canvas buffer in pixels.
     *
     * @member {number}
     */
    get width(): number
    {
        return this.canvas.width;
    }

    set width(val: number)
    {
        this.canvas.width = Math.round(val);
    }

    /**
     * The height of the canvas buffer in pixels.
     *
     * @member {number}
     */
    get height(): number
    {
        return this.canvas.height;
    }

    set height(val: number)
    {
        this.canvas.height = Math.round(val);
    }
}
