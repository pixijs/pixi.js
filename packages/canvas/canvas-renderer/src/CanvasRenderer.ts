import { AbstractRenderer, CanvasResource, RenderTexture, BaseRenderTexture } from '@pixi/core';
import { CanvasRenderTarget, sayHello, rgb2hex, hex2string, deprecation } from '@pixi/utils';
import { CanvasMaskManager } from './utils/CanvasMaskManager';
import { mapCanvasBlendModesToPixi } from './utils/mapCanvasBlendModesToPixi';
import { RENDERER_TYPE, SCALE_MODES, BLEND_MODES } from '@pixi/constants';
import { settings } from '@pixi/settings';
import { Matrix } from '@pixi/math';

import type { DisplayObject } from '@pixi/display';
import type {
    IRendererOptions,
    IRendererPlugin,
    IRendererPlugins,
    IRendererRenderOptions
} from '@pixi/core';

const tempMatrix = new Matrix();

export interface ICanvasRendererPluginConstructor {
    new (renderer: CanvasRenderer, options?: any): IRendererPlugin;
}

export interface ICanvasRendererPlugins
{
    [key: string]: any;
}

/*
 * Different browsers support different smoothing property names
 * this is the list of all platform props.
 */
type SmoothingEnabledProperties =
    'imageSmoothingEnabled' |
    'webkitImageSmoothingEnabled' |
    'mozImageSmoothingEnabled' |
    'oImageSmoothingEnabled' |
    'msImageSmoothingEnabled';

/**
 * Rendering context for all browsers. This includes platform-specific
 * properties that are not included in the spec for CanvasRenderingContext2D
 * @private
 */
export interface CrossPlatformCanvasRenderingContext2D extends CanvasRenderingContext2D
{
    webkitImageSmoothingEnabled: boolean;
    mozImageSmoothingEnabled: boolean;
    oImageSmoothingEnabled: boolean;
    msImageSmoothingEnabled: boolean;
}

/**
 * The CanvasRenderer draws the scene and all its content onto a 2d canvas.
 *
 * This renderer should be used for browsers that do not support WebGL.
 * Don't forget to add the CanvasRenderer.view to your DOM or you will not see anything!
 *
 * @class
 * @memberof PIXI
 * @extends PIXI.AbstractRenderer
 */
export class CanvasRenderer extends AbstractRenderer
{
    /**
     * Fired after rendering finishes.
     * @event PIXI.CanvasRenderer#postrender
     */
    /**
     * Fired before rendering starts.
     * @event PIXI.CanvasRenderer#prerender
     */

    /** The root canvas 2d context that everything is drawn with. */
    public readonly rootContext: CrossPlatformCanvasRenderingContext2D;
    /** The currently active canvas 2d context (could change with renderTextures) */
    public context: CrossPlatformCanvasRenderingContext2D;
    /** Boolean flag controlling canvas refresh. */
    public refresh = true;
    /**
     * Instance of a CanvasMaskManager, handles masking when using the canvas renderer.
     * @member {PIXI.CanvasMaskManager}
     */
    public maskManager: CanvasMaskManager = new CanvasMaskManager(this);
    /** The canvas property used to set the canvas smoothing property. */
    public smoothProperty: SmoothingEnabledProperties = 'imageSmoothingEnabled';
    /** Tracks the blend modes useful for this renderer. */
    public readonly blendModes: string[] = mapCanvasBlendModesToPixi();
    public renderingToScreen = false;

    private _activeBlendMode: BLEND_MODES =null;
    /** Projection transform, passed in render() stored here */
    private _projTransform: Matrix = null;

    /** @private */
    _outerBlend = false;

