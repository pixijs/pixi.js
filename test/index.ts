import path from 'path';
import { execFileSync } from 'child_process';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import fs from 'fs';
import type { FlossOptions } from 'floss';
import type { PackageResult } from './packages';

// Support for global otpions
declare global {
    let options: FlossOptions;
}

// Support for the tsconfig path aliasing
import 'tsconfig-paths/register';

// We only need to do this one time
chai.use(sinonChai);

const requireAsStrings = (module, filename) =>
{
    module.exports = fs.readFileSync(filename, 'utf8');
};

// Handle fragment and vertex files as strings
require.extensions['.frag'] = requireAsStrings;
require.extensions['.vert'] = requireAsStrings;

// Synchronously generate the list of testable packages
const script = path.join(__dirname, './packages.ts');

const isWin = (/^win/).test(process.platform);
const cmd = `ts-node-transpile-only${isWin ? '.cmd' : ''}`;
const packagesBuffer = execFileSync(cmd, [script]).toString();
const packages = JSON.parse(packagesBuffer) as PackageResult[];

// Filter any packages from the commandline options
const onlyPackages = options.args
    .filter((arg) => arg.startsWith('--package='))
    .map((arg) => arg.replace('--package=', ''));

// Filter the tests in case we have options to narrow scope
const scopedPackages = !onlyPackages.length ? packages
    : packages.filter((pkg) => onlyPackages.some((name) => pkg.name === name));

// Ignore packages without tests suites
const availableSuites = scopedPackages.filter((pkg) => pkg.available);

if (!availableSuites.length)
{
    // Find any invalid package names
    const invalidNames = onlyPackages.filter((name) => !packages.some((pkg) => pkg.name === name));

    // eslint-disable-next-line no-console
    console.log(`WARNING: Invalid package name${invalidNames.length > 1 ? 's' : ''}:`, `"${invalidNames.join('", "')}"`);
}

for (const pkg of availableSuites)
{
    describe(pkg.name, () =>
    {
        fs.readdirSync(pkg.tests)
            .filter((file) => file.endsWith('.tests.ts'))
            .map((file) => path.join(pkg.tests, file))
            // eslint-disable-next-line global-require
            .forEach((file) => require(file));
    });
}
