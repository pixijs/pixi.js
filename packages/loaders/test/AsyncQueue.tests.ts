import { AsyncQueue as async } from '@pixi/loaders';
import { expect } from 'chai';

describe('async', () =>
{
    describe('queue', () =>
    {
        it('basics', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // worker1: --1-4
            // worker2: -2---3
            // order of completion: 2,1,4,3

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            }, 2);

            q.push(1, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(1);
                callOrder.push('callback 1');
            });
            q.push(2, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(2);
                callOrder.push('callback 2');
            });
            q.push(3, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(0);
                callOrder.push('callback 3');
            });
            q.push(4, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(0);
                callOrder.push('callback 4');
            });
            expect(q.length()).to.equal(4);
            expect(q.concurrency).to.equal(2);

            q.drain = () =>
            {
                expect(callOrder).to.eql([
                    'process 2', 'callback 2',
                    'process 1', 'callback 1',
                    'process 4', 'callback 4',
                    'process 3', 'callback 3',
                ]);
                expect(q.concurrency).to.equal(2);
                expect(q.length()).to.equal(0);
                done();
            };
        });

        it('default concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // order of completion: 1,2,3,4

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            });

            q.push(1, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(3);
                callOrder.push('callback 1');
            });
            q.push(2, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(2);
                callOrder.push('callback 2');
            });
            q.push(3, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(1);
                callOrder.push('callback 3');
            });
            q.push(4, (err, arg) =>
            {
                expect(err).to.equal('error');
                expect(arg).to.equal('arg');
                expect(q.length()).to.equal(0);
                callOrder.push('callback 4');
            });
            expect(q.length()).to.equal(4);
            expect(q.concurrency).to.equal(1);

            q.drain = () =>
            {
                expect(callOrder).to.eql([
                    'process 1', 'callback 1',
                    'process 2', 'callback 2',
                    'process 3', 'callback 3',
                    'process 4', 'callback 4',
                ]);
                expect(q.concurrency).to.equal(1);
                expect(q.length()).to.equal(0);
                done();
            };
        });

        it('zero concurrency', (done: () => void) =>
        {
            expect(() =>
            {
                async.queue((task: any, callback: (...args: any) => void): void =>
                {
                    callback(null, task);
                }, 0);
            }).to.throw();
            done();
        });

        it('error propagation', (done: () => void) =>
        {
            const results: Array<string> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callback(task.name === 'foo' ? new Error('fooError') : null);
            }, 2);

            q.drain = () =>
            {
                expect(results).to.eql(['bar', 'fooError']);
                done();
            };

            q.push({ name: 'bar' }, (err) =>
            {
                if (err)
                {
                    results.push('barError');

                    return;
                }

                results.push('bar');
            });

            q.push({ name: 'foo' }, (err) =>
            {
                if (err)
                {
                    results.push('fooError');

                    return;
                }

                results.push('foo');
            });
        });

        it('global error handler', (done: () => void) =>
        {
            const results: Array<string> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callback(task.name === 'foo' ? new Error('fooError') : null);
            }, 2);

            q.error = (error, task) =>
            {
                expect(error).to.exist;
                expect(error.message).to.equal('fooError');
                expect(task.name).to.equal('foo');
                results.push('fooError');
            };

            q.drain = () =>
            {
                expect(results).to.eql(['fooError', 'bar']);
                done();
            };

            q.push({ name: 'foo' });

            q.push({ name: 'bar' }, (err) =>
            {
                expect(err).to.not.exist;
                results.push('bar');
            });
        });

        // The original queue implementation allowed the concurrency to be changed only
        // on the same event loop during which a task was added to the queue. This
        // test attempts to be a more robust test.
        // Start with a concurrency of 1. Wait until a leter event loop and change
        // the concurrency to 2. Wait again for a later loop then verify the concurrency
        // Repeat that one more time by chaning the concurrency to 5.
        it('changing concurrency', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callback();
                }, 10);
            }, 1);

            for (let i = 0; i < 50; ++i)
            {
                q.push('');
            }

            q.drain = () =>
            {
                done();
            };

            setTimeout(() =>
            {
                expect(q.concurrency).to.equal(1);
                q.concurrency = 2;
                setTimeout(() =>
                {
                    expect(q.running()).to.equal(2);
                    q.concurrency = 5;
                    setTimeout(() =>
                    {
                        expect(q.running()).to.equal(5);
                    }, 40);
                }, 40);
            }, 40);
        });

        it('push without callback', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const delays = [40, 20, 60, 20];

            // worker1: --1-4
            // worker2: -2---3
            // order of completion: 2,1,4,3

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callback('error', 'arg');
                }, delays.shift());
            }, 2);

            q.push(1);
            q.push(2);
            q.push(3);
            q.push(4);

            q.drain = () =>
            {
                expect(callOrder).to.eql([
                    'process 2',
                    'process 1',
                    'process 4',
                    'process 3',
                ]);
                done();
            };
        });

        it('push with non-function', (done: () => void) =>
        {
            const q = async.queue(() => { /* empty */ }, 1);

            expect(() =>
            {
                q.push({}, 1);
            }).to.throw();
            done();
        });

        it('unshift', (done: () => void) =>
        {
            const queueOrder: Array<number> = [];

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                queueOrder.push(task);
                callback();
            }, 1);

            q.unshift(4);
            q.unshift(3);
            q.unshift(2);
            q.unshift(1);

            setTimeout(() =>
            {
                expect(queueOrder).to.eql([1, 2, 3, 4]);
                done();
            }, 100);
        });

        it('too many callbacks', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                callback();
                expect(() =>
                {
                    callback();
                }).to.throw();
                done();
            }, 2);

            q.push(1);
        });

        it('idle', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                // Queue is busy when workers are running
                expect(q.idle()).to.equal(false);
                callback();
            }, 1);

            // Queue is idle before anything added
            expect(q.idle()).to.equal(true);

            q.unshift(4);
            q.unshift(3);
            q.unshift(2);
            q.unshift(1);

            // Queue is busy when tasks added
            expect(q.idle()).to.equal(false);

            q.drain = () =>
            {
                // Queue is idle after drain
                expect(q.idle()).to.equal(true);
                done();
            };
        });

        it.skip('pause', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const taskTimeout = 80;
            const pauseTimeout = taskTimeout * 2.5;
            const resumeTimeout = taskTimeout * 4.5;
            const tasks = [1, 2, 3, 4, 5, 6];

            const elapsed = (() =>
            {
                const start = Date.now();

                return () => Math.round((Date.now() - start) / taskTimeout) * taskTimeout;
            })();

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                callOrder.push(`process ${task}`);
                callOrder.push(`timeout ${elapsed()}`);
                callback();
            });

            function pushTask()
            {
                const task = tasks.shift();

                if (!task)
                {
                    return;
                }

                setTimeout(() =>
                {
                    q.push(task);
                    pushTask();
                }, taskTimeout);
            }
            pushTask();

            setTimeout(() =>
            {
                q.pause();
                expect(q.paused).to.equal(true);
            }, pauseTimeout);

            setTimeout(() =>
            {
                q.resume();
                expect(q.paused).to.equal(false);
            }, resumeTimeout);

            setTimeout(() =>
            {
                expect(callOrder).to.eql([
                    'process 1', `timeout ${taskTimeout}`,
                    'process 2', `timeout ${(taskTimeout * 2)}`,
                    'process 3', `timeout ${(taskTimeout * 5)}`,
                    'process 4', `timeout ${(taskTimeout * 5)}`,
                    'process 5', `timeout ${(taskTimeout * 5)}`,
                    'process 6', `timeout ${(taskTimeout * 6)}`,
                ]);
                done();
            }, (taskTimeout * tasks.length) + pauseTimeout + resumeTimeout);
        });

        it('pause in worker with concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                if (task.isLongRunning)
                {
                    q.pause();
                    setTimeout(() =>
                    {
                        callOrder.push(task.id);
                        q.resume();
                        callback();
                    }, 50);
                }
                else
                {
                    callOrder.push(task.id);
                    setTimeout(callback, 10);
                }
            }, 10);

            q.push({ id: 1, isLongRunning: true });
            q.push({ id: 2 });
            q.push({ id: 3 });
            q.push({ id: 4 });
            q.push({ id: 5 });

            q.drain = () =>
            {
                expect(callOrder).to.eql([1, 2, 3, 4, 5]);
                done();
            };
        });

        it('pause with concurrency', (done: () => void) =>
        {
            const callOrder: Array<string> = [];
            const taskTimeout = 40;
            const pauseTimeout = taskTimeout / 2;
            const resumeTimeout = taskTimeout * 2.75;
            const tasks = [1, 2, 3, 4, 5, 6];

            const elapsed = (() =>
            {
                const start = Date.now();

                return () => Math.round((Date.now() - start) / taskTimeout) * taskTimeout;
            })();

            const q = async.queue((task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callOrder.push(`process ${task}`);
                    callOrder.push(`timeout ${elapsed()}`);
                    callback();
                }, taskTimeout);
            }, 2);

            for (let i = 0; i < tasks.length; ++i)
            {
                q.push(tasks[i]);
            }

            setTimeout(() =>
            {
                q.pause();
                expect(q.paused).to.equal(true);
            }, pauseTimeout);

            setTimeout(() =>
            {
                q.resume();
                expect(q.paused).to.equal(false);
            }, resumeTimeout);

            setTimeout(() =>
            {
                expect(q.running()).to.equal(2);
            }, resumeTimeout + 10);

            setTimeout(() =>
            {
                expect(callOrder).to.eql([
                    'process 1', `timeout ${taskTimeout}`,
                    'process 2', `timeout ${taskTimeout}`,
                    'process 3', `timeout ${(taskTimeout * 4)}`,
                    'process 4', `timeout ${(taskTimeout * 4)}`,
                    'process 5', `timeout ${(taskTimeout * 5)}`,
                    'process 6', `timeout ${(taskTimeout * 5)}`,
                ]);
                done();
            }, (taskTimeout * tasks.length) + pauseTimeout + resumeTimeout);
        });

        it('start paused', (done: () => void) =>
        {
            const q = async.queue((_task: any, callback: (...args: any) => void): void =>
            {
                setTimeout(() =>
                {
                    callback();
                }, 40);
            }, 2);

            q.pause();

            q.push(1);
            q.push(2);
            q.push(3);

            setTimeout(() =>
            {
                q.resume();
            }, 5);

            setTimeout(() =>
            {
                expect(q._tasks.length).to.equal(1);
                expect(q.running()).to.equal(2);
                q.resume();
            }, 15);

            q.drain = () =>
            {
                done();
            };
        });

        it('kill', (done: () => void) =>
        {
            const q = async.queue((/* task, callback */) =>
            {
                setTimeout(() =>
                {
                    throw new Error('Function should never be called');
                }, 20);
            }, 1);

            q.drain = () =>
            {
                throw new Error('Function should never be called');
            };

            q.push(0);

            q.kill();

            setTimeout(() =>
            {
                expect(q.length()).to.equal(0);
                done();
            }, 40);
        });

        it('events', (done: () => void) =>
        {
            const calls: Array<string> = [];
            const q = async.queue((task, cb) =>
            {
                // nop
                calls.push(`process ${task}`);
                setTimeout(cb, 10);
            }, 3);

            q.concurrency = 3;

            q.saturated = () =>
            {
                expect(q.running()).to.equal(3, 'queue should be saturated now');
                calls.push('saturated');
            };
            q.empty = () =>
            {
                expect(q.length()).to.equal(0, 'queue should be empty now');
                calls.push('empty');
            };
            q.drain = () =>
            {
                expect(q.length() === 0 && q.running() === 0)
                    .to.equal(true, 'queue should be empty now and no more workers should be running');
                calls.push('drain');
                expect(calls).to.eql([
                    'process foo',
                    'process bar',
                    'saturated',
                    'process zoo',
                    'foo cb',
                    'saturated',
                    'process poo',
                    'bar cb',
                    'empty',
                    'saturated',
                    'process moo',
                    'zoo cb',
                    'poo cb',
                    'moo cb',
                    'drain',
                ]);
                done();
            };
            q.push('foo', () => calls.push('foo cb'));
            q.push('bar', () => calls.push('bar cb'));
            q.push('zoo', () => calls.push('zoo cb'));
            q.push('poo', () => calls.push('poo cb'));
            q.push('moo', () => calls.push('moo cb'));
        });

        it('empty', (done: () => void) =>
        {
            const calls: Array<string> = [];
            const q = async.queue((task, cb) =>
            {
                // nop
                calls.push(`process ${task}`);
                setTimeout(cb, 1);
            }, 3);

            q.drain = () =>
            {
                expect(q.length() === 0 && q.running() === 0)
                    .to.equal(true, 'queue should be empty now and no more workers should be running');
                calls.push('drain');
                expect(calls).to.eql([
                    'drain',
                ]);
                done();
            };
            q.push();
        });

        it('saturated', (done: () => void) =>
        {
            let saturatedCalled = false;
            const q = async.queue((task, cb) =>
            {
                setTimeout(cb, 1);
            }, 2);

            q.saturated = () =>
            {
                saturatedCalled = true;
            };
            q.drain = () =>
            {
                expect(saturatedCalled).to.equal(true, 'saturated not called');
                done();
            };

            q.push('foo');
            q.push('bar');
            q.push('baz');
            q.push('moo');
        });

        it('started', (done: () => void) =>
        {
            const q = async.queue((task, cb) =>
            {
                cb(null, task);
            });

            expect(q.started).to.equal(false);
            q.push(undefined);
            expect(q.started).to.equal(true);
            done();
        });

        context('q.saturated(): ', () =>
        {
            it('should call the saturated callback if tasks length is concurrency', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 4);

                q.saturated = () =>
                {
                    calls.push('saturated');
                };
                q.empty = () =>
                {
                    expect(calls.indexOf('saturated')).to.be.above(-1);
                    setTimeout(() =>
                    {
                        expect(calls).eql([
                            'process foo0',
                            'process foo1',
                            'process foo2',
                            'saturated',
                            'process foo3',
                            'foo0 cb',
                            'saturated',
                            'process foo4',
                            'foo1 cb',
                            'foo2 cb',
                            'foo3 cb',
                            'foo4 cb',
                        ]);
                        done();
                    }, 50);
                };
                q.push('foo0', () => calls.push('foo0 cb'));
                q.push('foo1', () => calls.push('foo1 cb'));
                q.push('foo2', () => calls.push('foo2 cb'));
                q.push('foo3', () => calls.push('foo3 cb'));
                q.push('foo4', () => calls.push('foo4 cb'));
            });
        });

        context('q.unsaturated(): ', () =>
        {
            it('should have a default buffer property that equals 25% of the concurrenct rate', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    // nop
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 10);

                expect(q.buffer).to.equal(2.5);
                done();
            });
            it('should allow a user to change the buffer property', (done: () => void) =>
            {
                const calls: Array<string> = [];
                const q = async.queue((task, cb) =>
                {
                    // nop
                    calls.push(`process ${task}`);
                    setTimeout(cb, 1);
                }, 10);

                q.buffer = 4;
                expect(q.buffer).to.not.equal(2.5);
                expect(q.buffer).to.equal(4);
                done();
            });
            it('should call the unsaturated callback if tasks length is less than concurrency minus buffer',
                (done: () => void) =>
                { // eslint-disable-line max-len
                    const calls: Array<string> = [];
                    const q = async.queue((task: any, cb: () => void) =>
                    {
                        calls.push(`process ${task}`);
                        setTimeout(cb, 1);
                    }, 4);

                    q.unsaturated = () =>
                    {
                        calls.push('unsaturated');
                    };
                    q.empty = () =>
                    {
                        expect(calls.indexOf('unsaturated')).to.be.above(-1);
                        setTimeout(() =>
                        {
                            expect(calls).eql([
                                'process foo0',
                                'process foo1',
                                'process foo2',
                                'process foo3',
                                'foo0 cb',
                                'unsaturated',
                                'process foo4',
                                'foo1 cb',
                                'unsaturated',
                                'foo2 cb',
                                'unsaturated',
                                'foo3 cb',
                                'unsaturated',
                                'foo4 cb',
                                'unsaturated',
                            ]);
                            done();
                        }, 50);
                    };
                    q.push('foo0', () => calls.push('foo0 cb'));
                    q.push('foo1', () => calls.push('foo1 cb'));
                    q.push('foo2', () => calls.push('foo2 cb'));
                    q.push('foo3', () => calls.push('foo3 cb'));
                    q.push('foo4', () => calls.push('foo4 cb'));
                });
        });
    });

    describe('eachSeries', () =>
    {
        function eachIteratee(args: Array<any>, x: number, callback: () => void)
        {
            setTimeout(() =>
            {
                args.push(x);
                callback();
            }, x * 25);
        }

        function eachNoCallbackIteratee(done: () => void, x: number, callback: () => void)
        {
            expect(x).to.equal(1);
            callback();
            done();
        }

        it('eachSeries', (done: () => void) =>
        {
            const args: Array<number> = [];

            async.eachSeries([1, 3, 2], eachIteratee.bind({ }, args), (err) =>
            {
                expect(err).to.equal(undefined, `${err} passed instead of 'null'`);
                expect(args).to.eql([1, 3, 2]);
                done();
            });
        });

        it('empty array', (done: () => void) =>
        {
            async.eachSeries([], (x: number, callback: () => void) =>
            {
                expect(false).to.equal(true, 'iteratee should not be called');
                callback();
            }, (err) =>
            {
                if (err)
                {
                    throw err;
                }

                expect(true).to.equal(true, 'should call callback');
            });
            setTimeout(done, 25);
        });

        it('array modification', (done: () => void) =>
        {
            const arr = [1, 2, 3, 4];

            async.eachSeries(arr, (x, callback) =>
            {
                setTimeout(callback, 1);
            }, () =>
            {
                expect(true).to.equal(true, 'should call callback');
            });

            arr.pop();
            arr.splice(0, 1);

            setTimeout(done, 50);
        });

        // bug #782.  Remove in next major release
        it('single item', (done: () => void) =>
        {
            let sync = true;

            async.eachSeries(
                [1],
                (i, cb) =>
                {
                    cb(null);
                },
                () =>
                {
                    expect(sync).to.equal(true, 'callback not called on same tick');
                }
            );
            sync = false;
            done();
        });

        // bug #782.  Remove in next major release
        it('single item', (done: () => void) =>
        {
            let sync = true;

            async.eachSeries(
                [1],
                (i, cb) =>
                {
                    cb(null);
                },
                () =>
                {
                    expect(sync).to.equal(true, 'callback not called on same tick');
                }
            );
            sync = false;
            done();
        });

        it('error', (done: () => void) =>
        {
            const callOrder: Array<string> = [];

            async.eachSeries(
                [1, 2, 3],
                (x: any, callback: (x: string) => void) =>
                {
                    callOrder.push(x);
                    callback('error');
                },
                (err: string) =>
                {
                    expect(callOrder).to.eql([1]);
                    expect(err).to.equal('error');
                }
            );
            setTimeout(done, 50);
        });

        it('no callback', (done: () => void) =>
        {
            async.eachSeries([1], eachNoCallbackIteratee.bind(this, done));
        });
    });
});
