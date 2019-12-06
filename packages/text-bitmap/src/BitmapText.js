import { Texture } from '@pixi/core';
import { Container } from '@pixi/display';
import { ObservablePoint, Point, Rectangle } from '@pixi/math';
import { settings } from '@pixi/settings';
import { Sprite } from '@pixi/sprite';
import { removeItems, getResolutionOfUrl } from '@pixi/utils';

/**
 * A BitmapText object will create a line or multiple lines of text using bitmap font.
 *
 * The primary advantage of this class over Text is that all of your textures are pre-generated and loading,
 * meaning that rendering is fast, and changing text has no performance implications.
 *
 * The primary disadvantage is that you need to preload the bitmap font assets, and thus the styling is set in stone.
 * Supporting character sets other than latin, such as CJK languages, may be impractical due to the number of characters.
 *
 * To split a line you can use '\n', '\r' or '\r\n' in your string.
 *
 * You can generate the fnt files using
 * http://www.angelcode.com/products/bmfont/ for Windows or
 * http://www.bmglyph.com/ for Mac.
 *
 * A BitmapText can only be created when the font is loaded.
 *
 * ```js
 * // in this case the font is in a file called 'desyrel.fnt'
 * let bitmapText = new PIXI.BitmapText("text using a fancy font!", {font: "35px Desyrel", align: "right"});
 * ```
 *
 * @class
 * @extends PIXI.Container
 * @memberof PIXI
 */
export class BitmapText extends Container
{
    /**
     * @param {string} text - A string that you would like the text to display.
     * @param {object} style - The style parameters.
     * @param {string|object} style.font - The font descriptor for the object, can be passed as a string of form
     *      "24px FontName" or "FontName" or as an object with explicit name/size properties.
     * @param {string} [style.font.name] - The bitmap font id.
     * @param {number} [style.font.size] - The size of the font in pixels, e.g. 24
     * @param {string} [style.align='left'] - Alignment for multiline text ('left', 'center' or 'right'), does not affect
     *      single line text.
     * @param {number} [style.tint=0xFFFFFF] - The tint color.
     */
    constructor(text, style = {})
    {
        super();

        /**
         * Private tracker for the width of the overall text
         *
         * @member {number}
         * @private
         */
        this._textWidth = 0;

        /**
         * Private tracker for the height of the overall text
         *
         * @member {number}
         * @private
         */
        this._textHeight = 0;

        /**
         * Private tracker for the letter sprite pool.
         *
         * @member {PIXI.Sprite[]}
         * @private
         */
        this._glyphs = [];

        /**
         * Private tracker for the current style.
         *
         * @member {object}
         * @private
         */
        this._font = {
            tint: style.tint !== undefined ? style.tint : 0xFFFFFF,
            align: style.align || 'left',
            name: null,
            size: 0,
        };

        /**
         * Private tracker for the current font.
         *
         * @member {object}
         * @private
         */
        this.font = style.font; // run font setter

        /**
         * Private tracker for the current text.
         *
         * @member {string}
         * @private
         */
        this._text = text;

        /**
         * The max width of this bitmap text in pixels. If the text provided is longer than the
         * value provided, line breaks will be automatically inserted in the last whitespace.
         * Disable by setting value to 0
         *
         * @member {number}
         * @private
         */
        this._maxWidth = 0;

        /**
         * The max line height. This is useful when trying to use the total height of the Text,
         * ie: when trying to vertically align.
         *
         * @member {number}
         * @private
         */
        this._maxLineHeight = 0;

        /**
         * Letter spacing. This is useful for setting the space between characters.
         * @member {number}
         * @private
         */
        this._letterSpacing = 0;

        /**
         * Text anchor. read-only
         *
         * @member {PIXI.ObservablePoint}
         * @private
         */
        this._anchor = new ObservablePoint(() => { this.dirty = true; }, this, 0, 0);

        /**
         * The dirty state of this object.
         *
         * @member {boolean}
         */
        this.dirty = false;

        /**
         * If true PixiJS will Math.floor() x/y values when rendering, stopping pixel interpolation.
         * Advantages can include sharper image quality (like text) and faster rendering on canvas.
         * The main disadvantage is movement of objects may appear less smooth.
         * To set the global default, change {@link PIXI.settings.ROUND_PIXELS}
         *
         * @member {boolean}
         * @default false
         */
        this.roundPixels = settings.ROUND_PIXELS;

        this.updateText();
    }

