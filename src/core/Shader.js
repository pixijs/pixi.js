import { GLShader } from 'pixi-gl-core';
import settings from './settings';

function checkPrecision(src)
{
    if (src instanceof Array)
    {
        if (src[0].substring(0, 9) !== 'precision')
        {
            const copy = src.slice(0);

            copy.unshift(`precision ${settings.PRECISION} float;`);

            return copy;
        }
    }
    else if (src.substring(0, 9) !== 'precision')
    {
        return `precision ${settings.PRECISION} float;\n${src}`;
    }

    return src;
}

/**
 * Wrapper class, webGL Shader for Pixi.
 * Adds precision string if vertexSrc or fragmentSrc have no mention of it.
 *
 * @class
 * @extends GLShader
 * @memberof PIXI
 */
export default class Shader extends GLShader
{
    /* eslint-disable max-len */

    /**
     *
     * @param {WebGLRenderingContext} gl - The current WebGL rendering context.
     * @param {string|string[]} vertexSrc - The vertex shader source as an array of strings.
     * @param {string|string[]} fragmentSrc - The fragment shader source as an array of strings.
     * @param {string} precision - The float precision of the shader. Options are 'lowp', 'mediump' or 'highp'.
     * @param {object} attributeLocations - A key value pair showing which location eact attribute should sit, e.g. {position:0, uvs:1}.
     */
    constructor(gl, vertexSrc, fragmentSrc, precision, attributeLocations)
    {
        super(gl, checkPrecision(vertexSrc), checkPrecision(fragmentSrc), precision, attributeLocations);
    }

    /* eslint-enable max-len */
}
