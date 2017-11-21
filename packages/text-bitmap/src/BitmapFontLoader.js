import * as path from 'path';
import { TextureCache } from '@pixi/utils';
import { Resource } from '@pixi/loaders';
import BitmapText from './BitmapText';

/**
 * {@link PIXI.loaders.Loader Loader} middleware for loading
 * bitmap-based fonts suitable for using with {@link PIXI.BitmapText}.
 * @class
 * @memberof PIXI
 */
export default class BitmapFontLoader
{
    /**
     * Register a BitmapText font from loader resource.
     *
     * @param {PIXI.loaders.Resource} resource - Loader resource.
     * @param {PIXI.Texture} texture - Reference to texture.
     */
    static parse(resource, texture)
    {
        resource.bitmapFont = BitmapText.registerFont(resource.data, texture);
    }

    /**
     * Middleware function to support BitmapText fonts, this is automatically installed.
     * @see PIXI.loaders.Loader.useMiddleware
     */
    static middleware()
    {
        return function bitmapFontLoader(resource, next)
        {
            // skip if no data or not xml data
            if (!resource.data || resource.type !== Resource.TYPE.XML)
            {
                next();

                return;
            }

            // skip if not bitmap font data, using some silly duck-typing
            if (resource.data.getElementsByTagName('page').length === 0
                || resource.data.getElementsByTagName('info').length === 0
                || resource.data.getElementsByTagName('info')[0].getAttribute('face') === null
            )
            {
                next();

                return;
            }

            let xmlUrl = !resource.isDataUrl ? path.dirname(resource.url) : '';

            if (resource.isDataUrl)
            {
                if (xmlUrl === '.')
                {
                    xmlUrl = '';
                }

                if (this.baseUrl && xmlUrl)
                {
                    // if baseurl has a trailing slash then add one to xmlUrl so the replace works below
                    if (this.baseUrl.charAt(this.baseUrl.length - 1) === '/')
                    {
                        xmlUrl += '/';
                    }
                }
            }

            // remove baseUrl from xmlUrl
            xmlUrl = xmlUrl.replace(this.baseUrl, '');

            // if there is an xmlUrl now, it needs a trailing slash. Ensure that it does if the string isn't empty.
            if (xmlUrl && xmlUrl.charAt(xmlUrl.length - 1) !== '/')
            {
                xmlUrl += '/';
            }

            const textureUrl = xmlUrl + resource.data.getElementsByTagName('page')[0].getAttribute('file');

            if (TextureCache[textureUrl])
            {
                // reuse existing texture
                BitmapFontLoader.parse(resource, TextureCache[textureUrl]);
                next();
            }
            else
            {
                const loadOptions = {
                    crossOrigin: resource.crossOrigin,
                    loadType: Resource.LOAD_TYPE.IMAGE,
                    metadata: resource.metadata.imageMetadata,
                    parentResource: resource,
                };

                // load the texture for the font
                this.add(`${resource.name}_image`, textureUrl, loadOptions, (res) =>
                {
                    BitmapFontLoader.parse(resource, res.texture);
                    next();
                });
            }
        };
    }
}

// Add custom add support for loading fnt files as XML
Resource.setExtensionXhrType('fnt', Resource.XHR_RESPONSE_TYPE.DOCUMENT);
