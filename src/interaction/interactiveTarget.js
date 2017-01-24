/**
 * Default property values of interactive objects
 * Used by {@link PIXI.interaction.InteractionManager} to automatically give all DisplayObjects these properties
 *
 * @mixin
 * @name interactiveTarget
 * @memberof PIXI.interaction
 * @example
 *      function MyObject() {}
 *
 *      Object.assign(
 *          core.DisplayObject.prototype,
 *          PIXI.interaction.interactiveTarget
 *      );
 */
export default {
    /**
     * Determines if the displayObject be clicked/touched
     *
     * @inner {boolean}
     */
    interactive: false,

    /**
     * Determines if the children to the displayObject can be clicked/touched
     * Setting this to false allows pixi to bypass a recursive hitTest function
     *
     * @inner {boolean}
     */
    interactiveChildren: true,

    /**
     * Interaction shape. Children will be hit first, then this shape will be checked.
     * Setting this will cause this shape to be checked in hit tests rather than the displayObject's bounds.
     *
     * @inner {PIXI.Rectangle|PIXI.Circle|PIXI.Ellipse|PIXI.Polygon|PIXI.RoundedRectangle}
     */
    hitArea: null,

    /**
     * If enabled, the mouse cursor will change when hovered over the displayObject if it is interactive
     *
     * @inner {boolean}
     */
    buttonMode: false,

    /**
     * If buttonMode is enabled, this defines what CSS cursor property is used when the mouse cursor
     * is hovered over the displayObject
     *
     * @see https://developer.mozilla.org/en/docs/Web/CSS/cursor
     *
     * @inner {string}
     */
    defaultCursor: 'pointer',

    /**
     * Internal set of all active pointers, by identifier
     *
     * @returns {Map<number, InteractionTrackingData>} Map of all tracked pointers, by identifier
     * @private
     */
    getTrackedPointers: function getTrackedPointers()
    {
        if (this._trackedPointers === undefined) this._trackedPointers = {};

        return this._trackedPointers;
    },
};
