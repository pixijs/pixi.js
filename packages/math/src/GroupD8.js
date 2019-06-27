// Your friendly neighbour https://en.wikipedia.org/wiki/Dihedral_group
//
// This file implements the dihedral group of order 16, also called
// of degree 8. That's why its called GroupD8.

import Matrix from './Matrix';

/**
 * Maps each `PIXI.GD8Symmetry` to the direction of
 * the X-component of the new U-axis.
 */
const ux = [1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1, 0, 1];

/**
 * Maps each `PIXI.GD8Symmetry` rotation to the direction of
 * the Y-component of the new U-axis.
 */
const uy = [0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1];

/**
 * Maps each `PIXI.GD8Symmetry` rotation to the direction of
 * the X-component of the new V-axis.
 */
const vx = [0, -1, -1, -1, 0, 1, 1, 1, 0, 1, 1, 1, 0, -1, -1, -1];

/**
 * Maps each `PIXI.GD8Symmetry` rotation to the direction of
 * the Y-component of the new V-axis.
 */
const vy = [1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, 1, 1, 1, 0, -1];

/**
 * [Cayley Table]{@link https://en.wikipedia.org/wiki/Cayley_table}
 * for the composition of each rotation in the dihederal group D8.
 *
 * It is a 2D array as follows:
 * |    | E  | SE | S  | SW | W  | NW | N  | NE |
 * |----|----|----|----|----|----|----|----|----|
 * | E  | E  | SE | S  | SW | W  | NW | N  | NE |
 * | SE | SE | S  | SW | W  | NW | N  | NE | E  |
 * | S  | S  | SW | W  | NW | N  | NE | E  | SE |
 * | SW | SW | W  | NW | N  | NE | E  | SE | S  |
 * | W  | W  | NW | N  | NE | E  | SE | S  | SW |
 * | NW | NW | N  | NE | E  | SE | S  | SW | W  |
 * | N  | N  | NE | E  | SE | S  | SW | W  | NW |
 * | NE | NE | E  | SE | S  | SW | W  | NW | N  |
 */
const rotationCayley = [];

/**
 * Matrices for each `GD8Symmetry` rotation.
 */
const rotationMatrices = [];

/*
 * Alias for {@code Math.sign}.
 */
const signum = Math.sign;

/*
 * Initializes `rotationCayley` and `rotationMatrices`. It is called
 * only once below.
 */
function init()
{
    for (let i = 0; i < 16; i++)
    {
        const row = [];

        rotationCayley.push(row);

        for (let j = 0; j < 16; j++)
        {
            /* Multiplies rotation matrices i and j. */
            const _ux = signum((ux[i] * ux[j]) + (vx[i] * uy[j]));
            const _uy = signum((uy[i] * ux[j]) + (vy[i] * uy[j]));
            const _vx = signum((ux[i] * vx[j]) + (vx[i] * vy[j]));
            const _vy = signum((uy[i] * vx[j]) + (vy[i] * vy[j]));

            /* Finds rotation matrix matching the product and pushes it. */
            for (let k = 0; k < 16; k++)
            {
                if (ux[k] === _ux && uy[k] === _uy
                      && vx[k] === _vx && vy[k] === _vy)
                {
                    row.push(k);
                    break;
                }
            }
        }
    }

    for (let i = 0; i < 16; i++)
    {
        const mat = new Matrix();

        mat.set(ux[i], uy[i], vx[i], vy[i], 0, 0);
        rotationMatrices.push(mat);
    }
}

init();

/**
 * @memberof PIXI
 * @typedef {number} GD8Symmetry
 * @see PIXI.GroupD8
 */

/**
 * Implements the dihedral group D8, which is similar to
 * [group D4]{@link http://mathworld.wolfram.com/DihedralGroupD4.html};
 * D8 is the same but with diagonals, and it is used for texture
 * rotations.
 *
 * The directions the U- and V- axes after rotation
 * of an angle of `a: GD8Constant` are the vectors `(uX(a), uY(a))`
 * and `(vX(a), vY(a))`. These aren't necessarily unit vectors.
 *
 * **Origin:**<br>
 *  This is the small part of gameofbombs.com portal system. It works.
 *
 * @see PIXI.GroupD8.E
 * @see PIXI.GroupD8.SE
 * @see PIXI.GroupD8.S
 * @see PIXI.GroupD8.SW
 * @see PIXI.GroupD8.W
 * @see PIXI.GroupD8.NW
 * @see PIXI.GroupD8.N
 * @see PIXI.GroupD8.NE
 * @author Ivan @ivanpopelyshev
 * @class
 * @memberof PIXI
 */
