/* eslint-disable @typescript-eslint/no-unused-expressions */
import sinon from 'sinon';
import { LoaderResource } from '@pixi/loaders';
import { expect } from 'chai';
import { fixtureData } from './fixtures/data';

describe('LoaderResource', () =>
{
    let request: any;
    let res: LoaderResource;
    let xhr: any;
    let clock: any;
    const name = 'test-resource';

    before(() =>
    {
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = (req: any) =>
        {
            request = req;
        };
        clock = sinon.useFakeTimers();
    });

    after(() =>
    {
        xhr.restore();
        clock.restore();
    });

    beforeEach(() =>
    {
        res = new LoaderResource(name, fixtureData.url);
        request = null;
    });

    it('should construct properly with only a URL passed', () =>
    {
        expect(res).to.have.property('name', name);
        expect(res).to.have.property('type', LoaderResource.TYPE.UNKNOWN);
        expect(res).to.have.property('url', fixtureData.url);
        expect(res).to.have.property('data', null);
        expect(res).to.have.property('crossOrigin', undefined);
        expect(res).to.have.property('loadType', LoaderResource.LOAD_TYPE.XHR);
        expect(res).to.have.property('xhrType', undefined);
        expect(res).to.have.property('metadata').that.is.eql({});
        expect(res).to.have.property('error', null);
        expect(res).to.have.property('xhr', null);

        expect(res).to.have.property('isDataUrl', false);
        expect(res).to.have.property('isComplete', false);
        expect(res).to.have.property('isLoading', false);
    });

    it('should construct properly with options passed', () =>
    {
        const meta = { some: 'thing' };
        const res = new LoaderResource(name, fixtureData.url, {
            crossOrigin: true,
            loadType: LoaderResource.LOAD_TYPE.IMAGE,
            xhrType: LoaderResource.XHR_RESPONSE_TYPE.BLOB,
            metadata: meta,
        });

        expect(res).to.have.property('name', name);
        expect(res).to.have.property('type', LoaderResource.TYPE.UNKNOWN);
        expect(res).to.have.property('url', fixtureData.url);
        expect(res).to.have.property('data', null);
        expect(res).to.have.property('crossOrigin', 'anonymous');
        expect(res).to.have.property('loadType', LoaderResource.LOAD_TYPE.IMAGE);
        expect(res).to.have.property('xhrType', LoaderResource.XHR_RESPONSE_TYPE.BLOB);
        expect(res).to.have.property('metadata', meta);
        expect(res).to.have.property('error', null);
        expect(res).to.have.property('xhr', null);

        expect(res).to.have.property('isDataUrl', false);
        expect(res).to.have.property('isComplete', false);
        expect(res).to.have.property('isLoading', false);
    });

    describe('#complete', () =>
    {
        it('should emit the `complete` event', () =>
        {
            const spy = sinon.spy();

            res.onComplete.add(spy);

            res.complete();

            expect(spy).to.have.been.calledWith(res);
        });

        it('should remove events from the data element', () =>
        {
            const data = {
                addEventListener: () => { /* empty */ },
                removeEventListener: () => { /* empty */ },
            };
            const mock = sinon.mock(data);

            mock.expects('removeEventListener').once().withArgs('error');
            mock.expects('removeEventListener').once().withArgs('load');
            mock.expects('removeEventListener').once().withArgs('progress');
            mock.expects('removeEventListener').once().withArgs('canplaythrough');

            res.data = data;
            res.complete();

            mock.verify();
        });

        it('should remove events from the xhr element', () =>
        {
            const data: any = {
                addEventListener: () => { /* empty */ },
                removeEventListener: () => { /* empty */ },
            };
            const mock = sinon.mock(data);

            mock.expects('removeEventListener').once().withArgs('error');
            mock.expects('removeEventListener').once().withArgs('timeout');
            mock.expects('removeEventListener').once().withArgs('abort');
            mock.expects('removeEventListener').once().withArgs('progress');
            mock.expects('removeEventListener').once().withArgs('load');

            res.xhr = data;
            res.complete();

            mock.verify();
        });
    });

    describe('#abort', () =>
    {
        it('should abort in-flight XHR requests', () =>
        {
            res.load();

            res.xhr.abort = sinon.spy();

            res.abort();

            expect(res.xhr.abort).to.have.been.calledOnce;
        });

        it('should abort in-flight XDR requests');

        it('should abort in-flight Image requests', () =>
        {
            res.data = new Image();
            res.data.src = fixtureData.url;

            expect(res.data.src).to.equal(fixtureData.url);

            res.abort();

            expect(res.data.src).to.equal(LoaderResource.EMPTY_GIF);
        });

        it('should abort in-flight Video requests', () =>
        {
            res.data = document.createElement('video');
            res.data.appendChild(document.createElement('source'));

            expect(res.data.firstChild).to.exist;

            res.abort();

            expect(res.data.firstChild).to.not.exist;
        });

        it('should abort in-flight Audio requests', () =>
        {
            res.data = document.createElement('audio');
            res.data.appendChild(document.createElement('source'));

            expect(res.data.firstChild).to.exist;

            res.abort();

            expect(res.data.firstChild).to.not.exist;
        });
    });

    describe('#load', () =>
    {
        it('should emit the start event', () =>
        {
            const spy = sinon.spy();

            res.onStart.add(spy);

            res.load();

            expect(request).to.exist;
            expect(spy).to.have.been.calledWith(res);
        });

        it('should emit the complete event', () =>
        {
            const spy = sinon.spy();

            res.onComplete.add(spy);

            res.load();

            request.respond(200, fixtureData.dataJsonHeaders, fixtureData.dataJson);

            expect(request).to.exist;
            expect(spy).to.have.been.calledWith(res);
        });

        it('should not load and emit a complete event if complete is called before load', () =>
        {
            const spy = sinon.spy();

            res.onComplete.add(spy);

            res.complete();
            res.load();

            expect(request).not.to.exist;
            expect(spy).to.have.been.calledWith(res);
        });

        it('should throw an error if complete is called twice', () =>
        {
            function fn()
            {
                res.complete();
            }

            expect(fn).to.not.throw(Error);
            expect(fn).to.throw(Error);
        });

        it('should load using a data url', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.dataUrlGif);

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('data').instanceOf(Image)
                    .and.is.an.instanceOf(HTMLImageElement)
                    .and.have.property('src', fixtureData.dataUrlGif);

                done();
            });

            res.load();
        });

        it('should load using a svg data url', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.dataUrlSvg);

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('data').instanceOf(Image)
                    .and.is.an.instanceOf(HTMLImageElement)
                    .and.have.property('src', fixtureData.dataUrlSvg);

                done();
            });

            res.load();
        });

        it('should load using XHR', (done) =>
        {
            res.onComplete.add(() =>
            {
                expect(res).to.have.property('data', fixtureData.dataJson);
                done();
            });

            res.load();

            expect(request).to.exist;

            request.respond(200, fixtureData.dataJsonHeaders, fixtureData.dataJson);
        });

        it('should load using Image', () =>
        {
            const res = new LoaderResource(name, fixtureData.url, { loadType: LoaderResource.LOAD_TYPE.IMAGE });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(Image)
                .and.is.an.instanceOf(HTMLImageElement)
                .and.have.property('src', fixtureData.url);
        });

        it('should load using Audio', () =>
        {
            const res = new LoaderResource(name, fixtureData.url, { loadType: LoaderResource.LOAD_TYPE.AUDIO });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(HTMLAudioElement);

            expect(res.data.children).to.have.length(1);
            expect(res.data.children[0]).to.have.property('src', fixtureData.url);
        });

        it('should load using Video', () =>
        {
            const res = new LoaderResource(name, fixtureData.url, { loadType: LoaderResource.LOAD_TYPE.VIDEO });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(HTMLVideoElement);

            expect(res.data.children).to.have.length(1);
            expect(res.data.children[0]).to.have.property('src', fixtureData.url);
        });

        it('should used the passed element for loading', () =>
        {
            const img = new Image();
            const spy = sinon.spy(img, 'addEventListener');
            const res = new LoaderResource(name, fixtureData.url, {
                loadType: LoaderResource.LOAD_TYPE.IMAGE,
                metadata: { loadElement: img },
            });

            res.load();

            expect(spy).to.have.been.calledThrice;
            expect(img).to.have.property('src', fixtureData.url);

            spy.restore();
        });

        it('should used the passed element for loading, and skip assigning src', () =>
        {
            const img = new Image();
            const spy = sinon.spy(img, 'addEventListener');
            const res = new LoaderResource(name, fixtureData.url, {
                loadType: LoaderResource.LOAD_TYPE.IMAGE,
                metadata: { loadElement: img, skipSource: true },
            });

            res.load();

            expect(spy).to.have.been.calledThrice;
            expect(img).to.have.property('src', '');

            spy.restore();
        });
    });

    describe('#load with timeout', () =>
    {
        it('should abort XHR loads', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.url, { loadType: LoaderResource.LOAD_TYPE.XHR, timeout: 100 });

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('error').instanceOf(Error);
                expect(res).to.have.property('data').equal(null);
                done();
            });

            res.load();

            expect(request).to.exist;
            request.triggerTimeout();
        });

        it('should abort Image loads', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.url,
                { loadType: LoaderResource.LOAD_TYPE.IMAGE, timeout: 1000 });

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('error').instanceOf(Error);

                expect(res).to.have.property('data').instanceOf(Image)
                    .and.is.an.instanceOf(HTMLImageElement)
                    .and.have.property('src', LoaderResource.EMPTY_GIF);
                done();
            });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(Image)
                .and.is.an.instanceOf(HTMLImageElement)
                .and.have.property('src', fixtureData.url);

            clock.tick(1100);
        });

        it('should abort Audio loads', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.url,
                { loadType: LoaderResource.LOAD_TYPE.AUDIO, timeout: 1000 });

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('error').instanceOf(Error);
                expect(res.data.children).to.have.length(0);
                done();
            });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(HTMLAudioElement);
            expect(res.data.children).to.have.length(1);
            expect(res.data.children[0]).to.have.property('src', fixtureData.url);

            clock.tick(1100);
        });

        it('should abort Video loads', (done) =>
        {
            const res = new LoaderResource(name, fixtureData.url,
                { loadType: LoaderResource.LOAD_TYPE.VIDEO, timeout: 1000 });

            res.onComplete.add(() =>
            {
                expect(res).to.have.property('error').instanceOf(Error);
                expect(res.data.children).to.have.length(0);
                done();
            });

            res.load();

            expect(request).to.not.exist;

            expect(res).to.have.property('data').instanceOf(HTMLVideoElement);
            expect(res.data.children).to.have.length(1);
            expect(res.data.children[0]).to.have.property('src', fixtureData.url);

            clock.tick(1100);
        });
    });

    describe('#load inside cordova', () =>
    {
        beforeEach(() =>
        {
            xhr.status = 0;
        });

        it('should load resource even if the status is 0', () =>
        {
            xhr.responseText = 'I am loaded resource';

            res.xhr = xhr;
            res._xhrOnLoad();

            expect(res.isComplete).to.equal(true);
        });

        it('should load resource with array buffer data', () =>
        {
            xhr.responseType = LoaderResource.XHR_RESPONSE_TYPE.BUFFER;

            res.xhr = xhr;
            res._xhrOnLoad();

            expect(res.isComplete).to.equal(true);
        });
    });

    describe('#_determineCrossOrigin', () =>
    {
        it('should properly detect same-origin requests (#1)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com',
                { hostname: 'google.com', port: '', protocol: 'https:' }
            )).to.equal('');
        });

        it('should properly detect same-origin requests (#2)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com:443',
                { hostname: 'google.com', port: '', protocol: 'https:' }
            )).to.equal('');
        });

        it('should properly detect same-origin requests (#3)', () =>
        {
            expect(res._determineCrossOrigin(
                'http://www.google.com:5678',
                { hostname: 'www.google.com', port: '5678', protocol: 'http:' }
            )).to.equal('');
        });

        it('should properly detect cross-origin requests (#1)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com',
                { hostname: 'google.com', port: '123', protocol: 'https:' }
            )).to.equal('anonymous');
        });

        it('should properly detect cross-origin requests (#2)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com',
                { hostname: 'google.com', port: '', protocol: 'http:' }
            )).to.equal('anonymous');
        });

        it('should properly detect cross-origin requests (#3)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com',
                { hostname: 'googles.com', port: '', protocol: 'https:' }
            )).to.equal('anonymous');
        });

        it('should properly detect cross-origin requests (#4)', () =>
        {
            expect(res._determineCrossOrigin(
                'https://google.com',
                { hostname: 'www.google.com', port: '123', protocol: 'https:' }
            )).to.equal('anonymous');
        });
        it('should properly detect cross-origin requests (#5) - sandboxed iframe', () =>
        {
            const originalOrigin = window.origin;

            // Set origin to 'null' to simulate sandboxed iframe without 'allow-same-origin' attribute
            (window as any).origin = 'null';
            expect(res._determineCrossOrigin(
                'http://www.google.com:5678',
                { hostname: 'www.google.com', port: '5678', protocol: 'http:' }
            )).to.equal('anonymous');
            // Restore origin to prevent test leakage.
            (window as any).origin = originalOrigin;
        });
    });

    describe('#_getExtension', () =>
    {
        it('should return the proper extension', () =>
        {
            res.url = 'http://www.google.com/image.png';
            expect(res._getExtension()).to.equal('png');

            res.url = 'http://domain.net/really/deep/path/that/goes/for/a/while/movie.wmv';
            expect(res._getExtension()).to.equal('wmv');

            res.url = 'http://somewhere.io/path.with.dots/and_a-bunch_of.symbols/data.txt';
            expect(res._getExtension()).to.equal('txt');

            res.url = 'http://nowhere.me/image.jpg?query=true&string=false&name=real';
            expect(res._getExtension()).to.equal('jpg');

            res.url = 'http://nowhere.me/image.jpeg?query=movie.wmv&file=data.json';
            expect(res._getExtension()).to.equal('jpeg');

            res.url = 'http://nowhere.me/image.jpeg?query=movie.wmv&file=data.json';
            expect(res._getExtension()).to.equal('jpeg');

            res.url = 'http://nowhere.me/image.jpeg?query=movie.wmv&file=data.json#/derp.mp3';
            expect(res._getExtension()).to.equal('jpeg');

            res.url = 'http://nowhere.me/image.jpeg?query=movie.wmv&file=data.json#/derp.mp3&?me=two';
            expect(res._getExtension()).to.equal('jpeg');

            res.url = 'http://nowhere.me/image.jpeg#nothing-to-see-here?query=movie.wmv&file=data.json#/derp.mp3&?me=two'; // eslint-disable-line max-len
            expect(res._getExtension()).to.equal('jpeg');

            res._setFlag(LoaderResource.STATUS_FLAGS.DATA_URL, true);
            res.url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAMSURBVBhXY2BgYAAAAAQAAVzN/2kAAAAASUVORK5CYII='; // eslint-disable-line max-len
            expect(res._getExtension()).to.equal('png');
        });
    });

    describe('#_createSource', () =>
    {
        it('Should return the correct src url', () =>
        {
            res.url = 'http://www.google.com/audio.mp3';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://domain.net/really/deep/path/that/goes/for/a/while/movie.wmv';
            expect(res._createSource('video', res.url)).to.have.property('src', res.url);

            res.url = 'http://somewhere.io/path.with.dots/and_a-bunch_of.symbols/audio.mp3';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://nowhere.me/audio.mp3?query=true&string=false&name=real';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json#/derp.mp3&?me=two';
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res.url = 'http://nowhere.me/audio.mp3#nothing-to-see-here?query=movie.wmv&file=data.json#/derp.mp3&?me=two'; // eslint-disable-line max-len
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);

            res._setFlag(LoaderResource.STATUS_FLAGS.DATA_URL, true);
            res.url = 'data:audio/wave;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='; // eslint-disable-line max-len
            expect(res._createSource('audio', res.url)).to.have.property('src', res.url);
        });

        it('Should correctly auto-detect the mime type', () =>
        {
            res.url = 'http://www.google.com/audio.mp3';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://domain.net/really/deep/path/that/goes/for/a/while/movie.wmv';
            expect(res._createSource('video', res.url)).to.have.property('type', 'video/wmv');

            res.url = 'http://somewhere.io/path.with.dots/and_a-bunch_of.symbols/audio.mp3';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://nowhere.me/audio.mp3?query=true&string=false&name=real';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://nowhere.me/audio.mp3?query=movie.wmv&file=data.json#/derp.mp3&?me=two';
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res.url = 'http://nowhere.me/audio.mp3#nothing-to-see-here?query=movie.wmv&file=data.json#/derp.mp3&?me=two'; // eslint-disable-line max-len
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/mp3');

            res._setFlag(LoaderResource.STATUS_FLAGS.DATA_URL, true);
            res.url = 'data:audio/wave;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA=='; // eslint-disable-line max-len
            expect(res._createSource('audio', res.url)).to.have.property('type', 'audio/wave');
        });
    });
});
