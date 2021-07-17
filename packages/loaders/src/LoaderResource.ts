import { Dict } from '@pixi/utils';
import { Signal } from './base/Signal';
import { parseUri } from './base/parseUri';
import type { IBaseTextureOptions, Texture } from '@pixi/core';

// tests if CORS is supported in XHR, if not we need to use XDR
const useXdr = !!((window as any).XDomainRequest && !('withCredentials' in (new XMLHttpRequest())));
let tempAnchor: any = null;

// some status constants
const STATUS_NONE = 0;
const STATUS_OK = 200;
const STATUS_EMPTY = 204;
const STATUS_IE_BUG_EMPTY = 1223;
const STATUS_TYPE_OK = 2;

// noop
function _noop(): void { /* empty */ }

/**
 * Quick helper to set a value on one of the extension maps. Ensures there is no
 * dot at the start of the extension.
 *
 * @ignore
 * @param map - The map to set on.
 * @param extname - The extension (or key) to set.
 * @param val - The value to set.
 */
function setExtMap(map: Dict<any>, extname: string, val: number)
{
    if (extname && extname.indexOf('.') === 0)
    {
        extname = extname.substring(1);
    }

    if (!extname)
    {
        return;
    }

    map[extname] = val;
}

/**
 * Quick helper to get string xhr type.
 *
 * @ignore
 * @param xhr - The request to check.
 * @return The type.
 */
function reqType(xhr: XMLHttpRequest)
{
    return xhr.toString().replace('object ', '');
}

/**
 * Metadata for loader resource. It is very messy way to pass options for loader middlewares
 *
 * Can be extended in `GlobalMixins.IResourceMetadata`
 */
export interface IResourceMetadata extends GlobalMixins.IResourceMetadata, IBaseTextureOptions
{
    /**
     * The element to use for loading, instead of creating one.
     */
    loadElement?: HTMLImageElement | HTMLAudioElement | HTMLVideoElement;
    /**
     * Skips adding source(s) to the load element. This
     * is useful if you want to pass in a `loadElement` that you already added load sources to.
     */
    skipSource?: boolean;
    /**
     * The mime type to use for the source element
     * of a video/audio elment. If the urls are an array, you can pass this as an array as well
     * where each index is the mime type to use for the corresponding url index.
     */
    mimeType?: string | string[];

    /**
     * Used by BitmapFonts, Spritesheet and CompressedTextures as the options to used for
     * metadata when loading the child image.
     */
    imageMetadata?: IResourceMetadata;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface LoaderResource extends GlobalMixins.ILoaderResource {}

/**
 * Manages the state and loading of a resource and all child resources.
 *
 * Can be extended in `GlobalMixins.ILoaderResource`
 */
class LoaderResource
{
    /**
     * Texture reference for loading images and other textures.
     */
    texture?: Texture;

    /**
     * used by parsing middleware
     */
    blob?: Blob;

    /**
     * The name of this resource.
     *
     * @readonly
     * @member {string}
     */
    readonly name: string;
    /**
     * The url used to load this resource.
     *
     * @readonly
     * @member {string}
     */
    readonly url: string;
    /**
     * The extension used to load this resource.
     *
     * @readonly
     * @member {string}
     */
    readonly extension: string;
    /**
     * The data that was loaded by the resource.
     *
     * @member {any}
     */
    data: any;
    /**
     * Is this request cross-origin? If unset, determined automatically.
     *
     * @member {string}
     */
    crossOrigin: string | boolean;
    /**
     * A timeout in milliseconds for the load. If the load takes longer than this time
     * it is cancelled and the load is considered a failure. If this value is set to `0`
     * then there is no explicit timeout.
     *
     * @member {number}
     */
    timeout: number;
    /**
     * The method of loading to use for this resource.
     *
     * @member {LoaderResource.LOAD_TYPE}
     */
    loadType: LoaderResource.LOAD_TYPE;
    /**
     * The type used to load the resource via XHR. If unset, determined automatically.
     *
     * @member {string}
     */
    xhrType: string;

    /**
     * Extra info for middleware, and controlling specifics about how the resource loads.
     *
     * Note that if you pass in a `loadElement`, the Resource class takes ownership of it.
     * Meaning it will modify it as it sees fit.
     */
    metadata: IResourceMetadata;
    /**
     * The error that occurred while loading (if any).
     *
     * @readonly
     * @member {Error}
     */
    error: Error;
    /**
     * The XHR object that was used to load this resource. This is only set
     * when `loadType` is `LoaderResource.LOAD_TYPE.XHR`.
     *
     * @readonly
     * @member {XMLHttpRequest}
     */
    xhr: XMLHttpRequest;

