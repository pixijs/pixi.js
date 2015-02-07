'use strict';
var Resource = require('resource-loader').Resource,
    path = require('path'),
    core = require('../core');

module.exports = function ()
{
    return function (resource, next)
    {
        // if this is a spritesheet object
        if (resource.data && resource.data.frames)
        {
            var loadOptions = {
                crossOrigin: resource.crossOrigin,
                loadType: Resource.LOAD_TYPE.IMAGE
            };

            var route = path.dirname(resource.url.replace(this.baseUrl, ''));

            // load the image for this sheet
            this.add(resource.name + '_image', this.baseUrl + route + '/' + resource.data.meta.image, loadOptions, function (res)
            {
                resource.textures = {};

                var frames = resource.data.frames;

                for (var i in frames)
                {
                    var rect = frames[i].frame;

                    if (rect)
                    {
                        var size = null;
                        var trim = null;

                        if (frames[i].rotated) {
                            size = new core.math.Rectangle(rect.x, rect.y, rect.h, rect.w);
                        }
                        else {
                            size = new core.math.Rectangle(rect.x, rect.y, rect.w, rect.h);
                        }

                        //  Check to see if the sprite is trimmed
                        if (frames[i].trimmed)
                        {
                            trim = new core.math.Rectangle(
                                frames[i].spriteSourceSize.x,
                                frames[i].spriteSourceSize.y,
                                frames[i].sourceSize.w,
                                frames[i].sourceSize.h
                            );
                        }

                        // flip the width and height!
                        if (frames[i].rotated)
                        {
                            var temp = size.width;
                            size.width = size.height;
                            size.height = temp;
                        }

                        resource.textures[i] = new core.Texture(res.texture.baseTexture, size, size.clone(), trim, frames[i].rotated);

                    }
                }

                next();
            });
        }
        else {
            next();
        }
    };
};
