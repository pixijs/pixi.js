import extractUniformsFromSrc from './extractUniformsFromSrc';
import generateUniformsSync from './generateUniformsSync';
import glCore from 'pixi-gl-core';
import { ProgramCache } from '../utils';

let UID = 0;

/**
 * @class
 * @memberof PIXI
 * @extends PIXI.Shader
 */
class Program
{
    /**
     * @param {string} [vertexSrc] - The source of the vertex shader.
     * @param {string} [fragmentSrc] - The source of the fragment shader.
     */
    constructor(vertexSrc, fragmentSrc)
    {
        /**
         * The vertex shader.
         *
         * @member {string}
         */
        this.vertexSrc = vertexSrc || Program.defaultVertexSrc;

        /**
         * The fragment shader.
         *
         * @member {string}
         */
        this.fragmentSrc = fragmentSrc || Program.defaultFragmentSrc;

        // currently this does not extract structs only default types
        this.extractData(this.vertexSrc, this.fragmentSrc);

        // this is where we store shader references..
        this.glShaders = {};

        this.syncUniforms = generateUniformsSync(this.uniformData);

        this.id = UID++;
    }

    /**
     * Extracts the data for a buy creating a small test program
     * or reading the src directly.
     * @private
     *
     * @param {string} [vertexSrc] - The source of the vertex shader.
     * @param {string} [fragmentSrc] - The source of the fragment shader.
     */
    extractData(vertexSrc, fragmentSrc)
    {
        const gl = glCore._testingContext || Program.getTestingContext;

        if (!gl)
        {
            // uh oh! no webGL.. lets read uniforms from the strings..
            this.attributeData = {};
            this.uniformData = extractUniformsFromSrc(vertexSrc, fragmentSrc);
        }
        else
        {
            vertexSrc = glCore.shader.setPrecision(vertexSrc, 'mediump');
            fragmentSrc = glCore.shader.setPrecision(fragmentSrc, 'mediump');

            const program = glCore.shader.compileProgram(gl, vertexSrc, fragmentSrc);

            this.attributeData = this.getAttributeData(program, gl);
            this.uniformData = this.getUniformData(program, gl);

            gl.deleteProgram(program);
        }
    }

    /**
     * returns the attribute data from the program
     * @private
     *
     * @param {webGL-program} [program] - the webgl program
     * @param {contex} [gl] - the webGL context
     *
     * @returns {object} the attribute data for this program
     */
    getAttributeData(program, gl)
    {
        const attributes = {};
        const attributesArray = [];

        const totalAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

        for (let i = 0; i < totalAttributes; i++)
        {
            const attribData = gl.getActiveAttrib(program, i);
            const type = glCore.shader.mapType(gl, attribData.type);

            /*eslint-disable */
            const data = {
                type: type,
                name: attribData.name,
                size: glCore.shader.mapSize(type),
                location: 0,
            };
            /*eslint-enable */

            attributes[attribData.name] = data;
            attributesArray.push(data);
        }

        attributesArray.sort((a, b) => (a.name > b.name) ? 1 : -1); // eslint-disable-line no-confusing-arrow

        for (let i = 0; i < attributesArray.length; i++)
        {
            attributesArray[i].location = i;
        }

        return attributes;
    }

    /**
     * returns the uniform data from the program
     * @private
     *
     * @param {webGL-program} [program] - the webgl program
     * @param {contex} [gl] - the webGL context
     *
     * @returns {object} the uniform data for this program
     */
    getUniformData(program, gl)
    {
        const uniforms = {};

        const totalUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        // TODO expose this as a prop?
        const maskRegex = new RegExp('^(projectionMatrix|uSampler|translationMatrix)$');

        for (let i = 0; i < totalUniforms; i++)
        {
            const uniformData = gl.getActiveUniform(program, i);
            const name = uniformData.name.replace(/\[.*?\]/, '');
            const type = glCore.shader.mapType(gl, uniformData.type);

            if (!name.match(maskRegex))
            {
                /*eslint-disable */
                uniforms[name] = {
                    type: type,
                    size: uniformData.size,
                    value: glCore.shader.defaultValue(type, uniformData.size),
                };
                /*eslint-enable */
            }
        }

        return uniforms;
    }

    /**
     * The default vertex shader source
     *
     * @static
     * @constant
     */
    static get defaultVertexSrc()
    {
        return [
            'attribute vec2 aVertexPosition;',
            'attribute vec2 aTextureCoord;',

            'uniform mat3 projectionMatrix;',

            'varying vec2 vTextureCoord;',

            'void main(void){',
            '   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);',
            '   vTextureCoord = aTextureCoord ;',
            '}',
        ].join('\n');
    }

    /**
     * The default fragment shader source
     *
     * @static
     * @constant
     */
    static get defaultFragmentSrc()
    {
        return [
            'varying vec2 vTextureCoord;',

            'uniform sampler2D uSampler;',

            'void main(void){',
            '   gl_FragColor *= texture2D(uSampler, vTextureCoord);',
            '}',
        ].join('\n');
    }

    /**
     * returns a little webGL context to use for program inspection.
     *
     * @static
     * @private
     * @returns {webGL-context} a gl context to test with
     */
    static getTestingContext()
    {
        try
        {
            if (!Program.testingContext)
            {
                const canvas = document.createElement('canvas');

                canvas.width = 1;
                canvas.height = 1;

                Program.testingContext = glCore.createContext(canvas);
            }
        }

        catch (e)
        {
            // eslint-disable-line no-empty
        }

        return Program.testingContext;
    }

    /**
     * A short hand function to create a program based of a vertex and fragment shader
     * this method will also check to see if there is a cached program.
     *
     * @param {string} [vertexSrc] - The source of the vertex shader.
     * @param {string} [fragmentSrc] - The source of the fragment shader.
     * @param {object} [uniforms] - Custom uniforms to use to augment the built-in ones.
     *
     * @returns {PIXI.Shader} an shiney new pixi shader.
     */
    static from(vertexSrc, fragmentSrc)
    {
        const key = vertexSrc + fragmentSrc;

        let program = ProgramCache[key];

        if (!program)
        {
            ProgramCache[key] = program = new Program(vertexSrc, fragmentSrc);
        }

        return program;
    }
}

export default Program;