    private xdr: any;
    /**
     * The child resources this resource owns.
     *
     * @readonly
     * @member {Resource[]}
     */
    readonly children: LoaderResource[];
    /**
     * The resource type.
     *
     * @readonly
     * @member {LoaderResource.TYPE}
     */
    type: LoaderResource.TYPE;
    /**
     * The progress chunk owned by this resource.
     *
     * @readonly
     * @member {number}
     */
    progressChunk: number;
    /**
     * Dispatched when the resource beings to load.
     *
     * The callback looks like {@link LoaderResource.OnStartSignal}.
     *
     * @member {Signal<LoaderResource.OnStartSignal>}
     */
    onStart: Signal<LoaderResource.OnStartSignal>;
    /**
     * Dispatched each time progress of this resource load updates.
     * Not all resources types and loader systems can support this event
     * so sometimes it may not be available. If the resource
     * is being loaded on a modern browser, using XHR, and the remote server
     * properly sets Content-Length headers, then this will be available.
     *
     * The callback looks like {@link LoaderResource.OnProgressSignal}.
     *
     * @member {Signal<LoaderResource.OnProgressSignal>}
     */
    onProgress: Signal<LoaderResource.OnProgressSignal>;
    /**
     * Dispatched once this resource has loaded, if there was an error it will
     * be in the `error` property.
     *
     * The callback looks like {@link LoaderResource.OnCompleteSignal}.
     *
     * @member {Signal<LoaderResource.OnCompleteSignal>}
     */
    onComplete: Signal<LoaderResource.OnCompleteSignal>;
    /**
     * Dispatched after this resource has had all the *after* middleware run on it.
     *
     * The callback looks like {@link LoaderResource.OnCompleteSignal}.
     *
     * @member {Signal<LoaderResource.OnCompleteSignal>}
     */
    onAfterMiddleware: Signal<LoaderResource.OnCompleteSignal>;

    /**
     * The state flags of this resource.
     *
     * @private
     * @member {number}
     */
    private _flags: number;

    /**
     * The `dequeue` method that will be used a storage place for the async queue dequeue method
     * used privately by the loader.
     *
     * @private
     * @member {function}
     */
    _dequeue: any = _noop;

    /**
     * Used a storage place for the on load binding used privately by the loader.
     *
     * @private
     * @member {function}
     */
    _onLoadBinding: any = null;

    /**
     * The timer for element loads to check if they timeout.
     *
     * @private
     * @member {number}
     */
    private _elementTimer = 0;

    /**
     * The `complete` function bound to this resource's context.
     *
     * @private
     * @member {function}
     */
    private _boundComplete: any = null;

    /**
     * The `_onError` function bound to this resource's context.
     *
     * @private
     * @member {function}
     */
    private _boundOnError: any = null;

    /**
     * The `_onProgress` function bound to this resource's context.
     *
     * @private
     * @member {function}
     */
    private _boundOnProgress: any = null;

    /**
     * The `_onTimeout` function bound to this resource's context.
     *
     * @private
     * @member {function}
     */
    private _boundOnTimeout: any = null;

    private _boundXhrOnError: any = null;
    private _boundXhrOnTimeout: any = null;
    private _boundXhrOnAbort: any = null;
    private _boundXhrOnLoad: any = null;

    /**
     * Sets the load type to be used for a specific extension.
     *
     * @static
     * @param {string} extname - The extension to set the type for, e.g. "png" or "fnt"
     * @param {LoaderResource.LOAD_TYPE} loadType - The load type to set it to.
     */
    static setExtensionLoadType(extname: string, loadType: LoaderResource.LOAD_TYPE): void
    {
        setExtMap(LoaderResource._loadTypeMap, extname, loadType);
    }
    /**
     * Sets the load type to be used for a specific extension.
     *
     * @static
     * @param {string} extname - The extension to set the type for, e.g. "png" or "fnt"
     * @param {LoaderResource.XHR_RESPONSE_TYPE} xhrType - The xhr type to set it to.
     */
    static setExtensionXhrType(extname: string, xhrType: LoaderResource.XHR_RESPONSE_TYPE): void
    {
        setExtMap(LoaderResource._xhrTypeMap, extname, xhrType as any);
    }

