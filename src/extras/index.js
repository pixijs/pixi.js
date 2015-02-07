'use strict';
/**
 * @file        Main export of the PIXI extras library
 * @author      Mat Groves <mat@goodboydigital.com>
 * @copyright   2013-2015 GoodBoyDigital
 * @license     {@link https://github.com/GoodBoyDigital/pixi.js/blob/master/LICENSE|MIT License}
 */

/**
 * @namespace PIXI
 */
module.exports = {
    MovieClip:      require('./MovieClip'),
    Rope:           require('./Rope'),
    Strip:          require('./Strip'),
    StripShader:    require('./StripShader'),
    TilingSprite:   require('./TilingSprite')
};

// activate the cachAsBitmap
var cacheAsBitmap = require('./cacheAsBitmap');
