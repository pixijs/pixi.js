import { ParticleContainer } from '@pixi/particles';
import type { Sprite } from '@pixi/sprite';
import type { CanvasRenderer } from '@pixi/canvas-renderer';

/**
 * Renders the object using the Canvas renderer
 * @method renderCanvas
 * @memberof PIXI.ParticleContainer#
 * @private
 * @param {PIXI.CanvasRenderer} renderer - a reference to the canvas renderer
 */
ParticleContainer.prototype.renderCanvas = function renderCanvas(renderer: CanvasRenderer): void
{
    if (!this.visible || this.worldAlpha <= 0 || !this.children.length || !this.renderable)
    {
        return;
    }

    const context = renderer.context;
    const transform = this.worldTransform;
    let isRotated = true;

    let positionX = 0;
    let positionY = 0;

    let finalWidth = 0;
    let finalHeight = 0;

    renderer.setBlendMode(this.blendMode);

    context.globalAlpha = this.worldAlpha;

    this.displayObjectUpdateTransform();

    let sx;
    let sy;

    for (let i = 0; i < this.children.length; ++i)
    {
        const child = this.children[i] as Sprite;

        if (!child.visible)
        {
            continue;
        }

        if (!child._texture.valid)
        {
            continue;
        }

        const frame = child._texture.frame;

        context.globalAlpha = this.worldAlpha * child.alpha;

        if (child.rotation % (Math.PI * 2) === 0)
        {
            // this is the fastest  way to optimise! - if rotation is 0 then we can avoid any kind of setTransform call
            if (isRotated)
            {
                renderer.setContextTransform(transform, this.roundPixels);
                isRotated = false;

                if (this.roundPixels)
                {
                    const { a, b, c, d } = transform;

                    sx = Math.sqrt((a * a) + (b * b));
                    sy = Math.sqrt((c * c) + (d * d));
                }
            }

            positionX = ((child.anchor.x) * (-frame.width * child.scale.x)) + child.position.x + 0.5;
            positionY = ((child.anchor.y) * (-frame.height * child.scale.y)) + child.position.y + 0.5;

            finalWidth = frame.width * child.scale.x;
            finalHeight = frame.height * child.scale.y;
        }
        else
        {
            if (!isRotated)
            {
                isRotated = true;
            }

            child.displayObjectUpdateTransform();

            const childTransform = child.worldTransform;

            renderer.setContextTransform(childTransform, this.roundPixels);

            if (this.roundPixels)
            {
                const { a, b, c, d } = childTransform;

                sx = Math.sqrt((a * a) + (b * b));
                sy = Math.sqrt((c * c) + (d * d));
            }

            positionX = ((child.anchor.x) * (-frame.width)) + 0.5;
            positionY = ((child.anchor.y) * (-frame.height)) + 0.5;

            finalWidth = frame.width;
            finalHeight = frame.height;
        }

        let dx = positionX;
        let dy = positionY;
        let dw = finalWidth;
        let dh = finalHeight;

        if (this.roundPixels)
        {
            dx = Math.round(dx * sx) / sx;
            dy = Math.round(dy * sy) / sy;
            dw = Math.round(dw * sx) / sx;
            dh = Math.round(dh * sy) / sy;
        }

        const resolution = child._texture.baseTexture.resolution;

        context.drawImage(
            child._texture.baseTexture.getDrawableSource(),
            frame.x * resolution,
            frame.y * resolution,
            frame.width * resolution,
            frame.height * resolution,
            dx,
            dy,
            dw,
            dh
        );
    }
};
