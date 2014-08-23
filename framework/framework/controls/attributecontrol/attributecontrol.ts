module plat.controls {
    /**
     * @name AttributeControl
     * @memberof plat.controls
     * @kind class
     * 
     * @extends {plat.Control}
     * @implements {plat.controls.IAttributeControl}
     * 
     * @description
     * A type of control that can be used as an attribute but will 
     * not be used to add, remove, or modify DOM.
     */
    export class AttributeControl extends Control implements IAttributeControl {
        /**
         * @name dispose
         * @memberof plat.controls.AttributeControl
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Method for disposing an attribute control. Removes any 
         * necessary objects from the control.
         * 
         * @param {plat.IAttributeControl} control The {@link plat.controls.AttributeControl|AttributeControl} to dispose.
         * 
         * @returns {void}
         */
        static dispose(control: IAttributeControl): void {
            deleteProperty(control, 'templateControl');

            Control.dispose(control);
        }

        /**
         * @name getInstance
         * @memberof plat.controls.AttributeControl
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a new instance of {@link plat.controls.AttributeControl|AttributeControl}.
         * 
         * @returns {plat.IAttributeControl}
         */
        static getInstance(): IAttributeControl {
            return new AttributeControl();
        }

        /**
         * @name templateControl
         * @memberof plat.controls.AttributeControl
         * @kind property
         * @access public
         * 
         * @type {plat.ui.ITemplateControl}
         * 
         * @description
         * Specifies the {@link plat.ui.ITemplateControl|ITemplateControl} associated with this
         * control's element. Can be null if no {@link plat.ui.ITemplateControl|ITemplateControl}
         * exists.
         */
        templateControl: ui.ITemplateControl = null;
    }

    /**
     * The Type for referencing the '$AttributeControlFactory' injectable as a dependency.
     */
    export function IAttributeControlFactory(): IAttributeControlFactory {
        return AttributeControl;
    }

    register.injectable(__AttributeControlFactory, IAttributeControlFactory, null, __FACTORY);

    /**
     * @name IAttributeControlFactory
     * @memberof plat.controls
     * @kind interface
     * 
     * @description
     * Creates and manages instances of {@link plat.controls.IAttributeControl|IAttributeControl}.
     */
    export interface IAttributeControlFactory {
        /**
         * @name dispose
         * @memberof plat.controls.IAttributeControlFactory
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Method for disposing an attribute control. Removes any 
         * necessary objects from the control.
         * 
         * @param {plat.IAttributeControl} control The {@link plat.controls.AttributeControl|AttributeControl} to dispose.
         * 
         * @returns {void}
         */
        dispose(control: IAttributeControl): void;

        /**
         * @name getInstance
         * @memberof plat.controls.IAttributeControlFactory
         * @kind function
         * @access public
         * @static
         * 
         * @description
         * Returns a new instance of {@link plat.controls.AttributeControl|AttributeControl}.
         * 
         * @returns {plat.IAttributeControl}
         */
        getInstance(): IAttributeControl;
    }

    /**
     * @name IAttributeControl
     * @memberof plat.controls
     * @kind interface
     * 
     * @extends {plat.IControl}
     * 
     * @description
     * An object describing a type of control that can be used as an attribute but will 
     * not be used to add, remove, or modify DOM.
     */
    export interface IAttributeControl extends IControl {
        /**
         * @name templateControl
         * @memberof plat.controls.IAttributeControl
         * @kind property
         * @access public
         * 
         * @type {plat.ui.ITemplateControl}
         * 
         * @description
         * Specifies the {@link plat.ui.ITemplateControl|ITemplateControl} associated with this
         * control's element. Can be null if no {@link plat.ui.ITemplateControl|ITemplateControl}
         * exists.
         */
        templateControl?: ui.ITemplateControl;
    }
}