    /**
     * @param {string} name - The name of the resource to load.
     * @param {string|string[]} url - The url for this resource, for audio/video loads you can pass
     *      an array of sources.
     * @param {object} [options] - The options for the load.
     * @param {string|boolean} [options.crossOrigin] - Is this request cross-origin? Default is to
     *      determine automatically.
     * @param {number} [options.timeout=0] - A timeout in milliseconds for the load. If the load takes
     *      longer than this time it is cancelled and the load is considered a failure. If this value is
     *      set to `0` then there is no explicit timeout.
     * @param {LoaderResource.LOAD_TYPE} [options.loadType=LoaderResource.LOAD_TYPE.XHR] - How should this resource
     *      be loaded?
     * @param {LoaderResource.XHR_RESPONSE_TYPE} [options.xhrType=LoaderResource.XHR_RESPONSE_TYPE.DEFAULT] - How
     *      should the data being loaded be interpreted when using XHR?
     * @param {LoaderResource.IMetadata} [options.metadata] - Extra configuration for middleware and the Resource object.
     */
    constructor(name: string, url: string | string[], options?: {
        crossOrigin?: string | boolean;
        timeout?: number;
        loadType?: LoaderResource.LOAD_TYPE;
        xhrType?: LoaderResource.XHR_RESPONSE_TYPE;
        metadata?: IResourceMetadata;
    })
    {
        if (typeof name !== 'string' || typeof url !== 'string')
        {
            throw new Error('Both name and url are required for constructing a resource.');
        }

        options = options || {};

        this._flags = 0;

        // set data url flag, needs to be set early for some _determineX checks to work.
        this._setFlag(LoaderResource.STATUS_FLAGS.DATA_URL, url.indexOf('data:') === 0);

        this.name = name;

        this.url = url;

        this.extension = this._getExtension();

        this.data = null;

        this.crossOrigin = options.crossOrigin === true ? 'anonymous' : options.crossOrigin;

        this.timeout = options.timeout || 0;

        this.loadType = options.loadType || this._determineLoadType();

        /**
         * The type used to load the resource via XHR. If unset, determined automatically.
         *
         * @member {string}
         */
        this.xhrType = options.xhrType;

        /**
         * Extra info for middleware, and controlling specifics about how the resource loads.
         *
         * Note that if you pass in a `loadElement`, the Resource class takes ownership of it.
         * Meaning it will modify it as it sees fit.
         *
         * @member {LoaderResource.IMetadata}
         */
        this.metadata = options.metadata || {};

        /**
         * The error that occurred while loading (if any).
         *
         * @readonly
         * @member {Error}
         */
        this.error = null;

        /**
         * The XHR object that was used to load this resource. This is only set
         * when `loadType` is `LoaderResource.LOAD_TYPE.XHR`.
         *
         * @readonly
         * @member {XMLHttpRequest}
         */
        this.xhr = null;

        /**
         * The child resources this resource owns.
         *
         * @readonly
         * @member {Resource[]}
         */
        this.children = [];

        /**
         * The resource type.
         *
         * @readonly
         * @member {LoaderResource.TYPE}
         */
        this.type = LoaderResource.TYPE.UNKNOWN;

        /**
         * The progress chunk owned by this resource.
         *
         * @readonly
         * @member {number}
         */
        this.progressChunk = 0;

        /**
         * The `dequeue` method that will be used a storage place for the async queue dequeue method
         * used privately by the loader.
         *
         * @private
         * @member {function}
         */
        this._dequeue = _noop;

        /**
         * Used a storage place for the on load binding used privately by the loader.
         *
         * @private
         * @member {function}
         */
        this._onLoadBinding = null;

        /**
         * The timer for element loads to check if they timeout.
         *
         * @private
         * @member {number}
         */
        this._elementTimer = 0;

        this._boundComplete = this.complete.bind(this);
        this._boundOnError = this._onError.bind(this);
        this._boundOnProgress = this._onProgress.bind(this);
        this._boundOnTimeout = this._onTimeout.bind(this);

        // xhr callbacks
        this._boundXhrOnError = this._xhrOnError.bind(this);
        this._boundXhrOnTimeout = this._xhrOnTimeout.bind(this);
        this._boundXhrOnAbort = this._xhrOnAbort.bind(this);
        this._boundXhrOnLoad = this._xhrOnLoad.bind(this);

        /**
         * Dispatched when the resource beings to load.
         *
         * The callback looks like {@link LoaderResource.OnStartSignal}.
         *
         * @member {Signal<LoaderResource.OnStartSignal>}
         */
        this.onStart = new Signal();

        /**
         * Dispatched each time progress of this resource load updates.
         * Not all resources types and loader systems can support this event
         * so sometimes it may not be available. If the resource
         * is being loaded on a modern browser, using XHR, and the remote server
         * properly sets Content-Length headers, then this will be available.
         *
         * The callback looks like {@link LoaderResource.OnProgressSignal}.
         *
         * @member {Signal<LoaderResource.OnProgressSignal>}
         */
        this.onProgress = new Signal();

        /**
         * Dispatched once this resource has loaded, if there was an error it will
         * be in the `error` property.
         *
         * The callback looks like {@link LoaderResource.OnCompleteSignal}.
         *
         * @member {Signal<LoaderResource.OnCompleteSignal>}
         */
        this.onComplete = new Signal();

        /**
         * Dispatched after this resource has had all the *after* middleware run on it.
         *
         * The callback looks like {@link LoaderResource.OnCompleteSignal}.
         *
         * @member {Signal<LoaderResource.OnCompleteSignal>}
         */
        this.onAfterMiddleware = new Signal();
    }

    /**
     * When the resource starts to load.
     *
     * @memberof Resource
     * @callback OnStartSignal
     * @param {Resource} resource - The resource that the event happened on.
     */

    /**
     * When the resource reports loading progress.
     *
     * @memberof Resource
     * @callback OnProgressSignal
     * @param {Resource} resource - The resource that the event happened on.
     * @param {number} percentage - The progress of the load in the range [0, 1].
     */

