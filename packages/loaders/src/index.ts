export * from './base/AsyncQueue';
export * from './base/encodeBinary';
export * from './base/parseUri';
export * from './base/Signal';
export * from './middleware';

export * from './AppLoaderPlugin';
export * from './LoaderResource';
export * from './Loader';
export * from './TextureLoader';

import { parsing } from './middleware';
import { Loader } from './Loader';
import { TextureLoader } from './TextureLoader';

// parse any blob into more usable objects (e.g. Image)
Loader.registerPlugin({ use: parsing });

// parse any Image objects into textures
Loader.registerPlugin(TextureLoader);
