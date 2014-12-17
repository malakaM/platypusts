﻿/* tslint:disable:no-unused-variable */
var __nativeIsArray = !!Array.isArray,
    __uids__: plat.IObject<Array<string>> = {},
    objToString = Object.prototype.toString,
    toStringClass = '[object ',
    errorClass = toStringClass + 'Error]',
    fileClass = toStringClass + 'File]',
    arrayClass = toStringClass + 'Array]',
    boolClass = toStringClass + 'Boolean]',
    dateClass = toStringClass + 'Date]',
    funcClass = toStringClass + 'Function]',
    numberClass = toStringClass + 'Number]',
    objectClass = toStringClass + 'Object]',
    regexpClass = toStringClass + 'RegExp]',
    stringClass = toStringClass + 'String]',
    promiseClass = toStringClass + 'Promise]',
    objectTypes: any = {
        'boolean': false,
        'function': true,
        'object': true,
        'number': false,
        'string': false,
        'undefined': false
    };

function noop(): void { }

function extend(destination: any, ...sources: any[]): any {
    if (isNull(destination)) {
        return destination;
    }

    var deep = isBoolean(destination);

    if (deep) {
        destination = sources.shift();
    }

    var keys: Array<string>,
        property: any;

    forEach((source, k) => {
        if (!isObject(source)) {
            return;
        }

        keys = Object.keys(source);

        forEach((key) => {
            property = source[key];
            if (deep) {
                if (isArray(property)) {
                    extend(deep, destination[key] || (destination[key] = []), property);
                    return;
                } else if (isDate(property)) {
                    destination[key] = new Date(property.getTime());
                    return;
                } else if (isRegExp(property)) {
                    destination[key] = new RegExp(property);
                    return;
                } else if (isNode(property)) {
                    destination[key] = (<Node>property).cloneNode(true);
                    return;
                } else if (isObject(property)) {
                    extend(deep, destination[key] || (destination[key] = {}), property);
                    return;
                }
            }
            destination[key] = property;
        }, keys);
    }, sources);

    return destination;
}

function deepExtend(destination: any, ...sources: any[]): any {
    return extend.apply(null, [true, destination].concat(sources));
}

function _clone(obj: any, deep?: boolean) {
    if (!isObject(obj)) {
        return obj;
    } else if (isDate(obj)) {
        return new Date((<Date>obj).getTime());
    } else if (isRegExp(obj)) {
        return new RegExp(obj);
    } else if (isNode(obj)) {
        return (<Node>obj).cloneNode(deep);
    } else if (isError(obj)) {
        return new obj.constructor((<Error>obj).message);
    }

    var type = {};

    if (isArray(obj)) {
        type = [];
    }

    if (isBoolean(deep) && deep) {
        return deepExtend(type, obj);
    }

    return extend(type, obj);
}

function isError(obj: any): boolean {
    return objToString.call(obj) === errorClass;
}

function isObject(obj: any): boolean {
    return obj != null && typeof obj === 'object';
}

function isWindow(obj: any): boolean {
    return !!(obj && obj.document && obj.setInterval);
}

function isDocument(obj: any): boolean {
    return !!(obj && obj.nodeType === Node.DOCUMENT_NODE);
}

function isNode(obj: any): boolean {
    return !!(obj && typeof obj.nodeType === 'number');
}

function isDocumentFragment(obj: any): boolean {
    return !!(obj && (<Node>obj).nodeType === Node.DOCUMENT_FRAGMENT_NODE);
}

function isFile(obj: any): boolean {
    return typeof obj === 'object' && objToString.call(obj) === fileClass;
}

function isString(obj: any): boolean {
    return typeof obj === 'string' || typeof obj === 'object' && objToString.call(obj) === stringClass;
}

function isRegExp(obj: any): boolean {
    return typeof obj === 'object' && objToString.call(obj) === regexpClass;
}

function isPromise(obj: any): boolean {
    return typeof obj === 'object' && (objToString.call(obj) === promiseClass || isFunction(obj.then));
}

function isEmpty(obj: any): boolean {
    if (isNull(obj)) {
        return true;
    }

    if (isString(obj) || isArray(obj)) {
        return obj.length === 0;
    }

    if (!isObject(obj)) {
        return false;
    }

    return Object.keys(obj).length === 0;
}