    /**
     * Renders text and updates it when needed
     *
     * @private
     */
    updateText()
    {
        const data = BitmapText.fonts[this._font.name];
        const scale = this._font.size / data.size;
        const pos = new Point();
        const chars = [];
        const lineWidths = [];
        const text = this._text.replace(/(?:\r\n|\r)/g, '\n') || ' ';
        const textLength = text.length;
        const maxWidth = this._maxWidth * data.size / this._font.size;

        let prevCharCode = null;
        let lastLineWidth = 0;
        let maxLineWidth = 0;
        let line = 0;
        let lastBreakPos = -1;
        let lastBreakWidth = 0;
        let spacesRemoved = 0;
        let maxLineHeight = 0;

        for (let i = 0; i < textLength; i++)
        {
            const charCode = text.charCodeAt(i);
            const char = text.charAt(i);

            if ((/(?:\s)/).test(char))
            {
                lastBreakPos = i;
                lastBreakWidth = lastLineWidth;
            }

            if (char === '\r' || char === '\n')
            {
                lineWidths.push(lastLineWidth);
                maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
                ++line;
                ++spacesRemoved;

                pos.x = 0;
                pos.y += data.lineHeight;
                prevCharCode = null;
                continue;
            }

            const charData = data.chars[charCode];

            if (!charData)
            {
                continue;
            }

            if (prevCharCode && charData.kerning[prevCharCode])
            {
                pos.x += charData.kerning[prevCharCode];
            }

            chars.push({
                texture: charData.texture,
                line,
                charCode,
                position: new Point(pos.x + charData.xOffset + (this._letterSpacing / 2), pos.y + charData.yOffset),
            });
            pos.x += charData.xAdvance + this._letterSpacing;
            lastLineWidth = pos.x;
            maxLineHeight = Math.max(maxLineHeight, (charData.yOffset + charData.texture.height));
            prevCharCode = charCode;

            if (lastBreakPos !== -1 && maxWidth > 0 && pos.x > maxWidth)
            {
                ++spacesRemoved;
                removeItems(chars, 1 + lastBreakPos - spacesRemoved, 1 + i - lastBreakPos);
                i = lastBreakPos;
                lastBreakPos = -1;

                lineWidths.push(lastBreakWidth);
                maxLineWidth = Math.max(maxLineWidth, lastBreakWidth);
                line++;

                pos.x = 0;
                pos.y += data.lineHeight;
                prevCharCode = null;
            }
        }

        const lastChar = text.charAt(text.length - 1);

        if (lastChar !== '\r' && lastChar !== '\n')
        {
            if ((/(?:\s)/).test(lastChar))
            {
                lastLineWidth = lastBreakWidth;
            }

            lineWidths.push(lastLineWidth);
            maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
        }

        const lineAlignOffsets = [];

        for (let i = 0; i <= line; i++)
        {
            let alignOffset = 0;

            if (this._font.align === 'right')
            {
                alignOffset = maxLineWidth - lineWidths[i];
            }
            else if (this._font.align === 'center')
            {
                alignOffset = (maxLineWidth - lineWidths[i]) / 2;
            }

            lineAlignOffsets.push(alignOffset);
        }

        const lenChars = chars.length;
        const tint = this.tint;

        for (let i = 0; i < lenChars; i++)
        {
            let c = this._glyphs[i]; // get the next glyph sprite

            if (c)
            {
                c.texture = chars[i].texture;
            }
            else
            {
                c = new Sprite(chars[i].texture);
                c.roundPixels = this.roundPixels;
                this._glyphs.push(c);
            }

            c.position.x = (chars[i].position.x + lineAlignOffsets[chars[i].line]) * scale;
            c.position.y = chars[i].position.y * scale;
            c.scale.x = c.scale.y = scale;
            c.tint = tint;

            if (!c.parent)
            {
                this.addChild(c);
            }
        }

        // remove unnecessary children.
        for (let i = lenChars; i < this._glyphs.length; ++i)
        {
            this.removeChild(this._glyphs[i]);
        }

        this._textWidth = maxLineWidth * scale;
        this._textHeight = (pos.y + data.lineHeight) * scale;

        // apply anchor
        if (this.anchor.x !== 0 || this.anchor.y !== 0)
        {
            for (let i = 0; i < lenChars; i++)
            {
                this._glyphs[i].x -= this._textWidth * this.anchor.x;
                this._glyphs[i].y -= this._textHeight * this.anchor.y;
            }
        }
        this._maxLineHeight = maxLineHeight * scale;
    }