    /**
     * When the resource finishes loading.
     *
     * @memberof Resource
     * @callback OnCompleteSignal
     * @param {Resource} resource - The resource that the event happened on.
     */

    /**
     * @memberof Resource
     * @typedef {object} IMetadata
     * @property {HTMLImageElement|HTMLAudioElement|HTMLVideoElement} [loadElement=null] - The
     *      element to use for loading, instead of creating one.
     * @property {boolean} [skipSource=false] - Skips adding source(s) to the load element. This
     *      is useful if you want to pass in a `loadElement` that you already added load sources to.
     * @property {string|string[]} [mimeType] - The mime type to use for the source element
     *      of a video/audio elment. If the urls are an array, you can pass this as an array as well
     *      where each index is the mime type to use for the corresponding url index.
     */

    /**
     * Stores whether or not this url is a data url.
     *
     * @readonly
     * @member {boolean}
     */
    get isDataUrl(): boolean
    {
        return this._hasFlag(LoaderResource.STATUS_FLAGS.DATA_URL);
    }

    /**
     * Describes if this resource has finished loading. Is true when the resource has completely
     * loaded.
     *
     * @readonly
     * @member {boolean}
     */
    get isComplete(): boolean
    {
        return this._hasFlag(LoaderResource.STATUS_FLAGS.COMPLETE);
    }

    /**
     * Describes if this resource is currently loading. Is true when the resource starts loading,
     * and is false again when complete.
     *
     * @readonly
     * @member {boolean}
     */
    get isLoading(): boolean
    {
        return this._hasFlag(LoaderResource.STATUS_FLAGS.LOADING);
    }

    /**
     * Marks the resource as complete.
     *
     */
    complete(): void
    {
        this._clearEvents();
        this._finish();
    }

    /**
     * Aborts the loading of this resource, with an optional message.
     *
     * @param {string} message - The message to use for the error
     */
    abort(message: string): void
    {
        // abort can be called multiple times, ignore subsequent calls.
        if (this.error)
        {
            return;
        }

        // store error
        this.error = new Error(message);

        // clear events before calling aborts
        this._clearEvents();

        // abort the actual loading
        if (this.xhr)
        {
            this.xhr.abort();
        }
        else if (this.xdr)
        {
            this.xdr.abort();
        }
        else if (this.data)
        {
            // single source
            if (this.data.src)
            {
                this.data.src = LoaderResource.EMPTY_GIF;
            }
            // multi-source
            else
            {
                while (this.data.firstChild)
                {
                    this.data.removeChild(this.data.firstChild);
                }
            }
        }

        // done now.
        this._finish();
    }

    /**
     * Kicks off loading of this resource. This method is asynchronous.
     *
     * @param {LoaderResource.OnCompleteSignal} [cb] - Optional callback to call once the resource is loaded.
     */
    load(cb?: LoaderResource.OnCompleteSignal): void
    {
        if (this.isLoading)
        {
            return;
        }

        if (this.isComplete)
        {
            if (cb)
            {
                setTimeout(() => cb(this), 1);
            }

            return;
        }
        else if (cb)
        {
            this.onComplete.once(cb);
        }

        this._setFlag(LoaderResource.STATUS_FLAGS.LOADING, true);

        this.onStart.dispatch(this);

        // if unset, determine the value
        if (this.crossOrigin === false || typeof this.crossOrigin !== 'string')
        {
            this.crossOrigin = this._determineCrossOrigin(this.url);
        }

        switch (this.loadType)
        {
            case LoaderResource.LOAD_TYPE.IMAGE:
                this.type = LoaderResource.TYPE.IMAGE;
                this._loadElement('image');
                break;

            case LoaderResource.LOAD_TYPE.AUDIO:
                this.type = LoaderResource.TYPE.AUDIO;
                this._loadSourceElement('audio');
                break;

            case LoaderResource.LOAD_TYPE.VIDEO:
                this.type = LoaderResource.TYPE.VIDEO;
                this._loadSourceElement('video');
                break;

            case LoaderResource.LOAD_TYPE.XHR:
            /* falls through */
            default:
                if (useXdr && this.crossOrigin)
                {
                    this._loadXdr();
                }
                else
                {
                    this._loadXhr();
                }
                break;
        }
    }

    /**
     * Checks if the flag is set.
     *
     * @param flag - The flag to check.
     * @return True if the flag is set.
     */
    private _hasFlag(flag: number): boolean
    {
        return (this._flags & flag) !== 0;
    }

    /**
     * (Un)Sets the flag.
     *
     * @param flag - The flag to (un)set.
     * @param value - Whether to set or (un)set the flag.
     */
    private _setFlag(flag: number, value: boolean): void
    {
        this._flags = value ? (this._flags | flag) : (this._flags & ~flag);
    }

