var core = require('../core');

module.exports = function ()
{
    return function (resource, next)
    {
        // create a new texture if the data is an Image object
        if (resource.data && resource.isImage)
        {
            resource.texture = new core.Texture(new core.BaseTexture(resource.data, null, core.utils.getResolutionOfUrl(resource.url)));
            // lets also add the frame to pixi's global cache for fromFrame and fromImage fucntions
            var id = resource.url;
            if(core.utils.useFilenamesForTextures)
            {
                id = core.utils.getFilenameFromUrl(id);
            }
            core.utils.TextureCache[id] = resource.texture;
        }

        next();
    };
};
