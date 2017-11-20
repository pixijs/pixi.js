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
        console.warn('Deprecation Warning: ', msg);
    }
    else
    {
        // chop off the stack trace which includes pixi.js internal calls
        stack = stack.split('\n').splice(3).join('\n');

        if (console.groupCollapsed)
        {
            console.groupCollapsed(
                '%cDeprecation Warning: %c%s',
                'color:#614108;background:#fffbe6',
                'font-weight:normal;color:#614108;background:#fffbe6',
                msg
            );
            console.warn(stack);
            console.groupEnd();
        }
        else
        {
            console.warn('Deprecation Warning: ', msg);
            console.warn(stack);
        }
    }
    /* eslint-enable no-console */
}

export default function deprecated(PIXI)
{
    Object.defineProperties(PIXI, {
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

        /**
         * @class PIXI.WebGLRenderer
         * @see PIXI.Renderer
         * @deprecated since 5.0.0
         */
        WebGLRenderer: {
            get()
            {
                warn('PIXI.WebGLRenderer has moved to PIXI.Renderer');

                return PIXI.Renderer;
            },
        },

        /**
         * @class PIXI.CanvasRenderTarget
         * @see PIXI.utils.CanvasRenderTarget
         * @deprecated since 5.0.0
         */
        CanvasRenderTarget: {
            get()
            {
                warn('PIXI.CanvasRenderTarget has moved to PIXI.utils.CanvasRenderTarget');

                return PIXI.utils.CanvasRenderTarget;
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

    /**
     * All classes on this namespace have moved to the high-level `PIXI` object.
     * @namespace PIXI.mesh
     * @deprecated since 5.0.0
     */
    PIXI.mesh = {};

    Object.defineProperties(PIXI.mesh, {
        /**
         * @class PIXI.mesh.Mesh
         * @see PIXI.Mesh
         * @deprecated since 5.0.0
         */
        Mesh: {
            get()
            {
                warn('PIXI.mesh.Mesh has moved to PIXI.Mesh');

                return PIXI.Mesh;
            },
        },
        /**
         * @class PIXI.mesh.NineSlicePlane
         * @see PIXI.NineSlicePlane
         * @deprecated since 5.0.0
         */
        NineSlicePlane: {
            get()
            {
                warn('PIXI.mesh.NineSlicePlane has moved to PIXI.NineSlicePlane');

                return PIXI.NineSlicePlane;
            },
        },
        /**
         * @class PIXI.mesh.Plane
         * @see PIXI.Plane
         * @deprecated since 5.0.0
         */
        Plane: {
            get()
            {
                warn('PIXI.mesh.Plane has moved to PIXI.Plane');

                return PIXI.Plane;
            },
        },
        /**
         * @class PIXI.mesh.Rope
         * @see PIXI.Rope
         * @deprecated since 5.0.0
         */
        Rope: {
            get()
            {
                warn('PIXI.mesh.Rope has moved to PIXI.Rope');

                return PIXI.Rope;
            },
        },
        /**
         * @class PIXI.mesh.RawMesh
         * @see PIXI.RawMesh
         * @deprecated since 5.0.0
         */
        RawMesh: {
            get()
            {
                warn('PIXI.mesh.RawMesh has moved to PIXI.RawMesh');

                return PIXI.RawMesh;
            },
        },
        /**
         * @class PIXI.mesh.CanvasMeshRenderer
         * @see PIXI.CanvasMeshRenderer
         * @deprecated since 5.0.0
         */
        CanvasMeshRenderer: {
            get()
            {
                warn('PIXI.mesh.CanvasMeshRenderer has moved to PIXI.CanvasMeshRenderer');

                return PIXI.CanvasMeshRenderer;
            },
        },
        /**
         * @class PIXI.mesh.MeshRenderer
         * @see PIXI.MeshRenderer
         * @deprecated since 5.0.0
         */
        MeshRenderer: {
            get()
            {
                warn('PIXI.mesh.MeshRenderer has moved to PIXI.MeshRenderer');

                return PIXI.MeshRenderer;
            },
        },
    });

    /*
     * This namespace has been removed and items have been moved to
     * the top-level `PIXI` object.
     * @namespace PIXI.ticker
     * @deprecated since 5.0.0
     */
    PIXI.ticker = {};

    Object.defineProperties(PIXI.ticker, {
        /**
         * @class PIXI.ticker.Ticker
         * @deprecated since 5.0.0
         * @see PIXI.Ticker
         */
        Ticker: {
            get()
            {
                warn('PIXI.ticker.Ticker has moved to PIXI.Ticker');

                return PIXI.Ticker;
            },
        },
        /**
         * @name PIXI.ticker.shared
         * @type {PIXI.Ticker}
         * @deprecated since 5.0.0
         * @see PIXI.Ticker.shared
         */
        shared: {
            get()
            {
                warn('PIXI.ticker.shared has moved to PIXI.Ticker.shared');

                return PIXI.Ticker.shared;
            },
        },
    });

    Object.defineProperties(PIXI.loaders.Loader, {
        /**
         * @function PIXI.loaders.Loader.addPixiMiddleware
         * @see PIXI.loaders.Loader.useMiddleware
         * @deprecated since 5.0.0
         */
        addPixiMiddleware: {
            get()
            {
                warn('PIXI.loaders.Loader.addPixiMiddleware has moved to PIXI.loaders.Loader.useMiddleware');

                return PIXI.loaders.Loader.useMiddleware;
            },
        },
    });

    Object.defineProperties(PIXI.loaders, {
        /**
         * @function PIXI.loaders.bitmapFontParser
         * @see PIXI.BitmapFontLoader.middleware
         * @deprecated since 5.0.0
         */
        bitmapFontParser: {
            get()
            {
                warn('PIXI.loaders.bitmapFontParser has moved to PIXI.BitmapFontLoader.middleware');

                return PIXI.BitmapFontLoader.middleware;
            },
        },
        /**
         * @function PIXI.loaders.parseBitmapFontData
         * @see PIXI.BitmapFontLoader.parse
         * @deprecated since 5.0.0
         */
        parseBitmapFontData: {
            get()
            {
                warn('PIXI.loaders.parseBitmapFontData has moved to PIXI.BitmapFontLoader.parse');

                return PIXI.BitmapFontLoader.parse;
            },
        },
        /**
         * @function PIXI.loaders.spritesheetParser
         * @see PIXI.SpritesheetLoader.middleware
         * @deprecated since 5.0.0
         */
        spritesheetParser: {
            get()
            {
                warn('PIXI.loaders.spritesheetParser has moved to PIXI.SpritesheetLoader.middleware');

                return PIXI.SpritesheetLoader.middleware;
            },
        },
        /**
         * @function PIXI.loaders.getResourcePath
         * @see PIXI.SpritesheetLoader.getResourcePath
         * @deprecated since 5.0.0
         */
        getResourcePath: {
            get()
            {
                warn('PIXI.loaders.getResourcePath has moved to PIXI.SpritesheetLoader.getResourcePath');

                return PIXI.SpritesheetLoader.getResourcePath;
            },
        },
    });

    /**
     * @class PIXI.extract.WebGLExtract
     * @deprecated since 5.0.0
     * @see PIXI.extract.Prepare
     */
    Object.defineProperty(PIXI.extract, 'WebGLExtract', {
        get()
        {
            warn('PIXI.extract.WebGLExtract has moved to PIXI.extract.Extract');

            return PIXI.extract.Extract;
        },
    });

    /**
     * @class PIXI.prepare.WebGLPrepare
     * @deprecated since 5.0.0
     * @see PIXI.prepare.Prepare
     */
    Object.defineProperty(PIXI.prepare, 'WebGLPrepare', {
        get()
        {
            warn('PIXI.prepare.WebGLPrepare has moved to PIXI.prepare.Prepare');

            return PIXI.prepare.Prepare;
        },
    });

    /**
     * @method PIXI.Container#_renderWebGL
     * @private
     * @deprecated since 5.0.0
     * @see PIXI.Container#render
     * @param {PIXI.Renderer} renderer Instance of renderer
     */
    PIXI.Container.prototype._renderWebGL = function _renderWebGL(renderer)
    {
        warn('PIXI.Container#_renderWebGL has moved to PIXI.Container#_render');

        this._render(renderer);
    };

    /**
     * @method PIXI.Container#renderWebGL
     * @deprecated since 5.0.0
     * @see PIXI.Container#render
     * @param {PIXI.Renderer} renderer Instance of renderer
     */
    PIXI.Container.prototype.renderWebGL = function renderWebGL(renderer)
    {
        warn('PIXI.Container#renderWebGL has moved to PIXI.Container#render');

        this.render(renderer);
    };

    /**
     * @method PIXI.DisplayObject#renderWebGL
     * @deprecated since 5.0.0
     * @see PIXI.DisplayObject#render
     * @param {PIXI.Renderer} renderer Instance of renderer
     */
    PIXI.DisplayObject.prototype.renderWebGL = function renderWebGL(renderer)
    {
        warn('PIXI.DisplayObject#renderWebGL has moved to PIXI.DisplayObject#render');

        this.render(renderer);
    };

    /**
     * @method PIXI.Container#renderAdvancedWebGL
     * @deprecated since 5.0.0
     * @see PIXI.Container#renderAdvanced
     * @param {PIXI.Renderer} renderer Instance of renderer
     */
    PIXI.Container.prototype.renderAdvancedWebGL = function renderAdvancedWebGL(renderer)
    {
        warn('PIXI.Container#renderAdvancedWebGL has moved to PIXI.Container#renderAdvanced');

        this.renderAdvanced(renderer);
    };
}
