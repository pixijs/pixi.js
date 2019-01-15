import System from '../System';
import GLBuffer from './GLBuffer';
import { ENV } from '@pixi/constants';
import { settings } from '../settings';

const byteSizeMap = { 5126: 4, 5123: 2, 5121: 1 };

/**
 * System plugin to the renderer to manage geometry.
 *
 * @class
 * @extends PIXI.System
 * @memberof PIXI.systems
 */
export default class GeometrySystem extends System
{
    /**
     * @param {PIXI.Renderer} renderer - The renderer this System works for.
     */
    constructor(renderer)
    {
        super(renderer);

        this._activeGeometry = null;
        this._activeVao = null;

        /**
         * `true` if we has `*_vertex_array_object` extension
         * @member {boolean}
         * @readonly
         */
        this.hasVao = true;

        /**
         * `true` if has `ANGLE_instanced_arrays` extension
         * @member {boolean}
         * @readonly
         */
        this.hasInstance = true;

        /**
         * A cache of currently bound buffer,
         * contains only two members with keys ARRAY_BUFFER and ELEMENT_ARRAY_BUFFER
         * @member {Object.<number, PIXI.Buffer>}
         * @readonly
         */
        this.boundBuffers = {};
    }

    /**
     * Sets up the renderer context and necessary buffers.
     */
    contextChange()
    {
        const gl = this.gl = this.renderer.gl;

        this.CONTEXT_UID = this.renderer.CONTEXT_UID;

        // webgl2
        if (!gl.createVertexArray)
        {
            // webgl 1!
            let nativeVaoExtension = this.renderer.context.extensions.vertexArrayObject;

            if (settings.PREFER_ENV === ENV.WEBGL_LEGACY)
            {
                nativeVaoExtension = null;
            }

            if (nativeVaoExtension)
            {
                gl.createVertexArray = () =>
                    nativeVaoExtension.createVertexArrayOES();

                gl.bindVertexArray = (vao) =>
                    nativeVaoExtension.bindVertexArrayOES(vao);

                gl.deleteVertexArray = (vao) =>
                    nativeVaoExtension.deleteVertexArrayOES(vao);
            }
            else
            {
                this.hasVao = false;
                gl.createVertexArray = () =>
                {
                    // empty
                };

                gl.bindVertexArray = () =>
                {
                    // empty
                };

                gl.deleteVertexArray = () =>
                {
                    // empty
                };
            }
        }

        if (!gl.vertexAttribDivisor)
        {
            const instanceExt = gl.getExtension('ANGLE_instanced_arrays');

            if (instanceExt)
            {
                gl.vertexAttribDivisor = (a, b) =>
                    instanceExt.vertexAttribDivisorANGLE(a, b);

                gl.drawElementsInstanced = (a, b, c, d, e) =>
                    instanceExt.drawElementsInstancedANGLE(a, b, c, d, e);

                gl.drawArraysInstanced = (a, b, c, d) =>
                    instanceExt.drawArraysInstancedANGLE(a, b, c, d);
            }
            else
            {
                this.hasInstance = false;
            }
        }
    }

    /**
     * Binds geometry so that is can be drawn. Creating a Vao if required
     * @protected
     * @param {PIXI.Geometry} geometry instance of geometry to bind
     * @param {PIXI.Shader} shader instance of shader to bind
     */
    bind(geometry, shader)
    {
        shader = shader || this.renderer.shader.shader;

        const { gl } = this;

        // not sure the best way to address this..
        // currently different shaders require different VAOs for the same geometry
        // Still mulling over the best way to solve this one..
        // will likely need to modify the shader attribute locations at run time!
        let vaos = geometry.glVertexArrayObjects[this.CONTEXT_UID];

        if (!vaos)
        {
            geometry.glVertexArrayObjects[this.CONTEXT_UID] = vaos = {};
        }

        const vao = vaos[shader.program.id] || this.initGeometryVao(geometry, shader.program);

        this._activeGeometry = geometry;

        if (this._activeVao !== vao)
        {
            this._activeVao = vao;

            if (this.hasVao)
            {
                gl.bindVertexArray(vao);
            }
            else
            {
                this.activateVao(geometry, shader.program);
            }
        }

        // TODO - optimise later!
        // don't need to loop through if nothing changed!
        // maybe look to add an 'autoupdate' to geometry?
        this.updateBuffers();
    }