    /**
     * Updates the transform of this object
     *
     * @private
     */
    updateTransform()
    {
        this.validate();
        this.containerUpdateTransform();
    }

    /**
     * Validates text before calling parent's getLocalBounds
     *
     * @return {PIXI.Rectangle} The rectangular bounding area
     */
    getLocalBounds()
    {
        this.validate();

        return super.getLocalBounds();
    }

    /**
     * Updates text when needed
     *
     * @private
     */
    validate()
    {
        if (this.dirty)
        {
            this.updateText();
            this.dirty = false;
        }
    }

    /**
     * The tint of the BitmapText object.
     *
     * @member {number}
     */
    get tint()
    {
        return this._font.tint;
    }

    set tint(value) // eslint-disable-line require-jsdoc
    {
        this._font.tint = (typeof value === 'number' && value >= 0) ? value : 0xFFFFFF;

        this.dirty = true;
    }

    /**
     * The alignment of the BitmapText object.
     *
     * @member {string}
     * @default 'left'
     */
    get align()
    {
        return this._font.align;
    }

    set align(value) // eslint-disable-line require-jsdoc
    {
        this._font.align = value || 'left';

        this.dirty = true;
    }

    /**
     * The anchor sets the origin point of the text.
     *
     * The default is `(0,0)`, this means the text's origin is the top left.
     *
     * Setting the anchor to `(0.5,0.5)` means the text's origin is centered.
     *
     * Setting the anchor to `(1,1)` would mean the text's origin point will be the bottom right corner.
     *
     * @member {PIXI.Point | number}
     */
    get anchor()
    {
        return this._anchor;
    }

    set anchor(value) // eslint-disable-line require-jsdoc
    {
        if (typeof value === 'number')
        {
            this._anchor.set(value);
        }
        else
        {
            this._anchor.copyFrom(value);
        }
    }

    /**
     * The font descriptor of the BitmapText object.
     *
     * @member {object}
     */
    get font()
    {
        return this._font;
    }

    set font(value) // eslint-disable-line require-jsdoc
    {
        if (!value)
        {
            return;
        }

        if (typeof value === 'string')
        {
            value = value.split(' ');

            this._font.name = value.length === 1 ? value[0] : value.slice(1).join(' ');
            this._font.size = value.length >= 2 ? parseInt(value[0], 10) : BitmapText.fonts[this._font.name].size;
        }
        else
        {
            this._font.name = value.name;
            this._font.size = typeof value.size === 'number' ? value.size : parseInt(value.size, 10);
        }

        this.dirty = true;
    }

    /**
     * The text of the BitmapText object.
     *
     * @member {string}
     */
    get text()
    {
        return this._text;
    }

    set text(text) // eslint-disable-line require-jsdoc
    {
        text = String(text === null || text === undefined ? '' : text);

        if (this._text === text)
        {
            return;
        }
        this._text = text;
        this.dirty = true;
    }

    /**
     * The max width of this bitmap text in pixels. If the text provided is longer than the
     * value provided, line breaks will be automatically inserted in the last whitespace.
     * Disable by setting the value to 0.
     *
     * @member {number}
     */
    get maxWidth()
    {
        return this._maxWidth;
    }

