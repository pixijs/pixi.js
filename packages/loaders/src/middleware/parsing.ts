import { LoaderResource } from '../LoaderResource';
import { encodeBinary } from '../base/encodeBinary';

const Url = window.URL || window.webkitURL;

/**
 * A middleware for transforming XHR loaded Blobs into more useful objects
 *
 * @memberof middleware
 * @function parsing
 * @example
 * import { Loader, middleware } from 'resource-loader';
 * const loader = new Loader();
 * loader.use(middleware.parsing);
 * @param resource - Current Resource
 * @param next - Callback when complete
 */
export function parsing(resource: LoaderResource, next: (...args: any) => void): void
{
    if (!resource.data)
    {
        next();

        return;
    }

    // if this was an XHR load of a blob
    if (resource.xhr && resource.xhrType === LoaderResource.XHR_RESPONSE_TYPE.BLOB)
    {
        // if there is no blob support we probably got a binary string back
        if (!window.Blob || typeof resource.data === 'string')
        {
            const type = resource.xhr.getResponseHeader('content-type');

            // this is an image, convert the binary string into a data url
            if (type && type.indexOf('image') === 0)
            {
                resource.data = new Image();
                resource.data.src = `data:${type};base64,${encodeBinary(resource.xhr.responseText)}`;

                resource.type = LoaderResource.TYPE.IMAGE;

                // wait until the image loads and then callback
                resource.data.onload = () =>
                {
                    resource.data.onload = null;

                    next();
                };

                // next will be called on load
                return;
            }
        }
        // if content type says this is an image, then we should transform the blob into an Image object
        else if (resource.data.type.indexOf('image') === 0)
        {
            const src = Url.createObjectURL(resource.data);

            resource.blob = resource.data;
            resource.data = new Image();
            resource.data.src = src;

            resource.type = LoaderResource.TYPE.IMAGE;

            // cleanup the no longer used blob after the image loads
            // TODO: Is this correct? Will the image be invalid after revoking?
            resource.data.onload = () =>
            {
                Url.revokeObjectURL(src);
                resource.data.onload = null;

                next();
            };

            // next will be called on load.
            return;
        }
    }

    next();
}
