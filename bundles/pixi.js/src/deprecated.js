// provide method to give a stack track for warnings
// useful for tracking-down where deprecated methods/properties/classes
// are being used within the code
function warn(msg)
{
    /* eslint-disable no-console */
    let stack = new Error().stack;

    // Handle IE < 10 and Safari < 6
    if (typeof stack === 'undefined')
    {
        console.warn('Deprecated Warning: ', msg);
    }
    else
    {
        // chop off the stack trace which includes pixi.js internal calls
        stack = stack.split('\n').splice(3).join('\n');

        if (console.groupCollapsed)
        {
            console.groupCollapsed(
                '%cDeprecated Warning: %c%s',
                'color:#614108;background:#fffbe6',
                'font-weight:normal;color:#614108;background:#fffbe6',
                msg
            );
            console.warn(stack);
            console.groupEnd();
        }
        else
        {
            console.warn('Deprecated Warning: ', msg);
            console.warn(stack);
        }
    }
    /* eslint-enable no-console */
}

// Define via the exports
const PIXI = exports;

Object.defineProperties(PIXI, {
    /**
     * @deprecated since 5.0.0
     * @see PIXI.ticker.UPDATE_PRIORITY
     * @static
     * @constant
     * @name UPDATE_PRIORITY
     * @memberof PIXI
     * @type {object}
     */
    UPDATE_PRIORITY: {
        get()
        {
            warn('PIXI.UPDATE_PRIORITY has moved to PIXI.ticker.UPDATE_PRIORITY');

            return PIXI.ticker.UPDATE_PRIORITY;
        },
    },

    /**
     * @constant
     * @name SVG_SIZE
     * @memberof PIXI
     * @see PIXI.SVGResource.SVG_SIZE
     * @deprecated since 5.0.0
     */
    SVG_SIZE: {
        get()
        {
            warn('PIXI.utils.SVG_SIZE has moved to PIXI.SVGResource.SVG_SIZE');

            return PIXI.SVGResource.SVG_SIZE;
        },
    },
});

/**
 * This namespace has been removed. All classes previous nested
 * under this namespace have been moved to the top-level `PIXI` object.
 * @namespace PIXI.extras
 * @deprecated since 5.0.0
 */
PIXI.extras = {};

Object.defineProperties(PIXI.extras, {
    /**
     * @class PIXI.extras.TilingSprite
     * @see PIXI.TilingSprite
     * @deprecated since 5.0.0
     */
    TilingSprite: {
        get()
        {
            warn('PIXI.extras.TilingSprite has moved to PIXI.TilingSprite');

            return PIXI.TilingSprite;
        },
    },
    /**
     * @class PIXI.extras.TilingSpriteRenderer
     * @see PIXI.TilingSpriteRenderer
     * @deprecated since 5.0.0
     */
    TilingSpriteRenderer: {
        get()
        {
            warn('PIXI.extras.TilingSpriteRenderer has moved to PIXI.TilingSpriteRenderer');

            return PIXI.TilingSpriteRenderer;
        },
    },
    /**
     * @class PIXI.extras.AnimatedSprite
     * @see PIXI.AnimatedSprite
     * @deprecated since 5.0.0
     */
    AnimatedSprite: {
        get()
        {
            warn('PIXI.extras.AnimatedSprite has moved to PIXI.AnimatedSprite');

            return PIXI.AnimatedSprite;
        },
    },
    /**
     * @class PIXI.extras.BitmapText
     * @see PIXI.BitmapText
     * @deprecated since 5.0.0
     */
    BitmapText: {
        get()
        {
            warn('PIXI.extras.BitmapText has moved to PIXI.BitmapText');

            return PIXI.BitmapText;
        },
    },
});

Object.defineProperties(PIXI.utils, {
    /**
     * @function PIXI.utils.getSvgSize
     * @see PIXI.SVGResource.getSize
     * @deprecated since 5.0.0
     */
    getSvgSize: {
        get()
        {
            warn('PIXI.utils.getSvgSize has moved to PIXI.SVGResource.getSize');

            return PIXI.SVGResource.getSize;
        },
    },
});
