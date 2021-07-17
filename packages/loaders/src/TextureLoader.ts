import { Texture } from '@pixi/core';
import { LoaderResource } from './LoaderResource';
import { ILoaderPlugin } from './Loader';

/**
 * Loader plugin for handling Texture resources.
 * @class
 */
export class TextureLoader implements ILoaderPlugin
{
    /**
     * Handle SVG elements a text, render with SVGResource.
     */
    public static add(): void
    {
        LoaderResource.setExtensionLoadType('svg', LoaderResource.LOAD_TYPE.XHR);
        LoaderResource.setExtensionXhrType('svg', LoaderResource.XHR_RESPONSE_TYPE.TEXT);
    }

    /**
     * Called after a resource is loaded.
     * @see PIXI.Loader.loaderMiddleware
     * @param resource
     * @param {function} next
     */
    public static use(resource: LoaderResource, next: (...args: any[]) => void): void
    {
        // create a new texture if the data is an Image object
        if (resource.data && (resource.type === LoaderResource.TYPE.IMAGE || resource.extension === 'svg'))
        {
            const { data, url, name, metadata } = resource;

            Texture.fromLoader(data, url, name, metadata).then((texture) =>
            {
                resource.texture = texture;
                next();
            })
            // TODO: handle errors in Texture.fromLoader
            // so we can pass them to the Loader
                .catch(next);
        }
        else
        {
            next();
        }
    }
}