    /**
     * Clears all the events from the underlying loading source.
     */
    private _clearEvents(): void
    {
        clearTimeout(this._elementTimer);

        if (this.data && this.data.removeEventListener)
        {
            this.data.removeEventListener('error', this._boundOnError, false);
            this.data.removeEventListener('load', this._boundComplete, false);
            this.data.removeEventListener('progress', this._boundOnProgress, false);
            this.data.removeEventListener('canplaythrough', this._boundComplete, false);
        }

        if (this.xhr)
        {
            if (this.xhr.removeEventListener)
            {
                this.xhr.removeEventListener('error', this._boundXhrOnError, false);
                this.xhr.removeEventListener('timeout', this._boundXhrOnTimeout, false);
                this.xhr.removeEventListener('abort', this._boundXhrOnAbort, false);
                this.xhr.removeEventListener('progress', this._boundOnProgress, false);
                this.xhr.removeEventListener('load', this._boundXhrOnLoad, false);
            }
            else
            {
                this.xhr.onerror = null;
                this.xhr.ontimeout = null;
                this.xhr.onprogress = null;
                this.xhr.onload = null;
            }
        }
    }

    /**
     * Finalizes the load.
     */
    private _finish(): void
    {
        if (this.isComplete)
        {
            throw new Error('Complete called again for an already completed resource.');
        }

        this._setFlag(LoaderResource.STATUS_FLAGS.COMPLETE, true);
        this._setFlag(LoaderResource.STATUS_FLAGS.LOADING, false);

        this.onComplete.dispatch(this);
    }

    /**
     * Loads this resources using an element that has a single source,
     * like an HTMLImageElement.
     * @param type - The type of element to use.
     */
    _loadElement(type: string): void
    {
        if (this.metadata.loadElement)
        {
            this.data = this.metadata.loadElement;
        }
        else if (type === 'image' && typeof window.Image !== 'undefined')
        {
            this.data = new Image();
        }
        else
        {
            this.data = document.createElement(type);
        }

        if (this.crossOrigin)
        {
            this.data.crossOrigin = this.crossOrigin;
        }

        if (!this.metadata.skipSource)
        {
            this.data.src = this.url;
        }

        this.data.addEventListener('error', this._boundOnError, false);
        this.data.addEventListener('load', this._boundComplete, false);
        this.data.addEventListener('progress', this._boundOnProgress, false);

        if (this.timeout)
        {
            this._elementTimer = setTimeout(this._boundOnTimeout, this.timeout) as any;
        }
    }

    /**
     * Loads this resources using an element that has multiple sources,
     * like an HTMLAudioElement or HTMLVideoElement.
     * @param type - The type of element to use.
     */
    private _loadSourceElement(type: string): void
    {
        if (this.metadata.loadElement)
        {
            this.data = this.metadata.loadElement;
        }
        else if (type === 'audio' && typeof window.Audio !== 'undefined')
        {
            this.data = new Audio();
        }
        else
        {
            this.data = document.createElement(type);
        }

        if (this.data === null)
        {
            this.abort(`Unsupported element: ${type}`);

            return;
        }

        if (this.crossOrigin)
        {
            this.data.crossOrigin = this.crossOrigin;
        }

        if (!this.metadata.skipSource)
        {
            // support for CocoonJS Canvas+ runtime, lacks document.createElement('source')
            if ((navigator as any).isCocoonJS)
            {
                this.data.src = Array.isArray(this.url) ? this.url[0] : this.url;
            }
            else if (Array.isArray(this.url))
            {
                const mimeTypes = this.metadata.mimeType;

                for (let i = 0; i < this.url.length; ++i)
                {
                    this.data.appendChild(
                        this._createSource(type, this.url[i], Array.isArray(mimeTypes) ? mimeTypes[i] : mimeTypes)
                    );
                }
            }
            else
            {
                const mimeTypes = this.metadata.mimeType;

                this.data.appendChild(
                    this._createSource(type, this.url, Array.isArray(mimeTypes) ? mimeTypes[0] : mimeTypes)
                );
            }
        }

        this.data.addEventListener('error', this._boundOnError, false);
        this.data.addEventListener('load', this._boundComplete, false);
        this.data.addEventListener('progress', this._boundOnProgress, false);
        this.data.addEventListener('canplaythrough', this._boundComplete, false);

        this.data.load();

        if (this.timeout)
        {
            this._elementTimer = setTimeout(this._boundOnTimeout, this.timeout) as any;
        }
    }

    /**
     * Loads this resources using an XMLHttpRequest.
     */
    private _loadXhr(): void
    {
        // if unset, determine the value
        if (typeof this.xhrType !== 'string')
        {
            this.xhrType = this._determineXhrType();
        }

        const xhr = this.xhr = new XMLHttpRequest();

        // set the request type and url
        xhr.open('GET', this.url, true);

        xhr.timeout = this.timeout;

        // load json as text and parse it ourselves. We do this because some browsers
        // *cough* safari *cough* can't deal with it.
        if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.JSON
            || this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT)
        {
            xhr.responseType = LoaderResource.XHR_RESPONSE_TYPE.TEXT;
        }
        else
        {
            xhr.responseType = this.xhrType as any;
        }