    /**
     * @param options - The optional renderer parameters
     * @param {number} [options.width=800] - the width of the screen
     * @param {number} [options.height=600] - the height of the screen
     * @param {HTMLCanvasElement} [options.view] - the canvas to use as a view, optional
     * @param {boolean} [options.useContextAlpha=true] - Pass-through value for canvas' context `alpha` property.
     *   If you want to set transparency, please use `backgroundAlpha`. This option is for cases where the
     *   canvas needs to be opaque, possibly for performance reasons on some older devices.
     * @param {boolean} [options.autoDensity=false] - Resizes renderer view in CSS pixels to allow for
     *   resolutions other than 1
     * @param {boolean} [options.antialias=false] - sets antialias
     * @param {number} [options.resolution=PIXI.settings.RESOLUTION] - The resolution / device pixel ratio of the renderer.
     * @param {boolean} [options.preserveDrawingBuffer=false] - enables drawing buffer preservation,
     *  enable this if you need to call toDataUrl on the webgl context.
     * @param {boolean} [options.clearBeforeRender=true] - This sets if the renderer will clear the canvas or
     *      not before the new render pass.
     * @param {number} [options.backgroundColor=0x000000] - The background color of the rendered area
     *  (shown if not transparent).
     * @param {number} [options.backgroundAlpha=1] - Value from 0 (fully transparent) to 1 (fully opaque).
     */
    constructor(options?: IRendererOptions)
    {
        super(RENDERER_TYPE.CANVAS, options);

        this.rootContext = this.view.getContext('2d', { alpha: this.useContextAlpha }) as
            CrossPlatformCanvasRenderingContext2D;

        this.context = this.rootContext;

        if (!this.rootContext.imageSmoothingEnabled)
        {
            const rc = this.rootContext;

            if (rc.webkitImageSmoothingEnabled)
            {
                this.smoothProperty = 'webkitImageSmoothingEnabled';
            }
            else if (rc.mozImageSmoothingEnabled)
            {
                this.smoothProperty = 'mozImageSmoothingEnabled';
            }
            else if (rc.oImageSmoothingEnabled)
            {
                this.smoothProperty = 'oImageSmoothingEnabled';
            }
            else if (rc.msImageSmoothingEnabled)
            {
                this.smoothProperty = 'msImageSmoothingEnabled';
            }
        }

        this.initPlugins(CanvasRenderer.__plugins);

        sayHello('Canvas');

        this.resize(this.options.width, this.options.height);
    }

    /**
     * Renders the object to its WebGL view.
     *
     * @param displayObject - The object to be rendered.
     * @param options - Object to use for render options.
     * @param {PIXI.RenderTexture} [options.renderTexture] - The render texture to render to.
     * @param {boolean} [options.clear=true] - Should the canvas be cleared before the new render.
     * @param {PIXI.Matrix} [options.transform] - A transform to apply to the render texture before rendering.
     * @param {boolean} [options.skipUpdateTransform=false] - Should we skip the update transform pass?
     */
    render(displayObject: DisplayObject, options?: IRendererRenderOptions): void;

    /**
     * Please use the `option` render arguments instead.
     *
     * @deprecated Since 6.0.0
     * @param displayObject - The object to be rendered.
     * @param renderTexture - The render texture to render to.
     * @param clear - Should the canvas be cleared before the new render.
     * @param transform - A transform to apply to the render texture before rendering.
     * @param skipUpdateTransform - Should we skip the update transform pass?
     */
    render(displayObject: DisplayObject, renderTexture?: RenderTexture | BaseRenderTexture,
        clear?: boolean, transform?: Matrix, skipUpdateTransform?: boolean): void;

