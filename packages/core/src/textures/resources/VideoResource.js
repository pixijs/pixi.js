import TextureResource from './TextureResource';
import { shared } from '@pixi/ticker';

/**
 * Resource type for HTMLVideoElement.
 * @class
 * @extends PIXI.TextureResource
 * @memberof PIXI
 * @param {HTMLVideoElement} source - Video element to use.
 */
export default class VideoResource extends TextureResource
{
    constructor(source)
    {
        super(source);

        this._autoUpdate = true;
        this._isAutoUpdating = false;

        /**
         * When set to true will automatically play videos used by this texture once
         * they are loaded. If false, it will not modify the playing state.
         *
         * @member {boolean}
         * @default true
         */
        this.autoPlay = true;

        this.update = this.update.bind(this);
        this._onCanPlay = this._onCanPlay.bind(this);

        if ((source.readyState === source.HAVE_ENOUGH_DATA || source.readyState === source.HAVE_FUTURE_DATA)
        && source.width && source.height)
        {
            source.complete = true;
        }

        source.addEventListener('play', this._onPlayStart.bind(this));
        source.addEventListener('pause', this._onPlayStop.bind(this));

        if (!this._isSourceReady())
        {
            source.addEventListener('canplay', this._onCanPlay);
            source.addEventListener('canplaythrough', this._onCanPlay);
        }
        else
        {
            this._onCanPlay();
        }

        this.load = new Promise((resolve) =>
        {
            this.resolve = resolve;

            if (this.loaded)
            {
                this.resolve(this);
            }
        });
    }

    update()
    {
        // TODO - slow down and base on the videos framerate
        this.resourceUpdated.emit();
    }

    /**
     * Returns true if the underlying source is playing.
     *
     * @private
     * @return {boolean} True if playing.
     */
    _isSourcePlaying()
    {
        const source = this.source;

        return (source.currentTime > 0 && source.paused === false && source.ended === false && source.readyState > 2);
    }

    /**
     * Returns true if the underlying source is ready for playing.
     *
     * @private
     * @return {boolean} True if ready.
     */
    _isSourceReady()
    {
        return this.source.readyState === 3 || this.source.readyState === 4;
    }

    /**
     * Runs the update loop when the video is ready to play
     *
     * @private
     */
    _onPlayStart()
    {
        // Just in case the video has not received its can play even yet..
        if (!this.loaded)
        {
            this._onCanPlay();
        }

        if (!this._isAutoUpdating && this.autoUpdate)
        {
            shared.add(this.update, this);
            this._isAutoUpdating = true;
        }
    }

    /**
     * Fired when a pause event is triggered, stops the update loop
     *
     * @private
     */
    _onPlayStop()
    {
        if (this._isAutoUpdating)
        {
            shared.remove(this.update, this);
            this._isAutoUpdating = false;
        }
    }

    /**
     * Fired when the video is loaded and ready to play
     *
     * @private
     */
    _onCanPlay()
    {
        if (this.source)
        {
            this.source.removeEventListener('canplay', this._onCanPlay);
            this.source.removeEventListener('canplaythrough', this._onCanPlay);

            this.width = this.source.videoWidth;
            this.height = this.source.videoHeight;

            // prevent multiple loaded dispatches..
            if (!this.loaded)
            {
                this.loaded = true;
                if (this.resolve)
                {
                    this.resolve(this);
                }
            }

            if (this._isSourcePlaying())
            {
                this._onPlayStart();
            }
            else if (this.autoPlay)
            {
                this.source.play();
            }
        }
    }

    /**
     * Destroys this texture
     *
     */
    destroy()
    {
        if (this._isAutoUpdating)
        {
            shared.remove(this.update, this);
        }
        /*
        if (this.source && this.source._pixiId)
        {
            delete BaseTextureCache[this.source._pixiId];
            delete this.source._pixiId;
        }
*/
        //      super.destroy();
    }

    /**
     * Should the base texture automatically update itself, set to true by default
     *
     * @member {boolean}
     */
    get autoUpdate()
    {
        return this._autoUpdate;
    }

    set autoUpdate(value) // eslint-disable-line require-jsdoc
    {
        if (value !== this._autoUpdate)
        {
            this._autoUpdate = value;

            if (!this._autoUpdate && this._isAutoUpdating)
            {
                shared.remove(this.update, this);
                this._isAutoUpdating = false;
            }
            else if (this._autoUpdate && !this._isAutoUpdating)
            {
                shared.add(this.update, this);
                this._isAutoUpdating = true;
            }
        }
    }

    /**
     * Helper function that creates a new BaseTexture based on the given video element.
     * This BaseTexture can then be used to create a texture
     *
     * @static
     * @param {string|object|string[]|object[]} videoSrc - The URL(s) for the video.
     * @param {string} [videoSrc.src] - One of the source urls for the video
     * @param {string} [videoSrc.mime] - The mimetype of the video (e.g. 'video/mp4'). If not specified
     *  the url's extension will be used as the second part of the mime type.
     * @param {number} scaleMode - See {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.VideoBaseTexture} Newly created VideoBaseTexture
     */
    static fromUrl(videoSrc, scaleMode)
    {
        const video = document.createElement('video');

        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('playsinline', '');

        // array of objects or strings
        if (Array.isArray(videoSrc))
        {
            for (let i = 0; i < videoSrc.length; ++i)
            {
                video.appendChild(createSource(videoSrc[i].src || videoSrc[i], videoSrc[i].mime));
            }
        }
        // single object or string
        else
        {
            video.appendChild(createSource(videoSrc.src || videoSrc, videoSrc.mime));
        }

        video.load();

        return new VideoResource(video, scaleMode);
    }
}

function createSource(path, type)
{
    if (!type)
    {
        type = `video/${path.substr(path.lastIndexOf('.') + 1)}`;
    }

    const source = document.createElement('source');

    source.src = path;
    source.type = type;

    return source;
}

/**
 * List of common video file extensions supported by VideoResource.
 * @constant
 * @member {Array<string>}
 * @static
 * @readonly
 */
VideoResource.TYPES = ['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'h264', 'avi', 'mov'];