        xhr.addEventListener('error', this._boundXhrOnError, false);
        xhr.addEventListener('timeout', this._boundXhrOnTimeout, false);
        xhr.addEventListener('abort', this._boundXhrOnAbort, false);
        xhr.addEventListener('progress', this._boundOnProgress, false);
        xhr.addEventListener('load', this._boundXhrOnLoad, false);

        xhr.send();
    }

    /**
     * Loads this resources using an XDomainRequest. This is here because we need to support IE9 (gross).
     */
    private _loadXdr(): void
    {
        // if unset, determine the value
        if (typeof this.xhrType !== 'string')
        {
            this.xhrType = this._determineXhrType();
        }

        const xdr = this.xhr = new (window as any).XDomainRequest(); // eslint-disable-line no-undef

        // XDomainRequest has a few quirks. Occasionally it will abort requests
        // A way to avoid this is to make sure ALL callbacks are set even if not used
        // More info here: http://stackoverflow.com/questions/15786966/xdomainrequest-aborts-post-on-ie-9
        xdr.timeout = this.timeout || 5000; // XDR needs a timeout value or it breaks in IE9

        xdr.onerror = this._boundXhrOnError;
        xdr.ontimeout = this._boundXhrOnTimeout;
        xdr.onprogress = this._boundOnProgress;
        xdr.onload = this._boundXhrOnLoad;

        xdr.open('GET', this.url, true);

        // Note: The xdr.send() call is wrapped in a timeout to prevent an
        // issue with the interface where some requests are lost if multiple
        // XDomainRequests are being sent at the same time.
        // Some info here: https://github.com/photonstorm/phaser/issues/1248
        setTimeout(() => xdr.send(), 1);
    }

    /**
     * Creates a source used in loading via an element.
     * @param type - The element type (video or audio).
     * @param url - The source URL to load from.
     * @param [mime] - The mime type of the video
     * @return The source element.
     */
    private _createSource(type: string, url: string, mime: string): HTMLSourceElement
    {
        if (!mime)
        {
            mime = `${type}/${this._getExtension(url)}`;
        }

        const source = document.createElement('source');

        source.src = url;
        source.type = mime;

        return source;
    }

    /**
     * Called if a load errors out.
     *
     * @param event - The error event from the element that emits it.
     */
    private _onError(event: Event): void
    {
        this.abort(`Failed to load element using: ${(event.target as any).nodeName}`);
    }

    /**
     * Called if a load progress event fires for an element or xhr/xdr.
     * @param event - Progress event.
     */
    private _onProgress(event: ProgressEvent): void
    {
        if (event && event.lengthComputable)
        {
            this.onProgress.dispatch(this, event.loaded / event.total);
        }
    }

    /**
     * Called if a timeout event fires for an element.
     */
    private _onTimeout(): void
    {
        this.abort(`Load timed out.`);
    }

    /**
     * Called if an error event fires for xhr/xdr.
     */
    private _xhrOnError(): void
    {
        const xhr = this.xhr;

        this.abort(`${reqType(xhr)} Request failed. Status: ${xhr.status}, text: "${xhr.statusText}"`);
    }

    /**
     * Called if an error event fires for xhr/xdr.
     */
    private _xhrOnTimeout(): void
    {
        const xhr = this.xhr;

        this.abort(`${reqType(xhr)} Request timed out.`);
    }

    /**
     * Called if an abort event fires for xhr/xdr.
     */
    private _xhrOnAbort(): void
    {
        const xhr = this.xhr;

        this.abort(`${reqType(xhr)} Request was aborted by the user.`);
    }

