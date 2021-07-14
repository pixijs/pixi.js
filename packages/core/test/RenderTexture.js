const { Renderer, RenderTexture, Framebuffer, autoDetectRenderer } = require('../');
const { MSAA_QUALITY } = require('@pixi/constants');
const { Container } = require('@pixi/display');
const { Graphics } = require('@pixi/graphics');

describe('RenderTexture', function ()
{
    before(function ()
    {
        this.renderer = new Renderer();
    });

    after(function ()
    {
        this.renderer.destroy();
        this.renderer = null;
    });

    it('should destroy the depth texture too', function ()
    {
        const renderer = autoDetectRenderer();

        const renderTexture = RenderTexture.create({ width: 32, height: 32 });
        const framebuffer = renderTexture.framebuffer;

        framebuffer.enableDepth();
        framebuffer.addDepthTexture();

        const depthTexture = framebuffer.depthTexture;

        renderer.renderTexture.bind(renderTexture);

        expect(depthTexture._glTextures[renderer.CONTEXT_UID]).to.not.equal(undefined);
        renderTexture.destroy(true);
        expect(depthTexture._glTextures[renderer.CONTEXT_UID]).to.equal(undefined);
    });

    it('should render correctly with empty mask', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 1, height: 1 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.NONE;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 1, 1).endFill();

        const container = new Container();

        container.addChild(graphics);
        container.mask = container.addChild(new Graphics());

        this.renderer.render(container, { renderTexture, clear: true });

        this.renderer.renderTexture.bind(renderTexture);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(51);
        expect(pixel[1]).to.equal(51);
        expect(pixel[2]).to.equal(51);
        expect(pixel[3]).to.equal(51);
    });

    it('should render correctly with empty mask and multisampling', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 1, height: 1 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.HIGH;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 1, 1).endFill();

        const container = new Container();

        container.addChild(graphics);
        container.mask = container.addChild(new Graphics());

        this.renderer.render(container, { renderTexture, clear: true });
        this.renderer.framebuffer.blit();

        const textureFramebuffer = new Framebuffer(framebuffer.width, framebuffer.height);

        textureFramebuffer.addColorTexture(0, framebuffer.colorTextures[0]);

        this.renderer.framebuffer.bind(textureFramebuffer);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(51);
        expect(pixel[1]).to.equal(51);
        expect(pixel[2]).to.equal(51);
        expect(pixel[3]).to.equal(51);
    });

    it('should render correctly with mask', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 2, height: 2 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.NONE;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 2, 2).endFill();

        const container = new Container();

        container.addChild(graphics);
        container.mask = container.addChild(new Graphics());
        container.mask.beginFill(0xffffff).drawRect(0, 0, 1, 1).endFill();

        this.renderer.render(container, { renderTexture, clear: true });

        this.renderer.renderTexture.bind(renderTexture);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(0xff);
        expect(pixel[1]).to.equal(0xff);
        expect(pixel[2]).to.equal(0xff);
        expect(pixel[3]).to.equal(0xff);

        pixel.set([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(51);
        expect(pixel[1]).to.equal(51);
        expect(pixel[2]).to.equal(51);
        expect(pixel[3]).to.equal(51);
    });

    it('should render correctly with mask and multisampling', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 2, height: 2 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.HIGH;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 2, 2).endFill();

        const container = new Container();

        container.addChild(graphics);
        container.mask = container.addChild(new Graphics());
        container.mask.beginFill(0xffffff).drawRect(0, 0, 1, 1).endFill();

        this.renderer.render(container, { renderTexture, clear: true });
        this.renderer.framebuffer.blit();

        const textureFramebuffer = new Framebuffer(framebuffer.width, framebuffer.height);

        textureFramebuffer.addColorTexture(0, framebuffer.colorTextures[0]);

        this.renderer.framebuffer.bind(textureFramebuffer);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(0xff);
        expect(pixel[1]).to.equal(0xff);
        expect(pixel[2]).to.equal(0xff);
        expect(pixel[3]).to.equal(0xff);

        pixel.set([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(51);
        expect(pixel[1]).to.equal(51);
        expect(pixel[2]).to.equal(51);
        expect(pixel[3]).to.equal(51);
    });

    it('should resize framebuffer', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 1, height: 1 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.NONE;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 2, 2).endFill();

        this.renderer.render(graphics, { renderTexture, clear: true });

        renderTexture.resize(2, 2);

        this.renderer.render(graphics, { renderTexture, clear: true });

        this.renderer.renderTexture.bind(renderTexture);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(0xff);
        expect(pixel[1]).to.equal(0xff);
        expect(pixel[2]).to.equal(0xff);
        expect(pixel[3]).to.equal(0xff);
    });

    it('should resize multisampled framebuffer', function ()
    {
        const { gl } = this.renderer;

        const renderTexture = RenderTexture.create({ width: 1, height: 1 });

        renderTexture.baseTexture.clearColor = [0.2, 0.2, 0.2, 0.2];

        const framebuffer = renderTexture.framebuffer;

        framebuffer.multisample = MSAA_QUALITY.HIGH;

        const graphics = new Graphics();

        graphics.beginFill(0xffffff).drawRect(0, 0, 2, 2).endFill();

        this.renderer.render(graphics, { renderTexture, clear: true });
        this.renderer.framebuffer.blit();

        renderTexture.resize(2, 2);

        this.renderer.render(graphics, { renderTexture, clear: true });
        this.renderer.framebuffer.blit();

        const textureFramebuffer = new Framebuffer(framebuffer.width, framebuffer.height);

        textureFramebuffer.addColorTexture(0, framebuffer.colorTextures[0]);

        this.renderer.framebuffer.bind(textureFramebuffer);

        const pixel = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

        gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

        expect(pixel[0]).to.equal(0xff);
        expect(pixel[1]).to.equal(0xff);
        expect(pixel[2]).to.equal(0xff);
        expect(pixel[3]).to.equal(0xff);
    });
});
