import path from 'path';
import fs from 'fs';
import buble from 'buble';
import thaw from './thaw';
import transpile from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import string from 'rollup-plugin-string';
import sourcemaps from 'rollup-plugin-sourcemaps';
import uglify from 'rollup-plugin-uglify';
import { minify } from 'uglify-es';
import minimist from 'minimist';
import commonjs from 'rollup-plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import replace from 'rollup-plugin-replace';
import preprocess from 'rollup-plugin-preprocess';

const pkg = require(path.resolve('./package'));
const input = 'src/index.js';

const { prod, bundle, deprecated } = minimist(process.argv.slice(2), {
    string: ['deprecated'],
    boolean: ['prod', 'bundle'],
    default: {
        prod: false,
        bundle: false,
    },
    alias: {
        p: 'prod',
        b: 'bundle',
        r: 'deprecated',
    },
});

const plugins = [
    sourcemaps(),
    resolve({
        browser: true,
        preferBuiltins: true,
    }),
    builtins(),
    commonjs({
        namedExports: {
            'resource-loader': ['Resource'],
            'pixi-gl-core': ['GLFramebuffer'], // TODO: remove pixi-gl-core
        },
    }),
    string({
        include: [
            'src/**/*.frag',
            'src/**/*.vert',
        ],
    }),
    replace({
        __VERSION__: pkg.version,
    }),
    preprocess({
        context: {
            DEV: !prod,
            DEVELOPMENT: !prod,
            PROD: prod,
            PRODUCTION: prod,
        },
    }),
    transpile(),
    thaw(),
];

if (prod)
{
    plugins.push(uglify({
        mangle: true,
        compress: true,
        output: {
            comments(node, comment)
            {
                const { value, type } = comment;

                return type === 'comment2' && value.indexOf(pkg.name) > -1;
            },
        },
    }, minify));
}

let outro = '';

if (deprecated)
{
    const buffer = fs.readFileSync(path.resolve(deprecated), 'utf8');

    outro = buble.transform(buffer).code;
}

const compiled = (new Date()).toUTCString().replace(/GMT/g, 'UTC');
const external = Object.keys(pkg.dependencies || []);
const sourcemap = true;
const name = 'PIXI';
const banner = `/*!
 * ${pkg.name} - v${pkg.version}
 * Compiled ${compiled}
 *
 * ${pkg.name} is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */\n`;

export default [
    {
        banner,
        outro,
        name,
        input,
        output: {
            file: pkg.main,
            format: bundle ? 'umd' : 'cjs',
        },
        external,
        sourcemap,
        plugins,
    },
    {
        banner,
        input,
        output: {
            file: pkg.module,
            format: 'es',
        },
        external,
        sourcemap,
        plugins,
    },
];
