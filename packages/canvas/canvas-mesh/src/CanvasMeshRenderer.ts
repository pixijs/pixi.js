import { Texture } from '@pixi/core';
import { DRAW_MODES } from '@pixi/constants';
import { canvasUtils } from '@pixi/canvas-renderer';

import type { CanvasRenderer } from '@pixi/canvas-renderer';
import type { Mesh } from '@pixi/mesh';

/**
 * Renderer dedicated to meshes.
 *
 * @class
 * @protected
 * @memberof PIXI
 */
export class CanvasMeshRenderer
{
    public renderer: CanvasRenderer;

    /**
     * @param {PIXI.CanvasRenderer} renderer - The renderer this downport works for
     */
    constructor(renderer: CanvasRenderer)
    {
        this.renderer = renderer;
    }

    /**
     * Renders the Mesh
     *
     * @param {PIXI.Mesh} mesh - the Mesh to render
     */
    public render(mesh: Mesh): void
    {
        const renderer = this.renderer;
        const transform = mesh.worldTransform;

        renderer.context.globalAlpha = mesh.worldAlpha;
        renderer.setBlendMode(mesh.blendMode);
        renderer.setContextTransform(transform, mesh.roundPixels);

        if (mesh.drawMode !== DRAW_MODES.TRIANGLES)
        {
            this._renderTriangleMesh(mesh);
        }
        else
        {
            this._renderTriangles(mesh);
        }
    }

    /**
     * Draws the object in Triangle Mesh mode
     *
     * @private
     * @param {PIXI.Mesh} mesh - the Mesh to render
     */
    private _renderTriangleMesh(mesh: Mesh): void
    {
        // draw triangles!!
        const length = mesh.geometry.buffers[0].data.length;

        for (let i = 0; i < length - 2; i++)
        {
            // draw some triangles!
            const index = i * 2;

            this._renderDrawTriangle(mesh, index, (index + 2), (index + 4));
        }
    }

    /**
     * Draws the object in triangle mode using canvas
     *
     * @private
     * @param {PIXI.Mesh} mesh - the current mesh
     */
    private _renderTriangles(mesh: Mesh): void
    {
        // draw triangles!!
        const indices = mesh.geometry.getIndex().data;
        const length = indices.length;

        for (let i = 0; i < length; i += 3)
        {
            // draw some triangles!
            const index0 = indices[i] * 2;
            const index1 = indices[i + 1] * 2;
            const index2 = indices[i + 2] * 2;

            this._renderDrawTriangle(mesh, index0, index1, index2);
        }
    }