const GroupD8 = {
    /**
     * | Rotation | Direction |
     * |----------|-----------|
     * | 0°       | East      |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    E: 0,

    /**
     * | Rotation | Direction |
     * |----------|-----------|
     * | 45°↻     | Southeast |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    SE: 1,

    /**
     * | Rotation | Direction |
     * |----------|-----------|
     * | 90°↻     | South     |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    S: 2,

    /**
     * | Rotation | Direction |
     * |----------|-----------|
     * | 135°↻    | Southwest |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    SW: 3,

    /**
     * | Rotation | Direction |
     * |----------|-----------|
     * | 180°     | West      |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    W: 4,

    /**
     * | Rotation    | Direction    |
     * |-------------|--------------|
     * | -135°/225°↻ | Northwest    |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    NW: 5,

    /**
     * | Rotation    | Direction    |
     * |-------------|--------------|
     * | -90°/270°↻  | North        |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    N: 6,

    /**
     * | Rotation    | Direction    |
     * |-------------|--------------|
     * | -45°/315°↻  | Northeast    |
     *
     * @constant {PIXI.GD8Symmetry}
     */
    NE: 7,

    /**
     * Reflection about Y-axis.
     *
     * @constant {PIXI.GD8Symmetry}
     */
    MIRROR_VERTICAL: 8,

    /**
     * Reflection about the main diagonal.
     *
     * @constant {PIXI.GD8Symmetry}
     */
    MAIN_DIAGONAL: 10,

    /**
     * Reflection about X-axis.
     *
     * @constant {PIXI.GD8Symmetry}
     */
    MIRROR_HORIZONTAL: 12,

    /**
     * Reflection about reverse diagonal.
     *
     * @constant {PIXI.GD8Symmetry}
     */
    REVERSE_DIAGONAL: 14,

    /**
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} ind - sprite rotation angle.
     * @return {PIXI.GD8Symmetry} The X-component of the U-axis
     *    after rotating the axes.
     */
    uX: (ind) => ux[ind],

    /**
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} ind - sprite rotation angle.
     * @return {PIXI.GD8Symmetry} The Y-component of the U-axis
     *    after rotating the axes.
     */
    uY: (ind) => uy[ind],

    /**
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} ind - sprite rotation angle.
     * @return {PIXI.GD8Symmetry} The X-component of the V-axis
     *    after rotating the axes.
     */
    vX: (ind) => vx[ind],

    /**
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} ind - sprite rotation angle.
     * @return {PIXI.GD8Symmetry} The Y-component of the V-axis
     *    after rotating the axes.
     */
    vY: (ind) => vy[ind],

    /**
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} rotation - symmetry whose opposite
     *   is needed. Only rotations have opposite symmetries while
     *   reflections don't.
     * @return {PIXI.GD8Symmetry} The opposite symmetry of `rotation`
     */
    inv: (rotation) =>
    {
        if (rotation & 8)// true only if 8 or 12
        {
            return rotation & 15;// or rotation % 16
        }

        return (-rotation) & 7;// or (8 - rotation) % 8
    },

    /**
     * Composes the two D8 operations.
     *
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} second - second operation
     * @param {PIXI.GD8Symmetry} first - first operation
     * @return {PIXI.GD8Symmetry} Composed operation
     */
    add: (rotationSecond, rotationFirst) => (
        rotationCayley[rotationSecond][rotationFirst]
    ),

    /**
     * Reverse of `add`.
     *
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} second - second operation
     * @param {PIXI.GD8Symmetry} first - first operation
     * @return {PIXI.GD8Symmetry} Result
     */
    sub: (rotationSecond, rotationFirst) => (
        rotationCayley[rotationSecond][GroupD8.inv(rotationFirst)]
    ),

    /**
     * Adds 180 degrees to rotation, which is a commutative
     * operation.
     *
     * @memberof PIXI.GroupD8
     * @param {number} rotation - The number to rotate.
     * @returns {number} Rotated number
     */
    rotate180: (rotation) => rotation ^ 4,

    /**
     * Checks if the rotation angle is vertical, i.e. south
     * or north. It doesn't work for reflections.
     *
     * @memberof PIXI.GroupD8
     * @param {PIXI.GD8Symmetry} rotation - The number to check.
     * @returns {boolean} Whether or not the direction is vertical
     */
    isVertical: (rotation) => (rotation & 3) === 2, // rotation % 4 === 2

    /**
     * Approximates the vector `V(dx,dy)` into one of the
     * eight directions provided by `GroupD8`.
     *
     * @memberof PIXI.GroupD8
     * @param {number} dx - X-component of the vector
     * @param {number} dy - Y-component of the vector
     * @return {PIXI.GD8Symmetry} Approximation of the vector into
     *  one of the eight symmetries.
     */
    byDirection: (dx, dy) =>
    {
        if (Math.abs(dx) * 2 <= Math.abs(dy))
        {
            if (dy >= 0)
            {
                return GroupD8.S;
            }

            return GroupD8.N;
        }
        else if (Math.abs(dy) * 2 <= Math.abs(dx))
        {
            if (dx > 0)
            {
                return GroupD8.E;
            }

            return GroupD8.W;
        }
        else if (dy > 0)
        {
            if (dx > 0)
            {
                return GroupD8.SE;
            }

            return GroupD8.SW;
        }
        else if (dx > 0)
        {
            return GroupD8.NE;
        }

        return GroupD8.NW;
    },

    /**
     * Helps sprite to compensate texture packer rotation.
     *
     * @memberof PIXI.GroupD8
     * @param {PIXI.Matrix} matrix - sprite world matrix
     * @param {PIXI.GroupD8Symmetry} rotation - The rotation factor to use.
     * @param {number} tx - sprite anchoring
     * @param {number} ty - sprite anchoring
     */
    matrixAppendRotationInv: (matrix, rotation, tx = 0, ty = 0) =>
    {
        // Packer used "rotation", we use "inv(rotation)"
        const mat = rotationMatrices[GroupD8.inv(rotation)];

        mat.tx = tx;
        mat.ty = ty;
        matrix.append(mat);
    },
};

export default GroupD8;