function isBoolean(obj: any): boolean {
    return obj === true || obj === false || typeof obj === 'object' && objToString.call(obj) === boolClass;
}

function isNumber(obj: any): boolean {
    return (typeof obj === 'number' || typeof obj === 'object' && objToString.call(obj) === numberClass) && !isNaN(obj);
}

function isFunction(obj: any): boolean {
    return typeof obj === 'function';
}

function isNull(obj: any): boolean {
    return obj === null || obj === undefined;
}

function isUndefined(obj: any): boolean {
    return obj === undefined;
}

function isArray(obj: any): boolean {
    if (__nativeIsArray) {
        return Array.isArray(obj);
    }

    return objToString.call(obj) === arrayClass;
}

function isArrayLike(obj: any): boolean {
    if (isNull(obj) || isWindow(obj) || isFunction(obj)) {
        return false;
    }

    return isString(obj) || obj.length >= 0;
}

function isDate(obj: any): boolean {
    return typeof obj === 'object' && objToString.call(obj) === dateClass;
}

function filter<T>(iterator: (value: T, key: any, obj: any) => boolean, obj: any, context?: any): Array<T> {
    var arr: Array<T> = [];
    if (isNull(obj)) {
        return arr;
    }

    if (isFunction(obj.filter)) {
        return obj.filter(iterator, context);
    }

    forEach<T>((value: T, key: any, obj: any) => {
        if (iterator(value, key, obj)) {
            arr.push(value);
        }
    }, obj);

    return arr;
}

function where(properties: any, obj: any): Array<any> {
    return filter((value)
        => !some((property, key)
            => (<any>value)[key] !== property, properties), obj);
}

function forEach<T>(iterator: (value: T, index: number, obj: any) => void, array: Array<T>, context?: any): Array<T>;
function forEach<T>(iterator: (value: T, key: string, obj: any) => void, obj: any, context?: any): any;
function forEach<T>(iterator: (value: T, key: any, obj: any) => void, obj: any, context?: any): any {
    if (isNull(obj) || !(isObject(obj) || isArrayLike(obj))) {
        return obj;
    }

    var i: number,
        key: string,
        length: number;

    if (isFunction(obj.forEach)) {
        return obj.forEach(iterator, context);
    } else if (isArrayLike(obj)) {
        for (i = 0, length = obj.length; i < length; ++i) {
            iterator.call(context, obj[i], i, obj);
        }
    } else {
        var keys = Object.keys(obj);
        length = keys.length;
        while (keys.length > 0) {
            key = keys.shift();
            iterator.call(context, obj[key], key, obj);
        }
    }

    return obj;
}

function map<T, R>(iterator: (value: T, key: any, obj: any) => R, obj: any, context?: any): Array<R> {
    var arr: Array<R> = [];

    if (isNull(obj)) {
        return arr;
    }

    if (isFunction(obj.map)) {
        return obj.map(iterator, context);
    }

    forEach((value, key) => {
        arr.push(iterator.call(context, value, key, obj));
    }, obj);

    return arr;
}

var Promise: plat.async.IPromise;

function mapAsync<T, R>(iterator: (value: T, key: any, obj: any) => plat.async.IThenable<R>, obj: any, context?: any): plat.async.IThenable<Array<R>> {
    Promise = Promise || plat.acquire(__Promise);

    return Promise.all(map(iterator, obj, context));
}

function mapAsyncWithOrder<T, R>(iterator: (value: T, index: number, list: Array<T>) => plat.async.IThenable<R>,
    array: Array<T>, context: any, descending?: boolean): plat.async.IThenable<Array<R>> {
    Promise = Promise || plat.acquire(__Promise);
    var initialValue = Promise.resolve<Array<R>>([]);

    if (!isArray(array)) {
        return initialValue;
    }

    iterator = iterator.bind(context);

    var promise: plat.async.IThenable<Array<R>>,
        inOrder = (previousValue: plat.async.IThenable<Array<R>>, nextValue: T, nextIndex: number,
            array: Array<T>): plat.async.IThenable<Array<R>> => {
            return previousValue.then((items) => {
                return iterator(nextValue, nextIndex, array).then((moreItems) => {
                    return items.concat(moreItems);
                });
            });
        };

    if (descending === true) {
        return array.reduceRight(inOrder, initialValue);
    }

    return array.reduce(inOrder, initialValue);
}

