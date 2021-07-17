import { Dict } from '@pixi/utils';
import { LoaderResource } from '../LoaderResource';

// a simple in-memory cache for resources
const cache: Dict<any> = {};

/**
 * A simple in-memory cache for resource.
 *
 * @memberof middleware
 * @function caching
 * @example
 * import { Loader, middleware } from 'resource-loader';
 * const loader = new Loader();
 * loader.use(middleware.caching);
 * @param resource - Current Resource
 * @param next - Callback when complete
 */
export function caching(resource: LoaderResource, next: (...args: any) => void): void
{
    // if cached, then set data and complete the resource
    if (cache[resource.url])
    {
        resource.data = cache[resource.url];
        resource.complete(); // marks resource load complete and stops processing before middlewares
    }
    // if not cached, wait for complete and store it in the cache.
    else
    {
        resource.onComplete.once(function doCache(this: LoaderResource) { cache[this.url] = this.data; });
    }

    next();
}
