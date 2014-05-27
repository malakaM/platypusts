module plat.controls {
    export class Bind extends AttributeControl {
        /**
         * The priority of Bind is set high to take precede 
         * other controls that may be listening to the same 
         * event.
         */
        priority: number = 100;
        $parser: expressions.IParser = acquire('$parser');
        $ExceptionStatic: IExceptionStatic = acquire('$ExceptionStatic');
        $ContextManagerStatic: observable.IContextManagerStatic = acquire('$ContextManagerStatic');
        /**
         * The function used to add the proper event based on the input type.
         */
        _addEventType: () => void;

        /**
         * The function used to get the bound value.
         */
        _getter: any;

        /**
         * The function used to set the bound value.
         */
        _setter: any;

        /**
         * The event listener attached to this element.
         */
        _eventListener: () => void;

        /**
         * The event listener as a postponed function.
         */
        _postponedEventListener: () => void;

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

        private __fileSupported = (<ICompat>acquire('$compat')).fileSupported;
        private __fileNameRegex = (<expressions.IRegex>acquire('$regex')).fileNameRegex;
        private __isSelf = false;

        /**
         * Determines the type of HTMLElement being bound to 
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
                expression = this._expression = this.$parser.parse((<any>this.attributes)[attr]);

            var identifiers = expression.identifiers;

            if (identifiers.length !== 1) {
                this.$ExceptionStatic.warn('Only 1 identifier allowed in a plat-bind expression');
                this._contextExpression = null;
                return;
            }

            var split = identifiers[0].split('.');

            this._property = split.pop();

            if (split.length > 0) {
                this._contextExpression = this.$parser.parse(split.join('.'));
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
            this._eventListener = null;
            this._postponedEventListener = null;
            this._addEventType = null;
        }

        /**
         * Adds a text event as the event listener. 
         * Used for textarea and input[type=text].
         */
        _addTextEventListener(): void {
            var composing = false,
                timeout: IRemoveListener;

            this._eventListener = () => {
                if (composing) {
                    return;
                }

                this._propertyChanged();
            };

            this._postponedEventListener = () => {
                if (!!timeout) {
                    return;
                }

                timeout = postpone(() => {
                    this._eventListener();
                    timeout = null;
                });
            };

            this._addEventListener('compositionstart', () => composing = true);

            this._addEventListener('compositionend', () => composing = false);

            this._addEventListener('keydown', (ev?: KeyboardEvent) => {
                var key = ev.keyCode,
                    codes = KeyCodes;

                if (key === codes.lwk ||
                    key === codes.rwk ||
                    (key > 15 && key < 28) ||
                    (key > 32 && key < 41)) {
                    return;
                }

                this._postponedEventListener();
            });
            this._addEventListener('cut', null, true);
            this._addEventListener('paste', null, true);
            this._addEventListener('change');
        }

        /**
         * Adds a change event as the event listener. 
         * Used for select, input[type=radio], and input[type=range].
         */
        _addChangeEventListener(): void {
            this._eventListener = this._propertyChanged.bind(this);
            this._addEventListener('change');
        }

        /**
         * Adds the event listener to the element.
         * 
         * @param event The event type
         * @param listener The event listener
         * @param postpone Whether or not to postpone the event listener
         */
        _addEventListener(event: string, listener?: () => void, postpone?: boolean): void {
            var listener = listener ||
                (!!postpone ? this._postponedEventListener : this._eventListener);

            this.addEventListener(this.element, event, listener, false);
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
         */
        _setText(newValue: any): void {
            if (this.__isSelf) {
                return;
            }

            if (isNull(newValue)) {
                var element = <HTMLInputElement>this.element;
                if (isNull(element.value)) {
                    newValue = '';
                } else {
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
         */
        _setRange(newValue: any): void {
            if (this.__isSelf) {
                return;
            }

            if (isEmpty(newValue)) {
                var element = <HTMLInputElement>this.element;
                if (isEmpty(element.value)) {
                    newValue = 0;
                } else {
                    this._propertyChanged();
                    return;
                }
            }

            this.__setValue(newValue);
        }

        /**
         * Setter for input[type=checkbox] and input[type=radio]
         * 
         * @param newValue The new value to set
         */
        _setChecked(newValue: any): void {
            if (this.__isSelf) {
                return;
            } else if (!isBoolean(newValue)) {
                this._propertyChanged();
                return;
            }

            (<HTMLInputElement>this.element).checked = newValue;
        }

        /**
         * Setter for select
         * 
         * @param newValue The new value to set
         */
        _setSelectedIndex(newValue: any): void {
            if (this.__isSelf) {
                return;
            }

            var element = <HTMLSelectElement>this.element;
            if (isEmpty(newValue)) {
                if (isEmpty(element.value)) {
                    element.selectedIndex = -1;
                } else {
                    this._propertyChanged();
                }
                return;
            } else if (element.value === newValue) {
                return;
            }

            element.value = newValue;
            // check to make sure the user changed to a valid value
            if (element.value !== newValue) {
                element.selectedIndex = -1;
            }
        }

        /**
         * Setter for select-multiple
         * 
         * @param newValue The new value to set
         */
        _setSelectedIndices(newValue: any): void {
            if (this.__isSelf) {
                return;
            }

            var options = (<HTMLSelectElement>this.element).options,
                length = options.length,
                option: HTMLOptionElement;

            if (isNull(newValue) || !isArray(newValue)) {
                // unselects the options unless a match is found
                while (length-- > 0) {
                    option = options[length];
                    // purposely doing a soft equality match
                    if (option.value === '' + newValue) {
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
                value = option.value,
                numberValue = Number(value);

                if (newValue.indexOf(value) !== -1 || (isNumber(numberValue) && newValue.indexOf(numberValue) !== -1)) {
                    option.selected = true;
                    continue;
                }

                option.selected = false;
            }
        }

        /**
         * Determines the type of HTMLElement being bound to 
         * and sets the necessary handlers.
         */
        _determineType(): void {
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
                            this._setter = this._setText;
                            break;
                        case 'checkbox':
                        case 'radio':
                            this._addEventType = this._addChangeEventListener;
                            this._getter = this._getChecked;
                            this._setter = this._setChecked;
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
                    var multiple = (<HTMLSelectElement>element).multiple,
                        options = (<HTMLSelectElement>element).options,
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
                    break;
            }
        }

        /**
         * Observes the expression to bind to.
         */
        _watchExpression(): void {
            var context = this.evaluateExpression(this._contextExpression);
            if (isNull(context)) {
                context = this.$ContextManagerStatic.createContext(this.parent,
                    this._contextExpression.identifiers[0]);
            }

            if (!isFunction(this._setter)) {
                return;
            } else if (this._setter === this._setSelectedIndices) {
                var property = this._property;
                if (isNull(context[property])) {
                    context[property] = [];
                }
                this.observeArray(context, property, (arrayInfo: observable.IArrayMethodInfo<string>) => {
                    this._setter(arrayInfo.newArray);
                });
            }

            var expression = this._expression;

            this.observeExpression(expression, this._setter);
            this._setter(this.evaluateExpression(expression));
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

            if (context[property] === newValue) {
                return;
            }

            // set flag to let setter functions know we changed the property
            this.__isSelf = true;
            context[property] = newValue;
            this.__isSelf = false;
        }

        private __setValue(newValue: any): void {
            var element = <HTMLInputElement>this.element;
            if (element.value === newValue) {
                return;
            }

            element.value = newValue;
        }
    }

    register.control('plat-bind', Bind);

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
