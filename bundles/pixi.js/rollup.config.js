import config from '@internal/builder';
import * as fs from 'fs';

// Only support deprecations with UMD format, since this
// is the version of PixiJS run in the browser directly. ES format
// will not receive deprecations.
if (config.output.format === 'umd')
{
    // Rollup exports all the namespaces/classes, in order to
    // deprecates exported classes, we need to add deprecate.js
    // as the outro for the build.
    config.outro = fs.readFileSync('./src/deprecated.js', 'utf8');
}

export default config;
