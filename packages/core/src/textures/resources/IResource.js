/**
 * Base Texture resource class, manages validation and upload depends on its type.
 * upload is required.
 * Can also contain style, onTextureNew, onTextureParams, onTextureDestroy.
 * @class
 * @memberof PIXI
 */
export default class IResource
{
    /**
     * uploads the texture or returns false if it cant for some reason
     *
     * @param renderer {PIXI.WebGLRenderer} yeah, renderer!
     * @param baseTexture {PIXI.BaseTexture} the texture
     * @param glTexture {PIXI.glCore.GLTexture} texture instance for this webgl context
     * @returns {boolean} true is success
     */
    upload(/* renderer, baseTexture, glTexture*/)
    {
        return false;
    }
}