    /** @ignore */
    public render(displayObject: DisplayObject, options?: IRendererRenderOptions | RenderTexture | BaseRenderTexture): void
    {
        if (!this.view)
        {
            return;
        }

        let renderTexture: BaseRenderTexture | RenderTexture;
        let clear: boolean;
        let transform: Matrix;
        let skipUpdateTransform: boolean;

        if (options)
        {
            if (options instanceof RenderTexture || options instanceof BaseRenderTexture)
            {
                // #if _DEBUG
                deprecation('6.0.0', 'CanvasRenderer#render arguments changed, use options instead.');
                // #endif

                /* eslint-disable prefer-rest-params */
                renderTexture = options;
                clear = arguments[2];
                transform = arguments[3];
                skipUpdateTransform = arguments[4];
                /* eslint-enable prefer-rest-params */
            }
            else
            {
                renderTexture = options.renderTexture;
                clear = options.clear;
                transform = options.transform;
                skipUpdateTransform = options.skipUpdateTransform;
            }
        }

        // can be handy to know!
        this.renderingToScreen = !renderTexture;

        this.emit('prerender');

        const rootResolution = this.resolution;

        if (renderTexture)
        {
            renderTexture = renderTexture.castToBaseTexture() as BaseRenderTexture;

            if (!renderTexture._canvasRenderTarget)
            {
                renderTexture._canvasRenderTarget = new CanvasRenderTarget(
                    renderTexture.width,
                    renderTexture.height,
                    renderTexture.resolution
                );
                renderTexture.resource = new CanvasResource(renderTexture._canvasRenderTarget.canvas);
                renderTexture.valid = true;
            }

            this.context = renderTexture._canvasRenderTarget.context as CrossPlatformCanvasRenderingContext2D;
            this.resolution = renderTexture._canvasRenderTarget.resolution;
        }
        else
        {
            this.context = this.rootContext;
        }

        const context = this.context;

        this._projTransform = transform || null;

        if (!renderTexture)
        {
            this._lastObjectRendered = displayObject;
        }

        if (!skipUpdateTransform)
        {
            // update the scene graph
            const cacheParent = displayObject.enableTempParent();

            displayObject.updateTransform();
            displayObject.disableTempParent(cacheParent);
        }

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        this._activeBlendMode = BLEND_MODES.NORMAL;
        this._outerBlend = false;
        context.globalCompositeOperation = this.blendModes[BLEND_MODES.NORMAL];

        if (clear !== undefined ? clear : this.clearBeforeRender)
        {
            if (this.renderingToScreen)
            {
                context.clearRect(0, 0, this.width, this.height);

                if (this.backgroundAlpha > 0)
                {
                    context.globalAlpha = this.useContextAlpha ? this.backgroundAlpha : 1;
                    context.fillStyle = this._backgroundColorString;
                    context.fillRect(0, 0, this.width, this.height);
                    context.globalAlpha = 1;
                }
            }
            else
            {
                renderTexture = (renderTexture as BaseRenderTexture);
                renderTexture._canvasRenderTarget.clear();

                const clearColor = renderTexture.clearColor;

                if (clearColor[3] > 0)
                {
                    context.globalAlpha = this.useContextAlpha ? clearColor[3] : 1;
                    context.fillStyle = hex2string(rgb2hex(clearColor));
                    context.fillRect(0, 0, renderTexture.realWidth, renderTexture.realHeight);
                    context.globalAlpha = 1;
                }
            }
        }

        // TODO RENDER TARGET STUFF HERE..
        const tempContext = this.context;

        this.context = context;
        displayObject.renderCanvas(this);
        this.context = tempContext;

        context.restore();

        this.resolution = rootResolution;
        this._projTransform = null;

        this.emit('postrender');
    }

    /**
     * Sets matrix of context.
     * called only from render() methods
     * takes care about resolution
     * @param transform - world matrix of current element
     * @param roundPixels - whether to round (tx,ty) coords
     * @param localResolution - If specified, used instead of `renderer.resolution` for local scaling
     */
    setContextTransform(transform: Matrix, roundPixels?: boolean, localResolution?: number): void
    {
        let mat = transform;
        const proj = this._projTransform;
        const resolution = this.resolution;

        localResolution = localResolution || resolution;

        if (proj)
        {
            mat = tempMatrix;
            mat.copyFrom(transform);
            mat.prepend(proj);
        }

        if (roundPixels)
        {
            this.context.setTransform(
                mat.a * localResolution,
                mat.b * localResolution,
                mat.c * localResolution,
                mat.d * localResolution,
                (mat.tx * resolution) | 0,
                (mat.ty * resolution) | 0
            );
        }
        else
        {
            this.context.setTransform(
                mat.a * localResolution,
                mat.b * localResolution,
                mat.c * localResolution,
                mat.d * localResolution,
                mat.tx * resolution,
                mat.ty * resolution
            );
        }
    }

