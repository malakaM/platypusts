module plat.async {
    'use strict';
    var __promiseQueue: Array<any> = [],
        browserGlobal: any = (typeof window !== 'undefined') ? window : {},
        BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver,
        process: any = process,
        scheduleFlush: () => void;

    // decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
        scheduleFlush = useNextTick();
    } else if (BrowserMutationObserver) {
        scheduleFlush = useMutationObserver();
    } else {
        scheduleFlush = useSetTimeout();
    }

    /**
     * @name Promise
     * @memberof plat.async
     * @kind class
     * 
     * @implements {plat.async.IThenable}
     * 
     * @description
     * Takes in a generic type corresponding to the fullfilled success type. 
     * 
     * @typeparam {any} R The return type of the promise.
     */
    export class Promise<R> implements IThenable<R> {
        /**
         * @name config
         * @memberof plat.async.Promise
         * @kind property
         * @access public
         * @static
         * 
         * @type {any}
         * 
         * @description
         * The configuration for creating asynchronous promise flushing.
         */
        static config: { async: (callback: (arg?: IThenable<any>) => void, arg?: IThenable<any>) => void; } = {
            /**
             * Handles asynchronous flushing of callbacks. If the callback queue is of 
             * length 1, then we need to schedule a flush. Afterward, any additional 
             * callbacks added to the queue will be flushed accordingly.
             */
            async: (callback: (arg?: IThenable<any>) => void, arg?: IThenable<any>): void => {
                var length = __promiseQueue.push([callback, arg]);
                if (length === 1) {
                    scheduleFlush();
                }
            }
        };

        /**
         * @name __subscribers
         * @memberof plat.async.Promise
         * @kind property
         * @access private
         * 
         * @type {Array<any>}
         * 
         * @description
         * Holds all the subscriber promises
         */
        private __subscribers: Array<any>;

        /**
         * @name __state
         * @memberof plat.async.Promise
         * @kind property
         * @access private
         * 
         * @type {plat.async.State}
         * 
         * @description
         * The state of the promise (fulfilled/rejected)
         */
        private __state: State;

        /**
         * @name __detail
         * @memberof plat.async.Promise
         * @kind property
         * @access private
         * 
         * @type {any}
         * 
         * @description
         * The return detail of a promise.
         */
        private __detail: any;

        /**
         * @name all
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * @variation 0
         * 
         * @description
         * Returns a promise that fulfills when every item in the array is fulfilled.
         * Casts arguments to promises if necessary. The result argument of the 
         * returned promise is an array containing the fulfillment result arguments 
         * in-order. The rejection argument is the rejection argument of the 
         * first-rejected promise.
         * 
         * @typeparam {any} R The return type of the promises.
         * 
         * @param {Array<plat.async.IThenable<R>>} promises An array of promises, although every argument is potentially
         * cast to a promise meaning not every item in the array needs to be a promise.
         * 
         * @returns {plat.async.IThenable<Array<R>>} A promise that resolves after all the input promises resolve.
         */
        static all<R>(promises: Array<IThenable<R>>): IThenable<Array<R>>;
        /**
         * @name all
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * @variation 1
         * 
         * @description
         * Returns a promise that fulfills when every item in the array is fulfilled.
         * Casts arguments to promises if necessary. The result argument of the 
         * returned promise is an array containing the fulfillment result arguments 
         * in-order. The rejection argument is the rejection argument of the 
         * first-rejected promise.
         * 
         * @typeparam {any} R The type of the promises.
         * 
         * @param {Array<R>} promises An array of objects, if an object is not a promise, it will be cast.
         * 
         * @returns {plat.async.IThenable<Array<R>>} A promise that resolves after all the input promises resolve.
         */
        static all<R>(promises: Array<R>): IThenable<Array<R>>;
        static all(promises: Array<any>): IThenable<Array<any>> {
            if (!isArray(promises)) {
                return Promise.all([promises]);
            }

            return new Promise<Array<any>>((resolve: (value?: Array<any>) => void, reject: (reason?: any) => void): void => {
                var results: Array<any> = [],
                    remaining = promises.length,
                    promise: Promise<any>;

                if (remaining === 0) {
                    resolve(<any>[]);
                }

                function resolver(index: number): (value: any) => void {
                    return (value: any): void => resolveAll(index, value);
                }

                function resolveAll(index: number, value: any): void {
                    results[index] = value;
                    if (--remaining === 0) {
                        resolve(<any>results);
                    }
                }

                for (var i = 0; i < promises.length; i++) {
                    promise = promises[i];

                    if (isPromise(promise)) {
                        promise.then(resolver(i), reject);
                    } else {
                        resolveAll(i, promise);
                    }
                }
            });
        }

        /**
         * @name race
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * @variation 0
         * 
         * @description
         * Returns a promise that fulfills as soon as any of the promises fulfill,
         * or rejects as soon as any of the promises reject (whichever happens first).
         * 
         * @typeparam {any} R The return type of the input promises.
         * 
         * @param {Array<plat.async.IThenable<R>>} promises An Array of promises to 'race'.
         * 
         * @returns {plat.async.IThenable<R>} A promise that fulfills when one of the input 
         * promises fulfilled.
         */
        static race<R>(promises: Array<IThenable<R>>): IThenable<R>;
        /**
         * @name race
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * @variation 1
         * 
         * @description
         * Returns a promise that fulfills as soon as any of the promises fulfill,
         * or rejects as soon as any of the promises reject (whichever happens first).
         * 
         * @typeparam {any} R The type of the input objects.
         * 
         * @param {Array<R>} promises An Array of anything to 'race'. Objects that aren't promises will
         * be cast.
         * 
         * @returns {plat.async.IThenable<R>} A promise that fulfills when one of the input 
         * promises fulfilled.
         */
        static race<R>(promises: Array<R>): IThenable<R>;
        static race(promises: Array<any>): IThenable<any> {
            if (!isArray(promises)) {
                return Promise.race([promises]);
            }

            return new Promise<any>((resolve: (value: any) => any, reject: (error: any) => any): void => {
                var promise: Promise<any>;

                for (var i = 0; i < promises.length; i++) {
                    promise = promises[i];

                    if (promise && typeof promise.then === 'function') {
                        promise.then(resolve, reject);
                    } else {
                        resolve(<any>promise);
                    }
                }
            });
        }

        /**
         * @name resolve
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a promise that resolves immediately.
         * 
         * @returns {plat.async.IThenable<void>} A promise that will resolve.
         */
        static resolve(): IThenable<void>;
        /**
         * @name resolve
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a promise that resolves with the input value.
         * 
         * @typeparam {any} R The value with which to resolve the promise.
         * 
         * @param {R} value The value to resolve.
         * 
         * @returns {plat.async.IThenable<R>} A promise that will resolve with the associated value.
         */
        static resolve<R>(value: R): IThenable<R>;
        static resolve<R>(value?: R): IThenable<R> {
            return new Promise<R>((resolve: (value: R) => any, reject: (reason: any) => any): void => {
                resolve(value);
            });
        }

        /**
         * @name reject
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a promise that rejects with the input value.
         * 
         * @param {any} error The value to reject.
         * 
         * @returns {plat.async.IThenable<any>} A promise that will reject with the error.
         */
        static reject(error?: any): IThenable<any> {
            return new Promise<any>((resolve: (value: any) => any, reject: (error: any) => any): void => {
                reject(error);
            });
        }

        /**
         * @name __invokeResolveFunction
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Invokes the resolve function for a promise. Handles error catching.
         * 
         * @typeparam {any} R The return type of the input {@link plat.async.Promise|Promise}.
         * 
         * @param {plat.async.IResolveFunction<R>} resolveFunction The resolve function to invoke.
         * @param {plat.async.Promise<R>} promise The promise on which to invoke the resolve function.
         * 
         * @returns {void}
         */
        private static __invokeResolveFunction<R>(resolveFunction: IResolveFunction<R>,
            promise: Promise<R>): void {
            function resolvePromise(value?: any): void {
                Promise.__resolve<R>(promise, value);
            }

            function rejectPromise(reason?: any): void {
                Promise.__reject(promise, reason);
            }

            try {
                resolveFunction(resolvePromise, rejectPromise);
            } catch (e) {
                rejectPromise(e);
            }
        }

        /**
         * @name __invokeCallback
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Invokes a callback for a promise with the specified detail.
         * 
         * @param {plat.async.State} settled The state of the promise.
         * @param {any} promise The promise object.
         * @param {(response: any) => void} callback The callback to invoke.
         * @param {any} detail The details to pass to the callback.
         * 
         * @returns {void}
         */
        private static __invokeCallback(settled: State, promise: any, callback: (response: any) => void, detail: any): void {
            var hasCallback = isFunction(callback),
                value: any,
                error: Error,
                succeeded: boolean,
                failed: boolean;

            if (hasCallback) {
                try {
                    value = callback(detail);
                    succeeded = true;
                } catch (e) {
                    failed = true;
                    error = e;
                }
            } else {
                value = detail;
                succeeded = true;
            }

            if (Promise.__handleThenable<any>(promise, value)) {
                return;
            } else if (hasCallback && succeeded) {
                Promise.__resolve<any>(promise, value);
            } else if (failed) {
                Promise.__reject(promise, error);
            } else if (settled === State.FULFILLED) {
                Promise.__resolve<any>(promise, value);
            } else if (settled === State.REJECTED) {
                Promise.__reject(promise, value);
            }
        }

        /**
         * @name __publish
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Publishes the promise details to all the subscribers for a promise.
         * 
         * @param {any} promise The promise object.
         * @param {plat.async.State} settled The state of the promise.
         * 
         * @returns {void}
         */
        private static __publish(promise: Promise<any>, settled: State): void {
            var subscribers = promise.__subscribers,
                detail = promise.__detail,
                child: any,
                callback: () => void;

            for (var i = 0; i < subscribers.length; i += 3) {
                child = subscribers[i];
                callback = subscribers[i + settled];

                Promise.__invokeCallback(settled, child, callback, detail);
            }

            promise.__subscribers = null;
        }

        /**
         * @name __publishFulfillment
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Publishes a promises that has been fulfilled.
         * 
         * @param {any} promise The promise object.
         * 
         * @returns {void}
         */
        private static __publishFulfillment(promise: any): void {
            Promise.__publish(promise, promise.__state = State.FULFILLED);
        }

        /**
         * @name __publishRejection
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Publishes a promises that has been rejected.
         * 
         * @param {any} promise The promise object.
         * 
         * @returns {void}
         */
        private static __publishRejection(promise: any): void {
            Promise.__publish(promise, promise.__state = State.REJECTED);
        }

        /**
         * @name __reject
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Asynchronously rejects a promise
         * 
         * @param {any} promise The promise object.
         * @param {any} reason The detail of the rejected promise.
         * 
         * @returns {void}
         */
        private static __reject(promise: any, reason: any): void {
            if (promise.__state !== State.PENDING) {
                return;
            }
            promise.__state = State.SEALED;
            promise.__detail = reason;

            Promise.config.async(Promise.__publishRejection, promise);
        }

        /**
         * @name __fulfill
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Asynchronously fulfills a promise
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.Promise<R>} promise The promise object.
         * @param {any} value The detail of the fulfilled promise.
         * 
         * @returns {void}
         */
        private static __fulfill<R>(promise: Promise<R>, value: any): void {
            if (promise.__state !== State.PENDING) {
                return;
            }
            promise.__state = State.SEALED;
            promise.__detail = value;

            Promise.config.async(Promise.__publishFulfillment, promise);
        }

        /**
         * @name __resolve
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Asynchronously fulfills a promise, allowing for promise chaining.
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.Promise<R>} promise The promise object.
         * @param {any} value The detail of the fulfilled promise.
         * 
         * @returns {void}
         */
        private static __resolve<R>(promise: Promise<R>, value: any): void {
            if (promise === value) {
                Promise.__fulfill(promise, value);
            } else if (!Promise.__handleThenable<R>(promise, value)) {
                Promise.__fulfill(promise, value);
            }
        }

        /**
         * @name __handleThenable
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Handles chaining promises together, when a promise is returned from within a then handler.
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.Promise<R>} promise The promise object.
         * @param {plat.async.Promise<R>} value The next promise to await.
         * 
         * @returns {boolean} Whether or not the value passed in is a promise.
         */
        private static __handleThenable<R>(promise: Promise<R>, value: Promise<R>): boolean {
            var resolved: boolean;

            if (promise === value) {
                Promise.__reject(promise, new TypeError('A promises callback cannot return the same promise.'));
                return true;
            }

            if (isPromise(value)) {
                try {
                    value.then.call(value, (val: any): boolean => {
                        if (resolved) {
                            return true;
                        }
                        resolved = true;

                        if (value !== val) {
                            Promise.__resolve<R>(promise, val);
                        } else {
                            Promise.__fulfill<R>(promise, val);
                        }
                    }, (val: any): boolean => {
                        if (resolved) {
                            return true;
                        }
                        resolved = true;

                        Promise.__reject(promise, val);
                    });

                    return true;
                } catch (error) {
                    if (resolved) {
                        return true;
                    }
                    Promise.__reject(promise, error);
                    return true;
                }
            }

            return false;
        }

        /**
         * @name __subscribe
         * @memberof plat.async.Promise
         * @kind function
         * @access private
         * @static
         * 
         * @description
         * Adds a child promise to the parent's subscribers.
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.Promise<any>} parent The parent promise.
         * @param {plat.async.Promise<any>} value The child promise.
         * @param {(success: any) => any} onFullfilled The fulfilled method for the child.
         * @param {(error: any) => any} onRejected The rejected method for the child.
         * 
         * @returns {void}
         */
        private static __subscribe(parent: Promise<any>, child: IThenable<any>,
            onFulfilled: (success: any) => any, onRejected: (error: any) => any): void {
            var subscribers = parent.__subscribers;
            var length = subscribers.length;

            subscribers[length] = child;
            subscribers[length + State.FULFILLED] = onFulfilled;
            subscribers[length + State.REJECTED] = onRejected;
        }

        /**
         * @name constructor
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * 
         * @description
         * An ES6 implementation of the Promise API. Useful for asynchronous programming.
         * Takes in 2 generic types corresponding to the fullfilled success and error types. 
         * The error type (U) should extend Error in order to get proper stack tracing.
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.IResolveFunction<R>} resolveFunction A IResolveFunction for fulfilling/rejecting the Promise.
         * 
         * @returns {plat.async.Promise<R>} A promise object.
         */
        constructor(resolveFunction: IResolveFunction<R>) {
            if (!isFunction(resolveFunction)) {
                throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
            }

            if (!(this instanceof Promise)) {
                throw new TypeError('Failed to construct "Promise": ' +
                    'Please use the "new" operator, this object constructor cannot be called as a function.');
            }

            this.__subscribers = [];

            Promise.__invokeResolveFunction<R>(resolveFunction, this);
        }

        /**
         * @name then
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 0
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => plat.async.IThenable<U>} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => plat.async.IThenable<U>} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => IThenable<U>, onRejected?: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 1
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => plat.async.IThenable<U>} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => U} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => IThenable<U>, onRejected?: (error: any) => U): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 2
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => U} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => plat.async.IThenable<U>} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => U, onRejected?: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 3
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => U} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => U} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => U, onRejected?: (error: any) => U): IThenable<U>;
        then<U>(onFulfilled: (success: R) => any, onRejected?: (error: any) => any): IThenable<U> {
            var promise = this;

            var thenPromise = <IThenable<U>>new (<any>this).constructor(noop, this);

            if (this.__state) {
                var callbacks = arguments;
                Promise.config.async((): void => {
                    Promise.__invokeCallback(promise.__state, thenPromise, callbacks[promise.__state - 1], promise.__detail);
                });
            } else {
                Promise.__subscribe(this, thenPromise, onFulfilled, onRejected);
            }

            return thenPromise;
        }

        /**
         * @name catch
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 0
         * 
         * @description
         * A wrapper method for {@link plat.async.Promise|Promise.then(undefined, onRejected);}
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(error: any) => plat.async.IThenable<U>} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        catch<U>(onRejected: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name catch
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * @variation 1
         * 
         * @description
         * A wrapper method for {@link plat.async.Promise|Promise.then(undefined, onRejected);}
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(error: any) => U} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        catch<U>(onRejected: (error: any) => U): IThenable<U>;
        catch<U>(onRejected: (error: any) => any): IThenable<U> {
            return this.then(null, onRejected);
        }

        /**
         * @name toString
         * @memberof plat.async.Promise
         * @kind function
         * @access public
         * 
         * @description
         * Outputs the Promise as a readable string.
         * 
         * @returns {string} `[object Promise]`
         */
        toString(): string {
            return '[object Promise]';
        }
    }

    /**
     * @name IThenable
     * @memberof plat.async
     * @kind interface
     * 
     * @description
     * Describes a chaining function that fulfills when the previous link is complete and is 
     * able to be caught in the case of an error.
     * 
     * @typeparam {any} R The return type of the thenable.
     */
    export interface IThenable<R> {
        /**
         * @name then
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 0
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => plat.async.IThenable<U>} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => plat.async.IThenable<U>} onRejected? A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => IThenable<U>, onRejected?: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 1
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => plat.async.IThenable<U>} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => U} onRejected? A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => IThenable<U>, onRejected?: (error: any) => U): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 2
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => U} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => plat.async.IThenable<U>} onRejected? A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => U, onRejected?: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name then
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 3
         * 
         * @description
         * Takes in two methods, called when/if the promise fulfills/rejects.
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(success: R) => U} onFulfilled A method called when/if the promise fulills. If undefined the next
         * onFulfilled method in the promise chain will be called.
         * @param {(error: any) => U} onRejected? A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        then<U>(onFulfilled: (success: R) => U, onRejected?: (error: any) => U): IThenable<U>;

        /**
         * @name catch
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 0
         * 
         * @description
         * A wrapper method for {@link plat.async.Promise|Promise.then(undefined, onRejected);}
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(error: any) => plat.async.IThenable<U>} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        catch<U>(onRejected: (error: any) => IThenable<U>): IThenable<U>;
        /**
         * @name catch
         * @memberof plat.async.IThenable
         * @kind function
         * @access public
         * @variation 1
         * 
         * @description
         * A wrapper method for {@link plat.async.Promise|Promise.then(undefined, onRejected);}
         * 
         * @typeparam {any} U The return type of the returned promise.
         * 
         * @param {(error: any) => U} onRejected A method called when/if the promise rejects. If undefined the next
         * onRejected method in the promise chain will be called.
         * 
         * @returns {plat.async.IThenable<U>} A promise that resolves with the input type parameter U.
         */
        catch<U>(onRejected: (error: any) => U): IThenable<U>;
    }

    enum State {
        PENDING = <any>(void 0),
        SEALED = 0,
        FULFILLED = 1,
        REJECTED = 2
    };

    // node
    function useNextTick(): () => void {
        return (): void => {
            process.nextTick(flush);
        };
    }

    function useMutationObserver(): () => void {
        var observer = new BrowserMutationObserver(flush),
            _document = acquire(__Document),
            _window = acquire(__Window),
            element = _document.createElement('div');

        observer.observe(element, { attributes: true });

        _window.addEventListener('unload', (): void => {
            observer.disconnect();
            observer = null;
        }, false);

        return (): void => {
            element.setAttribute('drainQueue', 'drainQueue');
        };
    }

    function useSetTimeout(): () => void {
        var global: any = global,
            local = (typeof global !== 'undefined') ? global : this;

        return (): void => {
            local.setTimeout(flush, 1);
        };
    }

    function flush(): void {
        var tuple: Array<(response: any) => void>,
            callback: (response: any) => void,
            arg: any;

        for (var i = 0; i < __promiseQueue.length; i++) {
            tuple = __promiseQueue[i];
            callback = tuple[0];
            arg = tuple[1];
            callback(arg);
        }
        __promiseQueue = [];
    }

    /**
     * Describes a function passed into the constructor for a Promise. The function allows you to
     * resolve/reject the Promise.
     */
    export interface IResolveFunction<R> {
        /**
         * A function which allows you to resolve/reject a Promise.
         * 
         * @param resolve A method for resolving a Promise. If you pass in a 'thenable' argument 
         * (meaning if you pass in a Promise-like object), then the promise will resolve with the 
         * outcome of the object. Else the promise will resolve with the argument.
         * @param reject A method for rejecting a promise. The argument should be an instancof Error
         * to assist with debugging. If a method in the constructor for a Promise throws an error, 
         * the promise will reject with the error.
         */
        (resolve: (value?: R) => void, reject: (reason?: any) => void): void;
    }

    /**
     * The Type for referencing the '_Promise' injectable as a dependency.
     */
    export function IPromise(_window?: any): IPromise {
        if (!isNull(_window.Promise) &&
            isFunction(_window.Promise.all) &&
            isFunction(_window.Promise.race) &&
            isFunction(_window.Promise.resolve) &&
            isFunction(_window.Promise.reject)) {
            return _window.Promise;
        }
        return Promise;
    }

    register.injectable(__Promise, IPromise, [__Window], __CLASS);

    /**
     * @name IPromise
     * @memberof plat.async
     * @kind interface
     * 
     * @description
     * The injectable reference for the ES6 Promise implementation.
     */
    export interface IPromise {
        /**
         * @name constructor
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * 
         * @description
         * An ES6 implementation of the Promise API. Useful for asynchronous programming.
         * Takes in 2 generic types corresponding to the fullfilled success and error types. 
         * The error type (U) should extend Error in order to get proper stack tracing.
         * 
         * @typeparam {any} R The return type of the promise.
         * 
         * @param {plat.async.IResolveFunction<R>} resolveFunction A IResolveFunction for fulfilling/rejecting the Promise.
         * 
         * @returns {plat.async.IThenable<R>} A promise object.
         */
        new <R>(resolveFunction: IResolveFunction<R>): IThenable<R>;

        /**
         * @name all
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 0
         * 
         * @description
         * Returns a promise that fulfills when every item in the array is fulfilled.
         * Casts arguments to promises if necessary. The result argument of the
         * returned promise is an array containing the fulfillment result arguments
         * in-order. The rejection argument is the rejection argument of the
         * first-rejected promise.
         * 
         * @typeparam {any} R The return type of the promises.
         * 
         * @param {Array<plat.async.IThenable<R>>} promises An array of promises, although every argument is potentially
         * cast to a promise meaning not every item in the array needs to be a promise.
         * 
         * @returns {plat.async.IThenable<Array<R>>} A promise that resolves after all the input promises resolve.
         */
        all<R>(promises: Array<IThenable<R>>): IThenable<Array<R>>;
        /**
         * @name all
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 1
         * 
         * @description
         * Returns a promise that fulfills when every item in the array is fulfilled.
         * Casts arguments to promises if necessary. The result argument of the 
         * returned promise is an array containing the fulfillment result arguments 
         * in-order. The rejection argument is the rejection argument of the 
         * first-rejected promise.
         * 
         * @typeparam {any} R The type of the promises.
         * 
         * @param {Array<R>} promises An array of objects, if an object is not a promise, it will be cast.
         * 
         * @returns {plat.async.IThenable<Array<R>>} A promise that resolves after all the input promises resolve.
         */
        all<R>(promises: Array<R>): IThenable<Array<R>>;

        /**
         * @name race
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 0
         * 
         * @description
         * Returns a promise that fulfills as soon as any of the promises fulfill,
         * or rejects as soon as any of the promises reject (whichever happens first).
         * 
         * @typeparam {any} R The return type of the input promises.
         * 
         * @param {Array<plat.async.IThenable<R>>} promises An Array of promises to 'race'.
         * 
         * @returns {plat.async.IThenable<R>} A promise that fulfills when one of the input 
         * promises fulfilled.
         */
        race<R>(promises: Array<IThenable<R>>): IThenable<R>;
        /**
         * @name race
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 1
         * 
         * @description
         * Returns a promise that fulfills as soon as any of the promises fulfill,
         * or rejects as soon as any of the promises reject (whichever happens first).
         * 
         * @typeparam {any} R The type of the input objects.
         * 
         * @param {Array<R>} promises An Array of anything to 'race'. Objects that aren't promises will
         * be cast.
         * 
         * @returns {plat.async.IThenable<R>} A promise that fulfills when one of the input 
         * promises fulfilled.
         */
        race<R>(promises: Array<R>): IThenable<R>;

        /**
         * @name resolve
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 0
         * 
         * @description
         * Returns a promise that resolves immediately.
         * 
         * @returns {plat.async.IThenable<void>} A promise that will resolve.
         */
        resolve(): IThenable<void>;
        /**
         * @name resolve
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * @variation 1
         * 
         * @description
         * Returns a promise that resolves with the input value.
         * 
         * @typeparam {any} R The value with which to resolve the promise.
         * 
         * @param {R} value The value to resolve.
         * 
         * @returns {plat.async.IThenable<R>} A promise that will resolve with the associated value.
         */
        resolve<R>(value: R): IThenable<R>;

        /**
         * @name reject
         * @memberof plat.async.IPromise
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a promise that rejects with the input value.
         * 
         * @param {any} value The value to reject.
         * 
         * @returns {plat.async.IThenable<any>} A promise that will reject with the error.
         */
        reject(error?: any): IThenable<any>;
    }
}