    /**
     * Reset and unbind any active VAO and geometry
     */
    reset()
    {
        this.unbind();
    }

    /**
     * Update buffers
     * @protected
     */
    updateBuffers()
    {
        const geometry = this._activeGeometry;
        const { gl } = this;

        for (let i = 0; i < geometry.buffers.length; i++)
        {
            const buffer = geometry.buffers[i];

            const glBuffer = buffer._glBuffers[this.CONTEXT_UID];

            if (buffer._updateID !== glBuffer.updateID)
            {
                glBuffer.updateID = buffer._updateID;

                // TODO can cache this on buffer! maybe added a getter / setter?
                const type = buffer.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

                // TODO this could change if the VAO changes...
                // need to come up with a better way to cache..
                // if (this.boundBuffers[type] !== glBuffer)
                // {
                // this.boundBuffers[type] = glBuffer;
                gl.bindBuffer(type, glBuffer.buffer);
                // }

                this._boundBuffer = glBuffer;

                if (glBuffer.byteLength >= buffer.data.byteLength)
                {
                    // offset is always zero for now!
                    gl.bufferSubData(type, 0, buffer.data);
                }
                else
                {
                    const drawType = buffer.static ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW;

                    glBuffer.byteLength = buffer.data.byteLength;
                    gl.bufferData(type, buffer.data, drawType);
                }
            }
        }
    }

    /**
     * Check compability between a geometry and a program
     * @protected
     * @param {PIXI.Geometry} geometry - Geometry instance
     * @param {PIXI.Program} program - Program instance
     */
    checkCompatibility(geometry, program)
    {
        // geometry must have at least all the attributes that the shader requires.
        const geometryAttributes = geometry.attributes;
        const shaderAttributes = program.attributeData;

        for (const j in shaderAttributes)
        {
            if (!geometryAttributes[j])
            {
                throw new Error(`shader and geometry incompatible, geometry missing the "${j}" attribute`);
            }
        }
    }

    /**
     * Takes a geometry and program and generates a unique signature for them.
     *
     * @param {PIXI.Geometry} geometry to get signature from
     * @param {PIXI.Program} prgram to test geometry against
     * @returns {String} Unique signature of the geometry and program
     * @protected
     */
    getSignature(geometry, program)
    {
        const attribs = geometry.attributes;
        const shaderAttributes = program.attributeData;

        const strings = [geometry.id];

        for (const i in attribs)
        {
            if (shaderAttributes[i])
            {
                strings.push(i);
            }
        }

        return strings.join('-');
    }

    /**
     * Creates a Vao with the same structure as the geometry and stores it on the geometry.
     * @protected
     * @param {PIXI.Geometry} geometry - Instance of geometry to to generate Vao for
     * @param {PIXI.Program} program - Instance of program
     */
    initGeometryVao(geometry, program)
    {
        this.checkCompatibility(geometry, program);

        const gl = this.gl;
        const CONTEXT_UID = this.CONTEXT_UID;

        const signature = this.getSignature(geometry, program);

        const vaoObjectHash = geometry.glVertexArrayObjects[this.CONTEXT_UID];

        let vao = vaoObjectHash[signature];

        if (vao)
        {
            // this will give us easy access to the vao
            vaoObjectHash[program.id] = vao;

            return vao;
        }

        const buffers = geometry.buffers;
        const attributes = geometry.attributes;
        const tempStride = {};
        const tempStart = {};

        for (const j in buffers)
        {
            tempStride[j] = 0;
            tempStart[j] = 0;
        }

        for (const j in attributes)
        {
            if (!attributes[j].size && program.attributeData[j])
            {
                attributes[j].size = program.attributeData[j].size;
            }
            else if (!attributes[j].size)
            {
                console.warn(`PIXI Geometry attribute '${j}' size cannot be determined (likely the bound shader does not have the attribute)`);  // eslint-disable-line
            }

            tempStride[attributes[j].buffer] += attributes[j].size * byteSizeMap[attributes[j].type];
        }

        for (const j in attributes)
        {
            const attribute = attributes[j];
            const attribSize = attribute.size;

            if (attribute.stride === undefined)
            {
                if (tempStride[attribute.buffer] === attribSize * byteSizeMap[attribute.type])
                {
                    attribute.stride = 0;
                }
                else
                {
                    attribute.stride = tempStride[attribute.buffer];
                }
            }

            if (attribute.start === undefined)
            {
                attribute.start = tempStart[attribute.buffer];

                tempStart[attribute.buffer] += attribSize * byteSizeMap[attribute.type];
            }
        }

        vao = gl.createVertexArray();

        gl.bindVertexArray(vao);

        // first update - and create the buffers!
        // only create a gl buffer if it actually gets
        for (let i = 0; i < buffers.length; i++)
        {
            const buffer = buffers[i];

            if (!buffer._glBuffers[CONTEXT_UID])
            {
                buffer._glBuffers[CONTEXT_UID] = new GLBuffer(gl.createBuffer());
            }
        }

        // TODO - maybe make this a data object?
        // lets wait to see if we need to first!

        this.activateVao(geometry, program);

        gl.bindVertexArray(this._activeVao);

        // add it to the cache!
        vaoObjectHash[program.id] = vao;
        vaoObjectHash[signature] = vao;

        return vao;
    }

