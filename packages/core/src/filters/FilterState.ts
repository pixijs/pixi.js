import { Matrix, Rectangle } from '@pixi/math';
import { MSAA_QUALITY } from '@pixi/constants';

import type { Filter } from './Filter';
import type { IFilterTarget } from './IFilterTarget';
import type { RenderTexture } from '../renderTexture/RenderTexture';

/**
 * System plugin to the renderer to manage filter states.
 *
 * @class
 * @private
 */
export class FilterState
{
    renderTexture: RenderTexture;
    target: IFilterTarget;
    legacy: boolean;
    resolution: number;
    multisample: MSAA_QUALITY;
    sourceFrame: Rectangle;
    destinationFrame: Rectangle;
    bindingSourceFrame: Rectangle;
    bindingDestinationFrame: Rectangle;
    filters: Array<Filter>;
    transform: Matrix;

    constructor()
    {
        this.renderTexture = null;

        /**
         * Target of the filters
         * We store for case when custom filter wants to know the element it was applied on
         * @member {PIXI.DisplayObject}
         * @private
         */
        this.target = null;

        /**
         * Compatibility with PixiJS v4 filters
         * @member {boolean}
         * @default false
         * @private
         */
        this.legacy = false;

        /**
         * Resolution of filters
         * @member {number}
         * @default 1
         * @private
         */
        this.resolution = 1;

        /**
         * Number of samples
         * @member {PIXI.MSAA_QUALITY}
         * @default MSAA_QUALITY.NONE
         * @private
         */
        this.multisample = MSAA_QUALITY.NONE;

        // next three fields are created only for root
        // re-assigned for everything else

        /**
         * Source frame
         * @member {PIXI.Rectangle}
         * @private
         */
        this.sourceFrame = new Rectangle();

        /**
         * Destination frame
         * @member {PIXI.Rectangle}
         * @private
         */
        this.destinationFrame = new Rectangle();

        /**
         * Original render-target source frame
         * @private
         */
        this.bindingSourceFrame = new Rectangle();

        /**
         * Original render-target destination frame
         * @private
         */
        this.bindingDestinationFrame = new Rectangle();

        /**
         * Collection of filters
         * @member {PIXI.Filter[]}
         * @private
         */
        this.filters = [];

        /**
         * Projection system transform saved by link.
         * @member {PIXI.Matrix}
         * @private
         */
        this.transform = null;
    }

    /**
     * clears the state
     * @private
     */
    clear(): void
    {
        this.target = null;
        this.filters = null;
        this.renderTexture = null;
    }
}