    /**
     * Clear the canvas of renderer.
     *
     * @param {string} [clearColor] - Clear the canvas with this color, except the canvas is transparent.
     * @param {number} [alpha] - Alpha to apply to the background fill color.
     */
    public clear(clearColor: string = this._backgroundColorString, alpha: number = this.backgroundAlpha): void
    {
        const { context } = this;

        context.clearRect(0, 0, this.width, this.height);

        if (clearColor)
        {
            context.globalAlpha = this.useContextAlpha ? alpha : 1;
            context.fillStyle = clearColor;
            context.fillRect(0, 0, this.width, this.height);
            context.globalAlpha = 1;
        }
    }

    /**
     * Sets the blend mode of the renderer.
     *
     * @param {number} blendMode - See {@link PIXI.BLEND_MODES} for valid values.
     * @param {boolean} [readyForOuterBlend=false] - Some blendModes are dangerous, they affect outer space of sprite.
     * Pass `true` only if you are ready to use them.
     */
    setBlendMode(blendMode: BLEND_MODES, readyForOuterBlend?: boolean): void
    {
        const outerBlend = blendMode === BLEND_MODES.SRC_IN
            || blendMode === BLEND_MODES.SRC_OUT
            || blendMode === BLEND_MODES.DST_IN
            || blendMode === BLEND_MODES.DST_ATOP;

        if (!readyForOuterBlend && outerBlend)
        {
            blendMode = BLEND_MODES.NORMAL;
        }

        if (this._activeBlendMode === blendMode)
        {
            return;
        }

        this._activeBlendMode = blendMode;
        this._outerBlend = outerBlend;
        this.context.globalCompositeOperation = this.blendModes[blendMode];
    }

    /**
     * Removes everything from the renderer and optionally removes the Canvas DOM element.
     *
     * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
     */
    public destroy(removeView?: boolean): void
    {
        // call the base destroy
        super.destroy(removeView);

        this.context = null;

        this.refresh = true;

        this.maskManager.destroy();
        this.maskManager = null;

        this.smoothProperty = null;
    }

    /**
     * Resizes the canvas view to the specified width and height.
     *
     * @extends PIXI.AbstractRenderer#resize
     *
     * @param desiredScreenWidth - the desired width of the screen
     * @param desiredScreenHeight - the desired height of the screen
     */
    public resize(desiredScreenWidth: number, desiredScreenHeight: number): void
    {
        super.resize(desiredScreenWidth, desiredScreenHeight);

        // reset the scale mode.. oddly this seems to be reset when the canvas is resized.
        // surely a browser bug?? Let PixiJS fix that for you..
        if (this.smoothProperty)
        {
            this.rootContext[this.smoothProperty] = (settings.SCALE_MODE === SCALE_MODES.LINEAR);
        }
    }

    /** Checks if blend mode has changed. */
    invalidateBlendMode(): void
    {
        this._activeBlendMode = this.blendModes.indexOf(this.context.globalCompositeOperation);
    }

    static __plugins: IRendererPlugins;

    /**
     * Collection of installed plugins. These are included by default in PIXI, but can be excluded
     * by creating a custom build. Consult the README for more information about creating custom
     * builds and excluding plugins.
     * @member {object} plugins
     * @readonly
     * @property {PIXI.AccessibilityManager} accessibility Support tabbing interactive elements.
     * @property {PIXI.CanvasExtract} extract Extract image data from renderer.
     * @property {PIXI.InteractionManager} interaction Handles mouse, touch and pointer events.
     * @property {PIXI.CanvasPrepare} prepare Pre-render display objects.
     */

    /**
     * Adds a plugin to the renderer.
     *
     * @param pluginName - The name of the plugin.
     * @param ctor - The constructor function or class for the plugin.
     */
    static registerPlugin(pluginName: string, ctor: ICanvasRendererPluginConstructor): void
    {
        CanvasRenderer.__plugins = CanvasRenderer.__plugins || {};
        CanvasRenderer.__plugins[pluginName] = ctor;
    }
}
