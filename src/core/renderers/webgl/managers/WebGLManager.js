'use strict';
/**
 * @class
 * @namespace PIXI
 * @param renderer {WebGLRenderer} The renderer this manager works for.
 */
function WebGLManager(renderer)
{
    /**
     * The renderer this manager works for.
     *
     * @member {WebGLRenderer}
     */
    this.renderer = renderer;

    var self = this;
    this.renderer.on('context', this._onContextChangeFn = function(){

    	self.onContextChange();

    });
}

WebGLManager.prototype.constructor = WebGLManager;
module.exports = WebGLManager;

WebGLManager.prototype.onContextChange = function ()
{
	// do some codes init!
};

WebGLManager.prototype.destroy = function ()
{
    this.renderer.off('context', this._onContextChangeFn);

    this.renderer = null;
};