function mapAsyncInOrder<T, R>(iterator: (value: T, index: number, list: Array<T>) => plat.async.IThenable<R>,
    array: Array<T>, context?: any): plat.async.IThenable<Array<R>> {
    return mapAsyncWithOrder(iterator, array, context);
}

function mapAsyncInDescendingOrder<T, R>(iterator: (value: T, index: number, list: Array<T>) => plat.async.IThenable<R>,
    array: Array<T>, context?: any): plat.async.IThenable<Array<R>> {
    return mapAsyncWithOrder(iterator, array, context, true);
}

function pluck<T, U>(key: string, obj: any): Array<U> {
    return map<T, U>((value) => (<any>value)[key], obj);
}

function some<T>(iterator: (value: T, key: any, obj: any) => boolean, obj: any, context?: any): boolean {
    if (isNull(obj) || isFunction(obj)) {
        return false;
    }

    var i: number,
        key: string,
        length: number,
        ret: boolean;

    if (isFunction(obj.some)) {
        return obj.some(iterator, context);
    } else if (isArrayLike(obj)) {
        for (i = 0, length = obj.length; i < length; ++i) {
            ret = iterator.call(context, obj[i], i, obj);
            if (ret === true) {
                return true;
            }
        }
    } else {
        var keys = Object.keys(obj);
        length = keys.length;
        while (keys.length > 0) {
            key = keys.shift();
            ret = iterator.call(context, obj[key], key, obj);
            if (ret === true) {
                return true;
            }
        }
    }

    return false;
}

function postpone(method: (...args: any[]) => void, args?: Array<any>, context?: any): plat.IRemoveListener {
    return defer(method, 0, args, context);
}


function defer(method: (...args: any[]) => void, timeout: number, args?: Array<any>, context?: any): plat.IRemoveListener {
    function defer() {
        method.apply(context, args);
    }

    var timeoutId = setTimeout(defer, timeout);

    return () => {
        clearTimeout(timeoutId);
    };
}

function uniqueId(prefix?: string): string {
    if (isNull(prefix)) {
        prefix = '';
    }

    var puid = __uids__[prefix];

    if (isNull(puid)) {
        puid = __uids__[prefix] = ['0', '/'];
    }

    var index = puid.length,
        charCode: number;

    while (index--) {
        charCode = puid[index].charCodeAt(0);
        // '9'
        if (charCode === 57) {
            puid[index] = 'A';
            return join();
        }

        // 'Z'
        if (charCode === 90) {
            puid[index] = 'a';
            return join();
        }

        // 'z'
        if (charCode === 122) {
            puid[index] = '0';
        } else {
            puid[index] = String.fromCharCode(charCode + 1);
            return join();
        }
    }

    puid.unshift('0');

    function join(): string {
        return prefix + puid.join('');
    }

    return join();
}

var camelCaseRegex: RegExp;

function camelCase(str: string): string {
    if (!isString(str) || isEmpty(str)) {
        return str;
    }

    str = str.charAt(0).toLowerCase() + str.slice(1);
    camelCaseRegex = camelCaseRegex || (<plat.expressions.IRegex>plat.acquire(__Regex)).camelCaseRegex;

    return str.replace(camelCaseRegex,
        (match: string, delimiter?: string, char?: string, index?: number)
            => index ? char.toUpperCase() : char);
}

function deleteProperty(obj: any, property: number): any;
function deleteProperty(obj: any, property: string): any;
function deleteProperty(obj: any, property: any): any {
    if (!isNull(obj)) {
        /* tslint:disable:no-unused-expression */
        delete obj[property];
        /* tslint:enable:no-unused-expression */
    }

    return obj;
}

function access(obj: any, property: number): any;
function access(obj: any, property: string): any;
function access(obj: any, property: any): any {
    if (isNull(obj)) {
        return obj;
    }
    return obj[property];
}
/* tslint:enable:no-unused-variable */
