/**
 * Smaller version of the async library constructs.
 *
 */
function _noop(): void
{ /* empty */
}

/**
 * Ensures a function is only called once.
 *
 * @param {function} fn - The function to wrap.
 * @return {function} The wrapping function.
 */
function onlyOnce(fn: () => void): () => void
{
    return function onceWrapper(this: any, ...args: any)
    {
        if (fn === null)
        {
            throw new Error('Callback was already called.');
        }

        const callFn = fn;

        fn = null;
        callFn.apply(this, args);
    };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IQueue {

}

export class AsyncQueueItem<TaskData>
{
    data: TaskData;
    callback: (...args: any[]) => void;

    constructor(data: TaskData, callback: (...args: any[]) => void)
    {
        this.data = data;
        this.callback = callback;
    }
}

export class AsyncQueue<TaskData>
{
    workers = 0;

    concurrency: number;
    buffer: number;

    saturated: () => void = _noop;
    unsaturated: () => void = _noop;
    empty: () => void = _noop;
    drain: () => void = _noop;
    error: (err: Error, task: TaskData) => void = _noop;

    started = false;
    paused = false;

    private _worker: (x: TaskData, next: () => void) => void;
    _tasks: Array<AsyncQueueItem<TaskData>> = [];

    constructor(worker: (x: TaskData, next: () => void) => void, concurrency = 1)
    {
        this._worker = worker;

        if (concurrency === 0)
        {
            throw new Error('Concurrency must not be zero');
        }

        this.concurrency = concurrency;
        this.buffer = concurrency / 4.0;
    }

    private _insert = (data: any, insertAtFront: boolean, callback?: () => void) =>
    {
        if (callback && typeof callback !== 'function')
        {
            throw new Error('task callback must be a function');
        }

        this.started = true;

        // eslint-disable-next-line no-eq-null,eqeqeq
        if (data == null && this.idle())
        {
            // call drain immediately if there are no tasks
            setTimeout(() => this.drain(), 1);

            return;
        }

        const item = new AsyncQueueItem<TaskData>(
            data,
            typeof callback === 'function' ? callback : _noop
        );

        if (insertAtFront)
        {
            this._tasks.unshift(item);
        }
        else
        {
            this._tasks.push(item);
        }

        setTimeout(this.process, 1);
    };

    process = (): void =>
    {
        while (!this.paused && this.workers < this.concurrency && this._tasks.length)
        {
            const task = this._tasks.shift();

            if (this._tasks.length === 0)
            {
                this.empty();
            }

            this.workers += 1;

            if (this.workers === this.concurrency)
            {
                this.saturated();
            }

            this._worker(task.data, onlyOnce(this._next(task)));
        }
    };

    _next(task: AsyncQueueItem<TaskData>): (...args: any) => void
    {
        return (...args: any) =>
        {
            this.workers -= 1;

            task.callback(...args);

            // eslint-disable-next-line no-eq-null,eqeqeq
            if (args[0] != null)
            {
                this.error(args[0], task.data);
            }

            if (this.workers <= (this.concurrency - this.buffer))
            {
                this.unsaturated();
            }

            if (this.idle())
            {
                this.drain();
            }

            this.process();
        };
    }

    // That was in object

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    push(data: any, callback?: (...args: any[]) => void): void
    {
        this._insert(data, false, callback);
    }

    kill(): void
    {
        this.workers = 0;
        this.drain = _noop;
        this.started = false;
        this._tasks = [];
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    unshift(data: any, callback?: (...args: any[]) => void): void
    {
        this._insert(data, true, callback);
    }

    length(): number
    {
        return this._tasks.length;
    }

    running(): number
    {
        return this.workers;
    }

    idle(): boolean
    {
        return this._tasks.length + this.workers === 0;
    }

    pause(): void
    {
        if (this.paused === true)
        {
            return;
        }

        this.paused = true;
    }

    resume(): void
    {
        if (this.paused === false)
        {
            return;
        }

        this.paused = false;

        // Need to call this.process once per concurrent
        // worker to preserve full concurrency after pause
        for (let w = 1; w <= this.concurrency; w++)
        {
            this.process();
        }
    }

    /**
     * Iterates an array in series.
     *
     * @param {Array.<*>} array - Array to iterate.
     * @param {function} iterator - Function to call for each element.
     * @param {function} callback - Function to call when done, or on error.
     * @param {boolean} [deferNext=false] - Break synchronous each loop by calling next with a setTimeout of 1.
     */
    static eachSeries(array: Array<any>, iterator: (x: any, next: (err?: any) => void) => void,
        callback?: (err?: any) => void, deferNext?: boolean): void
    {
        let i = 0;
        const len = array.length;

        function next(err?: any)
        {
            if (err || i === len)
            {
                if (callback)
                {
                    callback(err);
                }

                return;
            }

            if (deferNext)
            {
                setTimeout(() =>
                {
                    iterator(array[i++], next);
                }, 1);
            }
            else
            {
                iterator(array[i++], next);
            }
        }

        next();
    }

    /**
     * Async queue implementation,
     *
     * @param {function} worker - The worker function to call for each task.
     * @param {number} concurrency - How many workers to run in parrallel.
     * @return {*} The async queue object.
     */
    static queue(worker: (x: any, next: (...args: any) => void) => void, concurrency?: number): AsyncQueue<any>
    {
        return new AsyncQueue<any>(worker, concurrency);
    }
}
