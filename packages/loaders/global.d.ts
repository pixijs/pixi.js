declare namespace GlobalMixins
{
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface ILoaderResource
    {
        /**
         * Texture reference for loading images and other textures.
         */
        texture?: Texture;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IResourceMetadata
    {

    }

    interface Application
    {
        loader: import('@pixi/loaders').Loader;
    }

    interface IApplicationOptions
    {
        sharedLoader?: boolean;
    }
}