    /**
     * Draws one of the triangles that from the Mesh
     *
     * @private
     * @param {PIXI.Mesh} mesh - the current mesh
     * @param {number} index0 - the index of the first vertex
     * @param {number} index1 - the index of the second vertex
     * @param {number} index2 - the index of the third vertex
     */
    private _renderDrawTriangle(mesh: Mesh, index0: number, index1: number, index2: number): void
    {
        const context = this.renderer.context;
        const vertices = mesh.geometry.buffers[0].data;
        const { uvs, texture } = mesh;

        if (!texture.valid)
        {
            return;
        }
        const isTinted = mesh.tint !== 0xFFFFFF;
        const base = texture.baseTexture;
        const textureWidth = base.width;
        const textureHeight = base.height;

        if (isTinted)
        {
            if (mesh._cachedTint !== mesh.tint)
            {
                mesh._cachedTint = mesh.tint;
                mesh._cachedTexture = mesh._cachedTexture || new Texture(base);
                mesh._tintedCanvas = canvasUtils.getTintedCanvas(
                    { texture: mesh._cachedTexture },
                    mesh.tint
                ) as HTMLCanvasElement;
            }
        }

        const textureSource = isTinted ? mesh._tintedCanvas : base.getDrawableSource();

        const u0 = uvs[index0] * base.width;
        const u1 = uvs[index1] * base.width;
        const u2 = uvs[index2] * base.width;
        const v0 = uvs[index0 + 1] * base.height;
        const v1 = uvs[index1 + 1] * base.height;
        const v2 = uvs[index2 + 1] * base.height;

        let x0 = vertices[index0];
        let x1 = vertices[index1];
        let x2 = vertices[index2];
        let y0 = vertices[index0 + 1];
        let y1 = vertices[index1 + 1];
        let y2 = vertices[index2 + 1];

        const screenPadding = mesh.canvasPadding / this.renderer.resolution;

        if (screenPadding > 0)
        {
            const { a, b, c, d } = mesh.worldTransform;

            const centerX = (x0 + x1 + x2) / 3;
            const centerY = (y0 + y1 + y2) / 3;

            let normX = x0 - centerX;
            let normY = y0 - centerY;

            // Transform to screen space and calculate the distance
            let screenX = (a * normX) + (c * normY);
            let screenY = (b * normX) + (d * normY);
            let screenDist = Math.sqrt((screenX * screenX) + (screenY * screenY));

            // Factor by which to scale in order to add padding equal to screenPadding
            let paddingFactor = 1 + (screenPadding / screenDist);

            x0 = centerX + (normX * paddingFactor);
            y0 = centerY + (normY * paddingFactor);

            normX = x1 - centerX;
            normY = y1 - centerY;

            screenX = (a * normX) + (c * normY);
            screenY = (b * normX) + (d * normY);
            screenDist = Math.sqrt((screenX * screenX) + (screenY * screenY));

            paddingFactor = 1 + (screenPadding / screenDist);

            x1 = centerX + (normX * paddingFactor);
            y1 = centerY + (normY * paddingFactor);

            normX = x2 - centerX;
            normY = y2 - centerY;

            screenX = (a * normX) + (c * normY);
            screenY = (b * normX) + (d * normY);
            screenDist = Math.sqrt((screenX * screenX) + (screenY * screenY));

            paddingFactor = 1 + (screenPadding / screenDist);

            x2 = centerX + (normX * paddingFactor);
            y2 = centerY + (normY * paddingFactor);
        }

        context.save();
        context.beginPath();

        if (mesh.roundPixels)
        {
            const { a, b, c, d } = mesh.worldTransform;
            const sx = Math.sqrt((a * a) + (b * b));
            const sy = Math.sqrt((c * c) + (d * d));

            x0 = Math.round(x0 * sx) / sx;
            y0 = Math.round(y0 * sy) / sy;
            x1 = Math.round(x1 * sx) / sx;
            y1 = Math.round(y1 * sy) / sy;
            x2 = Math.round(x2 * sx) / sx;
            y2 = Math.round(y2 * sy) / sy;
        }

        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.lineTo(x2, y2);

        context.closePath();

        context.clip();

        // Compute matrix transform
        const delta = (u0 * v1) + (v0 * u2) + (u1 * v2) - (v1 * u2) - (v0 * u1) - (u0 * v2);
        const deltaA = (x0 * v1) + (v0 * x2) + (x1 * v2) - (v1 * x2) - (v0 * x1) - (x0 * v2);
        const deltaB = (u0 * x1) + (x0 * u2) + (u1 * x2) - (x1 * u2) - (x0 * u1) - (u0 * x2);
        const deltaC = (u0 * v1 * x2) + (v0 * x1 * u2) + (x0 * u1 * v2) - (x0 * v1 * u2) - (v0 * u1 * x2) - (u0 * x1 * v2);
        const deltaD = (y0 * v1) + (v0 * y2) + (y1 * v2) - (v1 * y2) - (v0 * y1) - (y0 * v2);
        const deltaE = (u0 * y1) + (y0 * u2) + (u1 * y2) - (y1 * u2) - (y0 * u1) - (u0 * y2);
        const deltaF = (u0 * v1 * y2) + (v0 * y1 * u2) + (y0 * u1 * v2) - (y0 * v1 * u2) - (v0 * u1 * y2) - (u0 * y1 * v2);

        context.transform(
            deltaA / delta,
            deltaD / delta,
            deltaB / delta,
            deltaE / delta,
            deltaC / delta,
            deltaF / delta
        );

        context.drawImage(
            textureSource,
            0,
            0,
            textureWidth * base.resolution,
            textureHeight * base.resolution,
            0,
            0,
            textureWidth,
            textureHeight
        );

        context.restore();
        this.renderer.invalidateBlendMode();
    }

    /**
     * Renders a flat Mesh
     *
     * @private
     * @param {PIXI.Mesh} mesh - The Mesh to render
     */
    renderMeshFlat(mesh: Mesh): void
    {
        const context = this.renderer.context;
        const vertices = mesh.geometry.getBuffer('aVertexPosition').data;
        const length = vertices.length / 2;

        // this.count++;

        context.beginPath();

        for (let i = 1; i < length - 2; ++i)
        {
            // draw some triangles!
            const index = i * 2;

            const x0 = vertices[index];
            const y0 = vertices[index + 1];

            const x1 = vertices[index + 2];
            const y1 = vertices[index + 3];

            const x2 = vertices[index + 4];
            const y2 = vertices[index + 5];

            context.moveTo(x0, y0);
            context.lineTo(x1, y1);
            context.lineTo(x2, y2);
        }

        context.fillStyle = '#FF0000';
        context.fill();
        context.closePath();
    }

    /**
     * destroy the the renderer.
     *
     */
    public destroy(): void
    {
        this.renderer = null;
    }
}
