'use strict';
var Strip = require('./Strip');

/**
 *
 * @class
 * @namespace PIXI
 * @extends Strip
 * @param {Texture} texture - The texture to use on the rope.
 * @param {Array} points - An array of {Point}.
 *
 */
function Rope(texture, points)
{
    Strip.call(this, texture);
    this.points = points;

    this.vertices = new Float32Array(points.length * 4);
    this.uvs = new Float32Array(points.length * 4);
    this.colors = new Float32Array(points.length * 2);
    this.indices = new Uint16Array(points.length * 2);

    this.refresh();
}


// constructor
Rope.prototype = Object.create(Strip.prototype);
Rope.prototype.constructor = Rope;
module.exports = Rope;

/**
 * Refreshes
 *
 */
Rope.prototype.refresh = function ()
{
    var points = this.points;

    if (points.length < 1)
    {
        return;
    }

    var uvs = this.uvs;

    var indices = this.indices;
    var colors = this.colors;

    // this.count -= 0.2;

    uvs[0] = 0;
    uvs[1] = 0;
    uvs[2] = 0;
    uvs[3] = 1;

    colors[0] = 1;
    colors[1] = 1;

    indices[0] = 0;
    indices[1] = 1;

    var total = points.length,
        point, index, amount;

    for (var i = 1; i < total; i++)
    {
        point = points[i];
        index = i * 4;
        // time to do some smart drawing!
        amount = i / (total-1);

        if (i%2)
        {
            uvs[index] = amount;
            uvs[index+1] = 0;

            uvs[index+2] = amount;
            uvs[index+3] = 1;
        }
        else
        {
            uvs[index] = amount;
            uvs[index+1] = 0;

            uvs[index+2] = amount;
            uvs[index+3] = 1;
        }

        index = i * 2;
        colors[index] = 1;
        colors[index+1] = 1;

        index = i * 2;
        indices[index] = index;
        indices[index + 1] = index + 1;
    }
};

/*
 * Updates the object transform for rendering
 *
 * @private
 */
Rope.prototype.updateTransform = function ()
{
    var points = this.points;

    if (points.length < 1)
    {
        return;
    }

    var lastPoint = points[0];
    var nextPoint;
    var perpX = 0;
    var perpY = 0;

    // this.count -= 0.2;

    var vertices = this.vertices;
    var total = points.length,
        point, index, ratio, perpLength, num;

    for (var i = 0; i < total; i++)
    {
        point = points[i];
        index = i * 4;

        if (i < points.length-1)
        {
            nextPoint = points[i+1];
        }
        else
        {
            nextPoint = point;
        }

        perpY = -(nextPoint.x - lastPoint.x);
        perpX = nextPoint.y - lastPoint.y;

        ratio = (1 - (i / (total-1))) * 10;

        if (ratio > 1)
        {
            ratio = 1;
        }

        perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        num = this.texture.height / 2; //(20 + Math.abs(Math.sin((i + this.count) * 0.3) * 50) )* ratio;
        perpX /= perpLength;
        perpY /= perpLength;

        perpX *= num;
        perpY *= num;

        vertices[index] = point.x + perpX;
        vertices[index+1] = point.y + perpY;
        vertices[index+2] = point.x - perpX;
        vertices[index+3] = point.y - perpY;

        lastPoint = point;
    }

    this.containerUpdateTransform();
};