    /**
     * Called when data successfully loads from an xhr/xdr request.
     */
    private _xhrOnLoad(): void
    {
        const xhr = this.xhr;
        let text = '';
        let status = typeof xhr.status === 'undefined' ? STATUS_OK : xhr.status; // XDR has no `.status`, assume 200.

        // responseText is accessible only if responseType is '' or 'text' and on older browsers
        if (xhr.responseType === '' || xhr.responseType === 'text' || typeof xhr.responseType === 'undefined')
        {
            text = xhr.responseText;
        }

        // status can be 0 when using the `file://` protocol so we also check if a response is set.
        // If it has a response, we assume 200; otherwise a 0 status code with no contents is an aborted request.
        if (status === STATUS_NONE && (text.length > 0 || xhr.responseType === LoaderResource.XHR_RESPONSE_TYPE.BUFFER))
        {
            status = STATUS_OK;
        }
        // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
        else if (status === STATUS_IE_BUG_EMPTY)
        {
            status = STATUS_EMPTY;
        }

        const statusType = (status / 100) | 0;

        if (statusType === STATUS_TYPE_OK)
        {
            // if text, just return it
            if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.TEXT)
            {
                this.data = text;
                this.type = LoaderResource.TYPE.TEXT;
            }
            // if json, parse into json object
            else if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.JSON)
            {
                try
                {
                    this.data = JSON.parse(text);
                    this.type = LoaderResource.TYPE.JSON;
                }
                catch (e)
                {
                    this.abort(`Error trying to parse loaded json: ${e}`);

                    return;
                }
            }
            // if xml, parse into an xml document or div element
            else if (this.xhrType === LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT)
            {
                try
                {
                    if (window.DOMParser)
                    {
                        const domparser = new DOMParser();

                        this.data = domparser.parseFromString(text, 'text/xml');
                    }
                    else
                    {
                        const div = document.createElement('div');

                        div.innerHTML = text;

                        this.data = div;
                    }

                    this.type = LoaderResource.TYPE.XML;
                }
                catch (e)
                {
                    this.abort(`Error trying to parse loaded xml: ${e}`);

                    return;
                }
            }
            // other types just return the response
            else
            {
                this.data = xhr.response || text;
            }
        }
        else
        {
            this.abort(`[${xhr.status}] ${xhr.statusText}: ${xhr.responseURL}`);

            return;
        }

        this.complete();
    }

    /**
     * Sets the `crossOrigin` property for this resource based on if the url
     * for this resource is cross-origin. If crossOrigin was manually set, this
     * function does nothing.
     *
     * @param url - The url to test.
     * @param [loc=window.location] - The location object to test against.
     * @return The crossOrigin value to use (or empty string for none).
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    _determineCrossOrigin(url: string, loc?: any): string
    {
        // data: and javascript: urls are considered same-origin
        if (url.indexOf('data:') === 0)
        {
            return '';
        }

        // A sandboxed iframe without the 'allow-same-origin' attribute will have a special
        // origin designed not to match window.location.origin, and will always require
        // crossOrigin requests regardless of whether the location matches.
        if (window.origin !== window.location.origin)
        {
            return 'anonymous';
        }

        // default is window.location
        loc = loc || window.location;

        if (!tempAnchor)
        {
            tempAnchor = document.createElement('a');
        }

        // let the browser determine the full href for the url of this resource and then
        // parse with the node url lib, we can't use the properties of the anchor element
        // because they don't work in IE9 :(
        tempAnchor.href = url;
        const parsedUrl = parseUri(tempAnchor.href, { strictMode: true });

        const samePort = (!parsedUrl.port && loc.port === '') || (parsedUrl.port === loc.port);
        const protocol = parsedUrl.protocol ? `${parsedUrl.protocol}:` : '';

        // if cross origin
        if (parsedUrl.host !== loc.hostname || !samePort || protocol !== loc.protocol)
        {
            return 'anonymous';
        }

        return '';
    }

    /**
     * Determines the responseType of an XHR request based on the extension of the
     * resource being loaded.
     *
     * @private
     * @return {LoaderResource.XHR_RESPONSE_TYPE} The responseType to use.
     */
    private _determineXhrType(): LoaderResource.XHR_RESPONSE_TYPE
    {
        return LoaderResource._xhrTypeMap[this.extension] || LoaderResource.XHR_RESPONSE_TYPE.TEXT;
    }

    /**
     * Determines the loadType of a resource based on the extension of the
     * resource being loaded.
     *
     * @private
     * @return {LoaderResource.LOAD_TYPE} The loadType to use.
     */
    private _determineLoadType(): LoaderResource.LOAD_TYPE
    {
        return LoaderResource._loadTypeMap[this.extension] || LoaderResource.LOAD_TYPE.XHR;
    }

    /**
     * Extracts the extension (sans '.') of the file being loaded by the resource.
     *
     * @param [url] - url to parse, `this.url` by default.
     * @return The extension.
     */
    private _getExtension(url = this.url): string
    {
        let ext = '';

        if (this.isDataUrl)
        {
            const slashIndex = url.indexOf('/');

            ext = url.substring(slashIndex + 1, url.indexOf(';', slashIndex));
        }
        else
        {
            const queryStart = url.indexOf('?');
            const hashStart = url.indexOf('#');
            const index = Math.min(
                queryStart > -1 ? queryStart : url.length,
                hashStart > -1 ? hashStart : url.length
            );

            url = url.substring(0, index);
            ext = url.substring(url.lastIndexOf('.') + 1);
        }

        return ext.toLowerCase();
    }

    /**
     * Determines the mime type of an XHR request based on the responseType of
     * resource being loaded.
     *
     * @param type - The type to get a mime type for.
     * @return The mime type to use.
     */
    _getMimeFromXhrType(type: LoaderResource.XHR_RESPONSE_TYPE): string
    {
        switch (type)
        {
            case LoaderResource.XHR_RESPONSE_TYPE.BUFFER:
                return 'application/octet-binary';

            case LoaderResource.XHR_RESPONSE_TYPE.BLOB:
                return 'application/blob';

            case LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT:
                return 'application/xml';

            case LoaderResource.XHR_RESPONSE_TYPE.JSON:
                return 'application/json';

            case LoaderResource.XHR_RESPONSE_TYPE.DEFAULT:
            case LoaderResource.XHR_RESPONSE_TYPE.TEXT:
            /* falls through */
            default:
                return 'text/plain';
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace LoaderResource {
    /**
     * When the resource starts to load.
     *
     * @memberof Resource
     * @callback OnStartSignal
     * @param {Resource} resource - The resource that the event happened on.
     */
    export type OnStartSignal = (resource: LoaderResource) => void;
    /**
     * When the resource reports loading progress.
     *
     * @memberof Resource
     * @callback OnProgressSignal
     * @param {Resource} resource - The resource that the event happened on.
     * @param {number} percentage - The progress of the load in the range [0, 1].
     */
    export type OnProgressSignal = (resource: LoaderResource, percentage: number) => void;
    /**
     * When the resource finishes loading.
     *
     * @memberof Resource
     * @callback OnCompleteSignal
     * @param {Resource} resource - The resource that the event happened on.
     */
    export type OnCompleteSignal = (resource: LoaderResource) => void;

    /**
     * The types of resources a resource could represent.
     *
     * @static
     * @readonly
     * @enum {number}
     */
    export enum STATUS_FLAGS {
        NONE= 0,
        DATA_URL= (1 << 0),
        COMPLETE= (1 << 1),
        LOADING= (1 << 2),
    }

    /**
     * The types of resources a resource could represent.
     *
     * @static
     * @readonly
     * @enum {number}
     */
    export enum TYPE {
        UNKNOWN= 0,
        JSON= 1,
        XML= 2,
        IMAGE= 3,
        AUDIO= 4,
        VIDEO= 5,
        TEXT= 6,
    }

    /**
     * The types of loading a resource can use.
     *
     * @static
     * @readonly
     * @enum {number}
     */
    export enum LOAD_TYPE {
        /** Uses XMLHttpRequest to load the resource. */
        XHR = 1,
        /** Uses an `Image` object to load the resource. */
        IMAGE = 2,
        /** Uses an `Audio` object to load the resource. */
        AUDIO = 3,
        /** Uses a `Video` object to load the resource. */
        VIDEO = 4,
    }

    /**
     * The XHR ready states, used internally.
     *
     * @static
     * @readonly
     * @enum {string}
     */
    export enum XHR_RESPONSE_TYPE {
        /** string */
        DEFAULT = 'text',
        /** ArrayBuffer */
        BUFFER = 'arraybuffer',
        /** Blob */
        BLOB = 'blob',
        /** Document */
        DOCUMENT = 'document',
        /** Object */
        JSON = 'json',
        /** String */
        TEXT = 'text',
    }

    export const _loadTypeMap: Dict<number> = {
        // images
        gif: LoaderResource.LOAD_TYPE.IMAGE,
        png: LoaderResource.LOAD_TYPE.IMAGE,
        bmp: LoaderResource.LOAD_TYPE.IMAGE,
        jpg: LoaderResource.LOAD_TYPE.IMAGE,
        jpeg: LoaderResource.LOAD_TYPE.IMAGE,
        tif: LoaderResource.LOAD_TYPE.IMAGE,
        tiff: LoaderResource.LOAD_TYPE.IMAGE,
        webp: LoaderResource.LOAD_TYPE.IMAGE,
        tga: LoaderResource.LOAD_TYPE.IMAGE,
        svg: LoaderResource.LOAD_TYPE.IMAGE,
        'svg+xml': LoaderResource.LOAD_TYPE.IMAGE, // for SVG data urls

        // audio
        mp3: LoaderResource.LOAD_TYPE.AUDIO,
        ogg: LoaderResource.LOAD_TYPE.AUDIO,
        wav: LoaderResource.LOAD_TYPE.AUDIO,

        // videos
        mp4: LoaderResource.LOAD_TYPE.VIDEO,
        webm: LoaderResource.LOAD_TYPE.VIDEO,
    };

    export const _xhrTypeMap: Dict<XHR_RESPONSE_TYPE> = {
        // xml
        xhtml: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        html: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        htm: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        xml: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        tmx: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,
        svg: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,

        // This was added to handle Tiled Tileset XML, but .tsx is also a TypeScript React Component.
        // Since it is way less likely for people to be loading TypeScript files instead of Tiled files,
        // this should probably be fine.
        tsx: LoaderResource.XHR_RESPONSE_TYPE.DOCUMENT,

        // images
        gif: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        png: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        bmp: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        jpg: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        jpeg: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tif: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tiff: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        webp: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
        tga: LoaderResource.XHR_RESPONSE_TYPE.BLOB,

        // json
        json: LoaderResource.XHR_RESPONSE_TYPE.JSON,

        // text
        text: LoaderResource.XHR_RESPONSE_TYPE.TEXT,
        txt: LoaderResource.XHR_RESPONSE_TYPE.TEXT,

        // fonts
        ttf: LoaderResource.XHR_RESPONSE_TYPE.BUFFER,
        otf: LoaderResource.XHR_RESPONSE_TYPE.BUFFER,
    };

    // We can't set the `src` attribute to empty string, so on abort we set it to this 1px transparent gif
    export const EMPTY_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
}

export { LoaderResource };

export type ILoaderResource = LoaderResource;
