import { Loader } from '@pixi/loaders';
import { Texture, ImageResource, SVGResource } from '@pixi/core';
import { TextureCache } from '@pixi/utils';
import { SCALE_MODES } from '@pixi/constants';
import { createServer } from './resources';

import { expect } from 'chai';

const createRandomName = () => `image${(Math.random() * 10000) | 0}`;

describe('Loader', function ()
{
    before(function ()
    {
        this.server = createServer(8125);
        this.baseUrl = 'http://localhost:8125';
    });

    after(function ()
    {
        this.server.close();
        this.server = null;
        this.baseUrl = null;
    });

    it('should exist', function ()
    {
        expect(Loader).to.be.a('function');
    });

    it('should have shared loader', function ()
    {
        expect(Loader.shared).to.not.be.undefined;
        expect(Loader.shared).to.be.instanceof(Loader);
    });

    it('should basic load an image using the TextureLoader', function (done)
    {
        const loader = new Loader();
        const name = createRandomName();
        const url = `${this.baseUrl}/bunny.png`;

        loader.add(name, url);
        loader.load((ldr, resources) =>
        {
            expect(ldr).equals(loader);
            expect(name in resources).to.be.ok;

            const { texture } = resources[name];

            expect(texture).instanceof(Texture);
            expect(texture.baseTexture.valid).to.be.true;
            expect(texture.baseTexture.resource).instanceof(ImageResource);
            expect(texture.baseTexture.resource.url).equals(url);
            expect(TextureCache[name]).equals(texture);
            expect(TextureCache[url]).equals(texture);
            loader.reset();
            texture.destroy(true);
            expect(loader.resources[name]).to.be.undefined;
            expect(TextureCache[name]).to.be.undefined;
            expect(TextureCache[url]).to.be.undefined;
            done();
        });
    });

    it('should basic load an SVG using the TextureLoader', function (done)
    {
        const loader = new Loader();
        const name = createRandomName();
        const url = `${this.baseUrl}/logo.svg`;

        loader.add(name, url);
        loader.load(() =>
        {
            const { texture, data } = loader.resources[name];
            const { baseTexture } = texture;

            expect(typeof data).equals('string');
            expect(baseTexture.resource).instanceof(SVGResource);
            expect(baseTexture.valid).to.be.true;
            expect(baseTexture.width).equals(512);
            expect(baseTexture.height).equals(512);
            loader.reset();
            texture.destroy(true);
            done();
        });
    });

    it('should allow setting baseTexture properties through metadata', function (done)
    {
        const loader = new Loader();
        const name = createRandomName();
        const options = {
            metadata: {
                scaleMode: SCALE_MODES.NEAREST,
                resolution: 2,
            },
        };

        loader.add(name, `${this.baseUrl}/bunny.png`, options).load(() =>
        {
            const { texture } = loader.resources[name];
            const { scaleMode, resolution } = texture.baseTexture;

            expect(scaleMode).equals(SCALE_MODES.NEAREST);
            expect(resolution).equals(2);
            loader.reset();
            texture.destroy(true);
            done();
        });
    });

    it('should allow setting SVG width/height through metadata', function (done)
    {
        const loader = new Loader();
        const name = createRandomName();
        const options = {
            metadata: {
                resourceOptions: {
                    width: 128,
                    height: 256,
                },
            },
        };

        loader.add(name, `${this.baseUrl}/logo.svg`, options).load(() =>
        {
            const { texture } = loader.resources[name];
            const { width, height } = texture.baseTexture;

            expect(width).equals(128);
            expect(height).equals(256);
            loader.reset();
            texture.destroy(true);
            done();
        });
    });

    it('should allow setting SVG scale through metadata', function (done)
    {
        const loader = new Loader();
        const name = createRandomName();
        const options = {
            metadata: {
                resourceOptions: {
                    scale: 0.5,
                },
            },
        };

        loader.add(name, `${this.baseUrl}/logo.svg`, options).load(() =>
        {
            const { texture } = loader.resources[name];
            const { width, height } = texture.baseTexture;

            expect(width).equals(256);
            expect(height).equals(256);
            loader.reset();
            texture.destroy(true);
            done();
        });
    });
});
