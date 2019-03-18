import path from 'path';
import transpile from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import string from 'rollup-plugin-string';
import sourcemaps from 'rollup-plugin-sourcemaps';
import minimist from 'minimist';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import batchPackages from '@lerna/batch-packages';
import filterPackages from '@lerna/filter-packages';
import { getPackages } from '@lerna/project';
import repo from './lerna.json';

/**
 * Get a list of the non-private sorted packages with Lerna v3
 * @see https://github.com/lerna/lerna/issues/1848
 * @return {Promise<Package[]>} List of packages
 */
async function getSortedPackages(scope, ignore)
{
    const packages = await getPackages(__dirname);
    const filtered = filterPackages(
        packages,
        scope,
        ignore,
        false
    );

    return batchPackages(filtered)
        .reduce((arr, batch) => arr.concat(batch), []);
}

async function main()
{
    const plugins = [
        sourcemaps(),
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs({
            namedExports: {
                'resource-loader': ['Resource'],
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

    const compiled = (new Date()).toUTCString().replace(/GMT/g, 'UTC');
    const sourcemap = true;
    const results = [];

    // Support --scope and --ignore globs if passed in via commandline
    const { scope, ignore } = minimist(process.argv.slice(2));
    const packages = await getSortedPackages(scope, ignore);

    const namespaces = {};
    const pkgData = {};

    // Create a map of globals to use for bundled packages
    packages.forEach((pkg) =>
    {
        const data = pkg.toJSON();

        pkgData[pkg.name] = data;
        namespaces[pkg.name] = data.namespace || 'PIXI';
    });

    packages.forEach((pkg) =>
    {
        let banner = [
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
        const {
            main,
            module,
            bundle,
            bundleInput,
            bundleOutput,
            namespaceInject,
            namespaceCreate,
            standalone } = pkgData[pkg.name];
        const freeze = false;

        results.push({
            input,
            output: [
                {
                    banner,
                    file: path.join(basePath, main),
                    format: 'cjs',
                    freeze,
                    sourcemap,
                },
                {
                    banner,
                    file: path.join(basePath, module),
                    format: 'esm',
                    freeze,
                    sourcemap,
                },
            ],
            external,
            plugins,
        });

        // The package.json file has a bundle field
        // we'll use this to generate the bundle file
        // this will package all dependencies
        if (bundle)
        {
            const external = standalone ? null : Object.keys(namespaces);
            const globals = standalone ? null : namespaces;
            let name; let
                footer;

            if (namespaceInject)
            {
                const ns = namespaces[pkg.name];

                if (ns.includes('.'))
                {
                    const base = ns.split('.')[0];

                    banner += `\nthis.${base} = this.${base} || {};`;
                }

                banner += `\nthis.${ns} = this.${ns} || {};`;
                name = pkg.name.replace(/[^a-z]+/g, '_');
                footer = `Object.assign(this.${ns}, ${name});`;
            }
            else if (namespaceCreate)
            {
                name = namespaces[pkg.name];
            }

            results.push({
                input: path.join(basePath, bundleInput || 'src/index.js'),
                external,
                output: Object.assign({
                    banner,
                    file: path.join(basePath, bundle),
                    format: 'iife',
                    freeze,
                    globals,
                    name,
                    footer,
                    sourcemap,
                }, bundleOutput),
                treeshake: false,
                plugins,
            });
        }
    });

    return results;
}

export default main();
