import { Point } from './Point';

/**
 * The Point object represents a location in a two-dimensional coordinate system, where x represents
 * the horizontal axis and y represents the vertical axis.
 *
 * An ObservablePoint is a point that triggers a callback when the point's position is changed.
 *
 * @class
 * @memberof PIXI
 */
export class ObservablePoint
{
    public cb: () => any;
    public scope: any;
    protected _x: number;
    protected _y: number;

    /**
     * @param {Function} cb - callback when changed
     * @param {object} scope - owner of callback
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=0] - position of the point on the y axis
     */
    constructor(cb: () => any, scope: any, x = 0, y = 0)
    {
        this._x = x;
        this._y = y;

        this.cb = cb;
        this.scope = scope;
    }

    /**
     * Creates a clone of this point.
     * The callback and scope params can be overidden otherwise they will default
     * to the clone object's values.
     *
     * @override
     * @param {Function} [cb=null] - callback when changed
     * @param {object} [scope=null] - owner of callback
     * @return {PIXI.ObservablePoint} a copy of the point
     */
    clone(cb = this.cb, scope = this.scope): ObservablePoint
    {
        return new ObservablePoint(cb, scope, this._x, this._y);
    }

    /**
     * Sets the point to a new x and y position.
     * If y is omitted, both x and y will be set to x.
     *
     * @param {number} [x=0] - position of the point on the x axis
     * @param {number} [y=0] - position of the point on the y axis
     */
    set(x = 0, y? : number): void
    {
        const _y = y || ((y !== 0) ? x : 0);

        if (this._x !== x || this._y !== _y)
        {
            this._x = x;
            this._y = _y;
            this.cb.call(this.scope);
        }
    }

    /**
     * Copies x and y from the given point
     *
     * @param {PIXI.IPoint} p - The point to copy from.
     * @returns {PIXI.IPoint} Returns itself.
     */
    copyFrom(p: IPoint): this
    {
        if (this._x !== p.x || this._y !== p.y)
        {
            this._x = p.x;
            this._y = p.y;
            this.cb.call(this.scope);
        }

        return this;
    }

    /**
     * Copies x and y into the given point
     *
     * @param {PIXI.IPoint} p - The point to copy.
     * @returns {PIXI.IPoint} Given point with values updated
     */
    copyTo(p: IPoint): IPoint
    {
        p.set(this._x, this._y);

        return p;
    }

    /**
     * Returns true if the given point is equal to this point
     *
     * @param {PIXI.IPoint} p - The point to check
     * @returns {boolean} Whether the given point equal to this point
     */
    equals(p: IPoint): boolean
    {
        return (p.x === this._x) && (p.y === this._y);
    }

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     *
     * @member {number}
     */
    get x(): number
    {
        return this._x;
    }

    set x(value) // eslint-disable-line require-jsdoc
    {
        if (this._x !== value)
        {
            this._x = value;
            this.cb.call(this.scope);
        }
    }

    /**
     * The position of the displayObject on the x axis relative to the local coordinates of the parent.
     *
     * @member {number}
     */
    get y(): number
    {
        return this._y;
    }

    set y(value) // eslint-disable-line require-jsdoc
    {
        if (this._y !== value)
        {
            this._y = value;
            this.cb.call(this.scope);
        }
    }
}

/**
 * A number, or a string containing a number.
 * @memberof PIXI
 * @typedef {(PIXI.Point|PIXI.ObservablePoint)} IPoint
 */
export type IPoint = Point|ObservablePoint;