    set maxWidth(value) // eslint-disable-line require-jsdoc
    {
        if (this._maxWidth === value)
        {
            return;
        }
        this._maxWidth = value;
        this.dirty = true;
    }

    /**
     * The max line height. This is useful when trying to use the total height of the Text,
     * i.e. when trying to vertically align.
     *
     * @member {number}
     * @readonly
     */
    get maxLineHeight()
    {
        this.validate();

        return this._maxLineHeight;
    }

    /**
     * The width of the overall text, different from fontSize,
     * which is defined in the style object.
     *
     * @member {number}
     * @readonly
     */
    get textWidth()
    {
        this.validate();

        return this._textWidth;
    }

    /**
     * Additional space between characters.
     *
     * @member {number}
     */
    get letterSpacing()
    {
        return this._letterSpacing;
    }

    set letterSpacing(value) // eslint-disable-line require-jsdoc
    {
        if (this._letterSpacing !== value)
        {
            this._letterSpacing = value;
            this.dirty = true;
        }
    }

    /**
     * The height of the overall text, different from fontSize,
     * which is defined in the style object.
     *
     * @member {number}
     * @readonly
     */
    get textHeight()
    {
        this.validate();

        return this._textHeight;
    }

    /**
     * Register a bitmap font with data and a texture.
     *
     * @static
     * @param {XMLDocument|string} data - The characters map that could be provided as xml or raw string.
     * @param {Object.<string, PIXI.Texture>|PIXI.Texture|PIXI.Texture[]} textures - List of textures for each page.
     * @return {Object} Result font object with font, size, lineHeight and char fields.
     */
    static registerFont(data, textures)
    {
        if (data instanceof XMLDocument)
        {
            return BitmapText.registerFontXml(data, textures);
        }
        else if (typeof data === 'object')
        {
            return BitmapText.registerFontObj(data, textures);
        }
        else
        {
            throw new Error('Unrecognized data format for bitmap font.');
        }
    }

    /**
     * Register a bitmap font using font data object and a texture.
     *
     * @static
     * @param {Object} obj - The font data object.
     * @param {Object.<string, PIXI.Texture>|PIXI.Texture|PIXI.Texture[]} textures - List of textures for each page.
     * @return {Object} Result font object with font, size, lineHeight and char fields.
     */
    static registerFontObj(obj, textures)
    {
        const data = {};
        const info = obj['info'][0];
        const common = obj['common'][0];
        const pages = obj['page'];
        const res = getResolutionOfUrl(pages[0]['file'], settings.RESOLUTION);
        const pagesTextures = {};

        data.font = info['face'];
        data.size = parseInt(info['size'], 10);
        data.lineHeight = parseInt(common['lineHeight'], 10) / res;
        data.chars = {};

        // Single texture, convert to list
        if (textures instanceof Texture)
        {
            textures = [textures];
        }

        // Convert the input Texture, Textures or object
        // into a page Texture lookup by "id"
        for (let i = 0; i < pages.length; i++)
        {
            const id = pages[i]['id'];
            const file = pages[i]['file'];

            pagesTextures[id] = textures instanceof Array ? textures[i] : textures[file];
        }

        // parse letters
        const letters = obj['char'];

        for (let i = 0; i < letters.length; i++)
        {
            const letter = letters[i];
            const charCode = parseInt(letter['id'], 10);
            const page = letter['page'] || 0;
            const textureRect = new Rectangle(
                (parseInt(letter['x'], 10) / res) + (pagesTextures[page].frame.x / res),
                (parseInt(letter['y'], 10) / res) + (pagesTextures[page].frame.y / res),
                parseInt(letter['width'], 10) / res,
                parseInt(letter['height'], 10) / res
            );

            data.chars[charCode] = {
                xOffset: parseInt(letter['xoffset'], 10) / res,
                yOffset: parseInt(letter['yoffset'], 10) / res,
                xAdvance: parseInt(letter['xadvance'], 10) / res,
                kerning: {},
                texture: new Texture(pagesTextures[page].baseTexture, textureRect),
                page,
            };
        }

        // parse kernings
        const kernings = obj['kerning'] || [];

        for (let i = 0; i < kernings.length; i++)
        {
            const kerning = kernings[i];
            const first = parseInt(kerning['first'], 10) / res;
            const second = parseInt(kerning['second'], 10) / res;
            const amount = parseInt(kerning['amount'], 10) / res;

            if (data.chars[second])
            {
                data.chars[second].kerning[first] = amount;
            }
        }

        // I'm leaving this as a temporary fix so we can test the bitmap fonts in v3
        // but it's very likely to change
        BitmapText.fonts[data.font] = data;

        return data;
    }

