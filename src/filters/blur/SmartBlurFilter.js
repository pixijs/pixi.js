var core = require('../../core');
// @see https://github.com/substack/brfs/issues/25
var fs = require('fs');

/**
 * A Smart Blur Filter.
 *
 * @class
 * @extends PIXI.AbstractFilter
 * @memberof PIXI.filters
 */
function SmartBlurFilter()
{
    core.AbstractFilter.call(this,
        // vertex shader
        null,
        // fragment shader
        fs.readFileSync(__dirname + '/smartBlur.frag', 'utf8'),
        // uniforms
        {
          delta: { type: 'v2', value: { x: 0.1, y: 0.0 } }
        }
    );
}

module.exports = core.AbstractFilter.extend(SmartBlurFilter);