    /**
     * Activate vertex array object
     *
     * @protected
     * @param {PIXI.Geometry} geometry - Geometry instance
     * @param {PIXI.Program} program - Shader program instance
     */
    activateVao(geometry, program)
    {
        const gl = this.gl;
        const CONTEXT_UID = this.CONTEXT_UID;
        const buffers = geometry.buffers;
        const attributes = geometry.attributes;

        if (geometry.indexBuffer)
        {
            // first update the index buffer if we have one..
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indexBuffer._glBuffers[CONTEXT_UID].buffer);
        }

        let lastBuffer = null;

        // add a new one!
        for (const j in attributes)
        {
            const attribute = attributes[j];
            const buffer = buffers[attribute.buffer];
            const glBuffer = buffer._glBuffers[CONTEXT_UID];

            if (program.attributeData[j])
            {
                if (lastBuffer !== glBuffer)
                {
                    gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer.buffer);

                    lastBuffer = glBuffer;
                }

                const location = program.attributeData[j].location;

                // TODO introduce state again
                // we can optimise this for older devices that have no VAOs
                gl.enableVertexAttribArray(location);

                gl.vertexAttribPointer(location,
                    attribute.size,
                    attribute.type || gl.FLOAT,
                    attribute.normalized,
                    attribute.stride,
                    attribute.start);

                if (attribute.instance)
                {
                    // TODO calculate instance count based of this...
                    if (this.hasInstance)
                    {
                        gl.vertexAttribDivisor(location, 1);
                    }
                    else
                    {
                        throw new Error('geometry error, GPU Instancing is not supported on this device');
                    }
                }
            }
        }
    }

    /**
     * Draw the geometry
     *
     * @param {Number} type - the type primitive to render
     * @param {Number} [size] - the number of elements to be rendered
     * @param {Number} [start] - Starting index
     * @param {Number} [instanceCount] - the number of instances of the set of elements to execute
     */
    draw(type, size, start, instanceCount)
    {
        const { gl } = this;
        const geometry = this._activeGeometry;

        // TODO.. this should not change so maybe cache the function?

        if (geometry.indexBuffer)
        {
            if (geometry.instanced)
            {
                /* eslint-disable max-len */
                gl.drawElementsInstanced(type, size || geometry.indexBuffer.data.length, gl.UNSIGNED_SHORT, (start || 0) * 2, instanceCount || 1);
                /* eslint-enable max-len */
            }
            else
            {
                gl.drawElements(type, size || geometry.indexBuffer.data.length, gl.UNSIGNED_SHORT, (start || 0) * 2);
            }
        }
        else if (geometry.instanced)
        {
            // TODO need a better way to calculate size..
            gl.drawArraysInstanced(type, start, size || geometry.getSize(), instanceCount || 1);
        }
        else
        {
            gl.drawArrays(type, start, size || geometry.getSize());
        }

        return this;
    }

    /**
     * Unbind/reset everything
     * @protected
     */
    unbind()
    {
        this.gl.bindVertexArray(null);
        this._activeVao = null;
        this._activeGeometry = null;
    }
}
