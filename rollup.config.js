import PackageUtilities from 'lerna/lib/PackageUtilities';
import Repository from 'lerna/lib/Repository';
import path from 'path';
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

// Support --scope and --ignore globs
const args = minimist(process.argv.slice(2), {
    boolean: ['prod', 'bundles'],
    default: {
        prod: false,
        bundles: true,
    },
    alias: {
        p: 'prod',
        b: 'bundles',
    },
});

// Standard Lerna plumbing getting packages
const repo = new Repository(__dirname);
const packages = PackageUtilities.getPackages(repo);
const filtered = PackageUtilities.filterPackages(packages, args);
const sorted = PackageUtilities.topologicallyBatchPackages(filtered);

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
            'pixi-gl-core': ['GLFramebuffer', 'GLShader', 'GLBuffer'], // TODO: remove pixi-gl-core
        },
    }),
    string({
        include: [
            '**/*.frag',
            '**/*.vert',
        ],
    }),
    replace({
        __VERSION__: repo.version,
    }),
    transpile(),
];

if (args.prod)
{
    plugins.push(uglify({
        mangle: true,
        compress: true,
        output: {
            comments(node, comment)
            {
                return comment.line === 1;
            },
        },
    }, minify));
}

const compiled = (new Date()).toUTCString().replace(/GMT/g, 'UTC');
const sourcemap = true;
const results = [];

sorted.forEach((group) =>
{
    group.forEach((pkg) =>
    {
        if (pkg.isPrivate())
        {
            return;
        }
        const banner = [
            `/*!`,
            ` * ${pkg.name} - v${pkg.version}`,
            ` * Compiled ${compiled}`,
            ` *`,
            ` * ${pkg.name} is licensed under the MIT License.`,
            ` * http://www.opensource.org/licenses/mit-license`,
            ` */`,
        ].join('\n');

        // Check for bundle folder
        const external = Object.keys(pkg.dependencies || []);
        const basePath = path.relative(__dirname, pkg.location);
        const input = path.join(basePath, 'src/index.js');
        const { main, module, bundle } = pkg._package;
        const freeze = false;

        results.push({
            banner,
            input,
            freeze,
            output: [
                {
                    file: path.join(basePath, main),
                    format: 'cjs',
                },
                {
                    file: path.join(basePath, module),
                    format: 'es',
                },
            ],
            external,
            sourcemap,
            plugins,
        });

        // The package.json file has a bundle field
        // we'll use this to generate the bundle file
        // this will package all dependencies
        if (args.bundles && bundle)
        {
            results.push({
                banner,
                input,
                freeze,
                output: {
                    file: path.join(basePath, bundle),
                    format: 'umd',
                },
                name: 'PIXI',
                treeshake: false,
                sourcemap,
                plugins,
            });
        }
    });
});

export default results;
