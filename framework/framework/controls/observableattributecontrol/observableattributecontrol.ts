﻿module plat.controls {
    /**
     * An AttributeControl that deals with observing changes for a specified property.
     */
    export class ObservableAttributeControl extends AttributeControl implements IObservableAttributeControl {
        $ContextManagerStatic: observable.IContextManagerStatic = acquire(__ContextManagerStatic);

        /**
         * The property to set on the associated template control.
         */
        property: string = '';

        /**
         * The camel-cased name of the control as it appears as an attribute.
         */
        attribute: string;

        /**
         * This control needs to load before its templateControl
         */
        priority = 200;

        /**
         * The set of functions added by the Template Control that listens 
         * for property changes.
         */
        _listeners: Array<(newValue: any, oldValue?: any) => void> = [];

        /**
         * The function to stop listening for property changes.
         */
        _removeListener: IRemoveListener;

        /**
         * Sets the initial value of the property on 
         * the Template Control.
         */
        initialize(): void {
            this.attribute = camelCase(this.type);
            this._setProperty(this._getValue());
        }

        /**
         * Observes the property and resets the value.
         */
        loaded(): void {
            this._observeProperty();
            this._setProperty(this._getValue());
        }

        /**
         * Stops listening for changes to the evaluated 
         * expression and removes references to the listeners 
         * defined by the Template Control.
         */
        dispose(): void {
            if (isFunction(this._removeListener)) {
                this._removeListener();
            }

            this._listeners = [];
        }

        /**
         * Sets the property on the Template Control.
         * 
         * @param value The new value of the evaluated expression.
         * @param oldValue The old value of the evaluated expression.
         */
        _setProperty(value: any, oldValue?: any): void {
            var templateControl = this.templateControl;

            if (isNull(templateControl)) {
                return;
            }

            this.$ContextManagerStatic.defineGetter(templateControl, this.property, <observable.IObservableProperty<any>>{
                value: value,
                observe: this._addListener.bind(this)
            }, true, true);
            this._callListeners(value, oldValue);
        }

        /**
         * Calls the listeners defined by the Template Control.
         * 
         * @param value The new value of the evaluated expression.
         * @param oldValue The old value of the evaluated expression.
         */
        _callListeners(newValue: any, oldValue?: any): void {
            var listeners = this._listeners,
                length = listeners.length,
                templateControl = this.templateControl;

            for (var i = 0; i < length; ++i) {
                listeners[i].call(templateControl, newValue, oldValue);
            }
        }

        /**
         * Adds a listener as defined by the Template Control.
         * 
         * @param listener The listener added by the Template Control.
         */
        _addListener(listener: (newValue: any, oldValue?: any) => void): IRemoveListener {
            var listeners = this._listeners,
                index = listeners.length;

            listeners.push(listener);

            return () => {
                listeners.splice(index, 1);
            };
        }

        /**
         * Evaluates the attribute's value.
         */
        _getValue(): any {
            var expression = (<any>this.attributes)[this.attribute],
                templateControl = this.templateControl;

            if (isNull(templateControl)) {
                return;
            }

            return this.evaluateExpression(expression);
        }

        /**
         * Observes the attribute's value.
         */
        _observeProperty(): void {
            var expression = (<any>this.attributes)[this.attribute],
                templateControl = this.templateControl;

            if (isNull(templateControl)) {
                return;
            }

            this._removeListener = this.observeExpression(expression, this._setProperty);
        }
    }

    /**
     * Describes an attribute object that deals with observing changes for a specified property.
     */
    export interface IObservableAttributeControl extends IAttributeControl {
        /**
         * The property to set on the associated template control.
         */
        property: string;

        /**
         * The camel-cased name of the control as it appears as an attribute.
         */
        attribute: string;
    }

    export class Options extends ObservableAttributeControl {
        /**
         * The property to set on the associated template control.
         */
        property: string = 'options';
    }

    register.control(__Options, Options);
}
