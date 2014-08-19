module plat.controls {
    export class Bind extends AttributeControl {
        $Parser: expressions.IParser = acquire(__Parser);
        $ContextManagerStatic: observable.IContextManagerStatic = acquire(__ContextManagerStatic);
        $document: Document = acquire(__Document);

        /**
         * The priority of Bind is set high to take precede 
         * other controls that may be listening to the same 
         * event.
         */
        priority: number = 100;

        /**
         * The function used to add the proper event based on the input type.
         */
        _addEventType: () => void;

        /**
         * The function used to get the bound value.
         */
        _getter: () => any;

        /**
         * The function used to set the bound value.
         */
        _setter: (newValue: any, oldValue?: any, firstTime?: boolean) => void;

        /**
         * The event listener attached to this element.
         */
        //_eventListener: () => void;

        /**
         * The event listener as a postponed function.
         */
        //_postponedEventListener: () => void;

        /**
         * The expression to evaluate as the bound value.
         */
        _expression: expressions.IParsedExpression;

        /**
         * The IParsedExpression used to evaluate the context 
         * of the bound property.
         */
        _contextExpression: expressions.IParsedExpression;

        /**
         * The bound property name.
         */
        _property: string;

        private __fileSupported = (<ICompat>acquire(__Compat)).fileSupported;
        private __fileNameRegex = (<expressions.IRegex>acquire(__Regex)).fileNameRegex;
        private __isSelf = false;

        /**
         * Determines the type of Element being bound to 
         * and sets the necessary handlers.
         */
        initialize(): void {
            this._determineType();
        }

        /**
         * Parses and watches the expression being bound to.
         */
        loaded(): void {
            if (isNull(this.parent) || isNull(this.element)) {
                return;
            }

            var attr = camelCase(this.type),
                expression = this._expression = this.$Parser.parse((<any>this.attributes)[attr]);

            var identifiers = expression.identifiers;

            if (identifiers.length !== 1) {
                var $exception: IExceptionStatic = acquire(__ExceptionStatic);
                $exception.warn('Only 1 identifier allowed in a plat-bind expression', $exception.BIND);
                this._contextExpression = null;
                return;
            }

            var split = identifiers[0].split('.');

            this._property = split.pop();

            if (split.length > 0) {
                this._contextExpression = this.$Parser.parse(split.join('.'));
            } else if (expression.aliases.length > 0) {
                var alias = expression.aliases[0],
                    resourceObj = this.parent.findResource(alias);

                if (isNull(resourceObj) || resourceObj.resource.type !== 'observable') {
                    return;
                }

                this._property = 'value';

                this._contextExpression = {
                    evaluate: () => {
                        return resourceObj.resource;
                    },
                    aliases: [],
                    identifiers: [],
                    expression: ''
                };
            } else {
                this._contextExpression = {
                    evaluate: () => {
                        return this.parent.context;
                    },
                    aliases: [],
                    identifiers: [],
                    expression: ''
                };
            }

            this._watchExpression();

            if (isNull(this._addEventType)) {
                return;
            }

            this._addEventType();
        }

        /**
         * Re-observes the expression with the new context.
         */
        contextChanged(): void {
            this._watchExpression();
        }

        /**
         * Removes all of the element's event listeners.
         */
        dispose(): void {
            //this._eventListener = null;
            //this._postponedEventListener = null;
            this._addEventType = null;
        }

        /**
         * Adds a text event as the event listener. 
         * Used for textarea and input[type=text].
         */
        _addTextEventListener(): void {
            var element = this.element,
                composing = false,
                timeout: IRemoveListener,
                eventListener = () => {
                    if (composing) {
                        return;
                    }

                    this._propertyChanged();
                },
                postponedEventListener = () => {
                    if (isFunction(timeout)) {
                        return;
                    }

                    timeout = postpone(() => {
                        eventListener();
                        timeout = null;
                    });
                };

            this.addEventListener(element, 'compositionstart', () => composing = true, false);
            this.addEventListener(element, 'compositionend', () => composing = false, false);
            this.addEventListener(element, 'keydown', (ev: Event) => {
                var key = (<KeyboardEvent>ev).keyCode,
                    codes = KeyCodes;

                if (key === codes.lwk ||
                    key === codes.rwk ||
                    (key > 15 && key < 28) ||
                    (key > 32 && key < 41)) {
                    return;
                }

                postponedEventListener();
            }, false);
            this.addEventListener(element, 'cut', postponedEventListener, false);
            this.addEventListener(element, 'paste', postponedEventListener, false);
            this.addEventListener(element, 'change', eventListener, false);
        }

        /**
         * Adds a change event as the event listener. 
         * Used for select, input[type=radio], and input[type=range].
         */
        _addChangeEventListener(): void {
            this.addEventListener(this.element, 'change', this._propertyChanged, false);
        }

        /**
         * Adds a $tap event as the event listener. 
         * Used for input[type=button] and button.
         */
        _addButtonEventListener(): void {
            this.addEventListener(this.element, '$tap', this._propertyChanged, false);
        }

        /**
         * Getter for input[type=checkbox] and input[type=radio]
         */
        _getChecked(): boolean {
            return (<HTMLInputElement>this.element).checked;
        }

        /**
         * Getter for input[type=text], input[type=range], 
         * textarea, and select.
         */
        _getValue(): string {
            return (<HTMLInputElement>this.element).value;
        }

        /**
         * Getter for button.
         */
        _getTextContent(): string {
            return (<HTMLInputElement>this.element).textContent;
        }

        /**
         * Getter for input[type="file"]. Creates a partial IFile 
         * element if file is not supported.
         */
        _getFile(): IFile {
            var element = <HTMLInputElement>this.element,
                value = element.value;

            if (this.__fileSupported && element.files.length > 0) {
                return <IFile>element.files[0];
            }

            return {
                name: value.replace(this.__fileNameRegex, ''),
                path: value,
                lastModifiedDate: undefined,
                type: undefined,
                size: undefined,
                msDetachStream: noop,
                msClose: noop,
                slice: () => <Blob>{ }
            };
        }

        /**
         * Getter for input[type="file"]-multiple
         */
        _getFiles(): Array<IFile> {
            var element = <HTMLInputElement>this.element;

            if (this.__fileSupported) {
                return Array.prototype.slice.call(element.files);
            }

            // this case should never be hit since ie9 does not support multi-file uploads, 
            // but kept in here for now for consistency's sake
            var filelist = element.value.split(/,|;/g),
                length = filelist.length,
                files: Array<IFile> = [],
                fileValue: string;

            for (var i = 0; i < length; ++i) {
                fileValue = filelist[i];
                files.push({
                    name: fileValue.replace(this.__fileNameRegex, ''),
                    path: fileValue,
                    lastModifiedDate: undefined,
                    type: undefined,
                    size: undefined,
                    msDetachStream: noop,
                    msClose: noop,
                    slice: () => <Blob>{}
                });
            }

            return files;
        }

        /**
         * Getter for select-multiple
         */
        _getSelectedValues(): Array<string> {
            var options = (<HTMLSelectElement>this.element).options,
                length = options.length,
                option: HTMLOptionElement,
                selectedValues: Array<string> = [];

            for (var i = 0; i < length; ++i) {
                option = options[i];
                if (option.selected) {
                    selectedValues.push(option.value);
                }
            }

            return selectedValues;
        }

        /**
         * Setter for textarea, input[type=text], 
         * and input[type=button], and select
         * 
         * @param newValue The new value to set
         * @param oldValue The previously bound value
         * @param firstTime The context is being evaluated for the first time and 
         * should thus change the property if null
         */
        _setText(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            }

            if (isNull(newValue)) {
                newValue = '';

                if (firstTime === true) {
                    if (isNull((<HTMLInputElement>this.element).value)) {
                        this.__setValue(newValue);
                    }
                    this._propertyChanged();
                    return;
                }
            }

            this.__setValue(newValue);
        }

        /**
         * Setter for input[type=range]
         * 
         * @param newValue The new value to set
         * @param oldValue The previously bound value
         * @param firstTime The context is being evaluated for the first time and 
         * should thus change the property if null
         */
        _setRange(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            }

            if (isEmpty(newValue)) {
                newValue = 0;

                if (firstTime === true) {
                    if (isEmpty((<HTMLInputElement>this.element).value)) {
                        this.__setValue(newValue);
                    }
                    this._propertyChanged();
                    return;
                }
            }

            this.__setValue(newValue);
        }

        /**
         * Setter for input[type=checkbox]
         * 
         * @param newValue The new value to set
         * @param oldValue The previously bound value
         * @param firstTime The context is being evaluated for the first time and 
         * should thus change the property if null
         */
        _setChecked(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            } else if (!isBoolean(newValue)) {
                if (firstTime === true) {
                    this._propertyChanged();
                    return;
                }
                newValue = !!newValue;
            }

            (<HTMLInputElement>this.element).checked = newValue;
        }

        /**
         * Setter for input[type=radio]
         * 
         * @param newValue The new value to set
         */
        _setRadio(newValue: any): void {
            var element = (<HTMLInputElement>this.element);
            if (this.__isSelf) {
                return;
            } else if (isNull(newValue) && element.checked) {
                this._propertyChanged();
                return;
            }

            element.checked = (element.value === newValue);
        }

        /**
         * Setter for select
         * 
         * @param newValue The new value to set
         * @param oldValue The previously bound value
         * @param firstTime The context is being evaluated for the first time and 
         * should thus change the property if null
         */
        _setSelectedIndex(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            } else if (firstTime === true && this.__checkAsynchronousSelect()) {
                if (isNull(newValue)) {
                    this._propertyChanged();
                }
                return;
            }

            var element = <HTMLSelectElement>this.element,
                value = element.value;
            if (isNull(newValue)) {
                if (firstTime === true || !this.$document.body.contains(element)) {
                    this._propertyChanged();
                    return;
                }
                element.selectedIndex = -1;
                return;
            } else if (!isString(newValue)) {
                var Exception: IExceptionStatic = acquire(__ExceptionStatic),
                    message: string;
                if (isNumber(newValue)) {
                    newValue = newValue.toString();
                    message = 'Trying to bind a value of type number to a select element. ' +
                        'The value will implicitly be converted to type string.';
                } else {
                    message = 'Trying to bind a value that is not a string to a select element. ' +
                        'The element\'s selected index will be set to -1.';
                }

                Exception.warn(message, Exception.BIND);
            } else if (value === newValue) {
                return;
            } else if (!this.$document.body.contains(element)) {
                element.value = newValue;
                if (element.value !== newValue) {
                    element.value = value;
                    this._propertyChanged();
                }
                return;
            }

            element.value = newValue;
            // check to make sure the user changed to a valid value
            // second boolean argument is an ie fix for inconsistency
            if (element.value !== newValue || element.selectedIndex === -1) {
                element.selectedIndex = -1;
            }
        }

        /**
         * Setter for select-multiple
         * 
         * @param newValue The new value to set
         * @param oldValue The previously bound value
         * @param firstTime The context is being evaluated for the first time and 
         * should thus change the property if null
         */
        _setSelectedIndices(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            } else if (firstTime === true && this.__checkAsynchronousSelect()) {
                return;
            }

            var options = (<HTMLSelectElement>this.element).options,
                length = isNull(options) ? 0 : options.length,
                option: HTMLOptionElement,
                nullValue = isNull(newValue);

            if (nullValue || !isArray(newValue)) {
                if (firstTime === true) {
                    this._propertyChanged();
                }
                // unselects the options unless a match is found
                while (length-- > 0) {
                    option = options[length];
                    if (!nullValue && option.value === '' + newValue) {
                        option.selected = true;
                        return;
                    }

                    option.selected = false;
                }
                return;
            }

            var value: any,
                numberValue: number;

            while (length-- > 0) {
                option = options[length];
                value = option.value;
                numberValue = Number(value);

                if (newValue.indexOf(value) !== -1 || (isNumber(numberValue) && newValue.indexOf(numberValue) !== -1)) {
                    option.selected = true;
                    continue;
                }

                option.selected = false;
            }
        }

        /**
         * Determines the type of Element being bound to 
         * and sets the necessary handlers.
         */
        _determineType(): void {
            if (!isNull(this.templateControl) && this._observedBindableProperty()) {
                return;
            }
            
            var element = this.element;
            if (isNull(element)) {
                return;
            }

            switch (element.nodeName.toLowerCase()) {
                case 'textarea':
                    this._addEventType = this._addTextEventListener;
                    this._getter = this._getValue;
                    this._setter = this._setText;
                    break;
                case 'input':
                    switch ((<HTMLInputElement>element).type) {
                        case 'button':
                        case 'submit':
                        case 'reset':
                            this._addEventType = this._addButtonEventListener;
                            this._getter = this._getValue;
                            break;
                        case 'checkbox':
                            this._addEventType = this._addChangeEventListener;
                            this._getter = this._getChecked;
                            this._setter = this._setChecked;
                            break;
                        case 'radio':
                            this.__initializeRadio();
                            break;
                        case 'range':
                            this._addEventType = this._addChangeEventListener;
                            this._getter = this._getValue;
                            this._setter = this._setRange;
                            break;
                        case 'file':
                            var multi = (<HTMLInputElement>element).multiple;
                            this._addEventType = this._addChangeEventListener;
                            this._getter = multi ? this._getFiles : this._getFile;
                            break;
                        default:
                            this._addEventType = this._addTextEventListener;
                            this._getter = this._getValue;
                            this._setter = this._setText;
                            break;
                    }
                    break;
                case 'select':
                    this.__initializeSelect();
                    break;
                case 'button':
                    this._addEventType = this._addButtonEventListener;
                    this._getter = this._getTextContent;
                    break;
            }
        }

        /**
         * Observes the expression to bind to.
         */
        _watchExpression(): void {
            var contextExpression = this._contextExpression,
                context = this.evaluateExpression(contextExpression);

            if (!isObject(context)) {
                if (isNull(context) && contextExpression.identifiers.length > 0) {
                    context = this.$ContextManagerStatic.createContext(this.parent,
                        contextExpression.identifiers[0]);
                } else {
                    var Exception: IExceptionStatic = acquire(__ExceptionStatic);
                    Exception.warn('plat-bind is trying to index into a primitive type. ' +
                        this._contextExpression.expression + ' is already defined and not ' +
                        'an object when trying to evaluate plat-bind="' +
                        this._expression.expression + '"', Exception.BIND);
                }
            }

            var property: string;
            if (!isFunction(this._setter)) {
                return;
            } else if (this._setter === this._setSelectedIndices) {
                property = this._property;
                if (isNull(context[property])) {
                    context[property] = [];
                }
                this.observeArray(context, property, (arrayInfo: observable.IArrayMethodInfo<string>) => {
                    this._setter(arrayInfo.newArray, arrayInfo.oldArray, true);
                });
            }

            var expression = this._expression;

            this.observeExpression(expression, this._setter);
            this._setter(this.evaluateExpression(expression), undefined, true);
        }

        /**
         * Sets the context property being bound to when the 
         * element's property is changed.
         */
        _propertyChanged(): void {
            if (isNull(this._contextExpression)) {
                return;
            }

            var context = this.evaluateExpression(this._contextExpression),
                property = this._property;

            var newValue = this._getter();

            if (isNull(context) || context[property] === newValue) {
                return;
            }

            // set flag to let setter functions know we changed the property
            this.__isSelf = true;
            context[property] = newValue;
            this.__isSelf = false;
        }

        /**
         * Checks if the associated Template Control is a BindablePropertyControl and 
         * initializes all listeners accordingly.
         */
        _observedBindableProperty(): boolean {
            var templateControl = <ui.IBindablePropertyControl>this.templateControl;

            if (isFunction(templateControl.observeProperty) &&
                isFunction(templateControl.setProperty)) {
                templateControl.observeProperty((newValue: any) => {
                    this._getter = () => newValue;
                    this._propertyChanged();
                });

                this._setter = this.__setBindableProperty;
                return true;
            }

            return false;
        }

        private __setBindableProperty(newValue: any, oldValue?: any, firstTime?: boolean): void {
            if (this.__isSelf) {
                return;
            }

            (<ui.IBindablePropertyControl>this.templateControl).setProperty(newValue, oldValue, firstTime);
        }

        private __setValue(newValue: any): void {
            var element = <HTMLInputElement>this.element;
            if (element.value === newValue) {
                return;
            }

            element.value = newValue;
        }

        private __initializeRadio(): void {
            var element = this.element;

            this._addEventType = this._addChangeEventListener;
            this._getter = this._getValue;
            this._setter = this._setRadio;

            if (!element.hasAttribute('name')) {
                var attr = camelCase(this.type),
                    expression = (<any>this.attributes)[attr];

                element.setAttribute('name', expression);
            }

            if (element.hasAttribute('value')) {
                return;
            }

            element.setAttribute('value', '');
        }

        private __initializeSelect(): void {
            var element = <HTMLSelectElement>this.element,
                multiple = element.multiple,
                options = element.options,
                length = options.length,
                option: HTMLSelectElement;

            this._addEventType = this._addChangeEventListener;
            if (multiple) {
                this._getter = this._getSelectedValues;
                this._setter = this._setSelectedIndices;
            } else {
                this._getter = this._getValue;
                this._setter = this._setSelectedIndex;
            }

            for (var i = 0; i < length; ++i) {
                option = options[i];
                if (!option.hasAttribute('value')) {
                    option.setAttribute('value', option.textContent);
                }
            }
        }

        private __checkAsynchronousSelect(): boolean {
            var select = <ui.controls.Select>this.templateControl;
            if (!isNull(select) && (select.type === __Select || select.type === __ForEach) && isPromise(select.itemsLoaded)) {
                var split = select.absoluteContextPath.split('.'),
                    key = split.pop();

                this.observeArray(this.$ContextManagerStatic.getContext(this.parent, split), key,
                    (ev: observable.IArrayMethodInfo<any>) => {
                        select.itemsLoaded.then(() => {
                            this._setter(this.evaluateExpression(this._expression));
                        });
                    });

                select.itemsLoaded.then(() => {
                    this._setter(this.evaluateExpression(this._expression));
                });

                return true;
            }

            return false;
        }
    }

    register.control(__Bind, Bind);

    /**
     * A file interface for browsers that do not support the 
     * File API.
     */
    export interface IFile extends File {
        /**
         * An absolute path to the file. The property is not added supported to 
         * File types.
         */
        path?: string;
    }
}