    /**
     * Register a bitmap font with xml data and a texture.
     *
     * @static
     * @param {XMLDocument} xml - The XML document data.
     * @param {Object.<string, PIXI.Texture>|PIXI.Texture|PIXI.Texture[]} textures - List of textures for each page.
     *  If providing an object, the key is the `<page>` element's `file` attribute in the FNT file.
     * @return {Object} Result font object with font, size, lineHeight and char fields.
     */
    static registerFontXml(xml, textures)
    {
        const data = {};
        const info = xml.getElementsByTagName('info')[0];
        const common = xml.getElementsByTagName('common')[0];
        const pages = xml.getElementsByTagName('page');
        const res = getResolutionOfUrl(pages[0].getAttribute('file'), settings.RESOLUTION);
        const pagesTextures = {};

        data.font = info.getAttribute('face');
        data.size = parseInt(info.getAttribute('size'), 10);
        data.lineHeight = parseInt(common.getAttribute('lineHeight'), 10) / res;
        data.chars = {};

        // Single texture, convert to list
        if (textures instanceof Texture)
        {
            textures = [textures];
        }

        // Convert the input Texture, Textures or object
        // into a page Texture lookup by "id"
        for (let i = 0; i < pages.length; i++)
        {
            const id = pages[i].getAttribute('id');
            const file = pages[i].getAttribute('file');

            pagesTextures[id] = textures instanceof Array ? textures[i] : textures[file];
        }

        // parse letters
        const letters = xml.getElementsByTagName('char');

        for (let i = 0; i < letters.length; i++)
        {
            const letter = letters[i];
            const charCode = parseInt(letter.getAttribute('id'), 10);
            const page = letter.getAttribute('page') || 0;
            const textureRect = new Rectangle(
                (parseInt(letter.getAttribute('x'), 10) / res) + (pagesTextures[page].frame.x / res),
                (parseInt(letter.getAttribute('y'), 10) / res) + (pagesTextures[page].frame.y / res),
                parseInt(letter.getAttribute('width'), 10) / res,
                parseInt(letter.getAttribute('height'), 10) / res
            );

            data.chars[charCode] = {
                xOffset: parseInt(letter.getAttribute('xoffset'), 10) / res,
                yOffset: parseInt(letter.getAttribute('yoffset'), 10) / res,
                xAdvance: parseInt(letter.getAttribute('xadvance'), 10) / res,
                kerning: {},
                texture: new Texture(pagesTextures[page].baseTexture, textureRect),
                page,
            };
        }

        // parse kernings
        const kernings = xml.getElementsByTagName('kerning');

        for (let i = 0; i < kernings.length; i++)
        {
            const kerning = kernings[i];
            const first = parseInt(kerning.getAttribute('first'), 10) / res;
            const second = parseInt(kerning.getAttribute('second'), 10) / res;
            const amount = parseInt(kerning.getAttribute('amount'), 10) / res;

            if (data.chars[second])
            {
                data.chars[second].kerning[first] = amount;
            }
        }

        // I'm leaving this as a temporary fix so we can test the bitmap fonts in v3
        // but it's very likely to change
        BitmapText.fonts[data.font] = data;

        return data;
    }
}

BitmapText.fonts = {};
