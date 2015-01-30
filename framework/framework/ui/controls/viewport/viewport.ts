module plat.ui.controls {
    'use strict';

    export class Viewport extends TemplateControl implements routing.ISupportRouteNavigation {
        protected static _inject: any = {
            _Router: __RouterStatic,
            _Promise: __Promise,
            _Injector: __InjectorStatic,
            _ElementManagerFactory: __ElementManagerFactory,
            _document: __Document,
            _managerCache: __ManagerCache,
            _animator: __Animator,
            navigator: __NavigatorInstance
        };

        protected _Router: typeof routing.Router;
        protected _Promise: async.IPromise;
        protected _Injector: typeof dependency.Injector;
        protected _ElementManagerFactory: processing.IElementManagerFactory;
        protected _document: Document;

        /**
         * @name _managerCache
         * @memberof plat.ui.controls.Viewport
         * @kind property
         * @access protected
         * 
         * @type {plat.storage.Cache<plat.processing.ElementManager>}
         * 
         * @description
         * Reference to an injectable that caches {@link plat.processing.ElementManager|ElementManagers}.
         */
        protected _managerCache: storage.Cache<processing.ElementManager>;

        /**
         * @name _animator
         * @memberof plat.ui.controls.Viewport
         * @kind property
         * @access protected
         * 
         * @type {plat.ui.animations.Animator}
         * 
         * @description
         * Reference to the {@link plat.ui.animations.Animator|Animator} injectable.
         */
        protected _animator: animations.Animator;

        /**
         * @name _animationPromise
         * @memberof plat.ui.controls.Viewport
         * @kind property
         * @access protected
         * 
         * @type {plat.ui.animations.IAnimationThenable<plat.ui.animations.IParentAnimationFn>}
         * 
         * @description
         * A promise used for disposing the end state of the previous animation prior to starting a new one.
         */
        protected _animationPromise: animations.IAnimationThenable<animations.IGetAnimatingThenable>;

        navigator: routing.Navigator;
        router: routing.Router;
        parentRouter: routing.Router;
        controls: Array<ViewControl>;
        nextInjector: dependency.Injector<ViewControl>;
        nextView: ViewControl;

        initialize() {
            var router = this.router = this._Router.currentRouter(),
                parentViewport = this._getParentViewport(),
                parentRouter: routing.Router;

            if (!(isNull(parentViewport) || isNull(parentViewport.router))) {
                parentRouter = this.parentRouter = parentViewport.router;
                parentRouter.addChild(router);
            }

            this.navigator.initialize(router);
        }

        loaded() {
            this._Promise.resolve(this.router.finishNavigating).then(() => {
                this.router.register(this);
            });
        }

        canNavigateTo(routeInfo: routing.IRouteInfo): async.IThenable<boolean> {
            var getRouter = this._Router.currentRouter,
                currentRouter = getRouter(),
                response: any = true,
                injector: dependency.Injector<ViewControl> = this._Injector.getDependency(routeInfo.delegate.view),
                view = injector.inject(),
                parameters = routeInfo.parameters,
                resolve = this._Promise.resolve.bind(this._Promise),
                nextRouter = getRouter();

            if (!isObject(view)) {
                return resolve();
            }

            if (currentRouter !== nextRouter) {
                nextRouter.initialize(this.router);
                var navigator: routing.Navigator = acquire(__NavigatorInstance);
                view.navigator = navigator;
                navigator.initialize(nextRouter);
            } else {
                view.navigator = this.navigator;
            }

            if (isFunction(view.canNavigateTo)) {
                response = view.canNavigateTo(parameters, routeInfo.query);
            }

            return resolve(response).then((canNavigateTo: boolean) => {
                this.nextInjector = injector;
                this.nextView = view;
                return canNavigateTo;
            });
        }

        canNavigateFrom(): async.IThenable<boolean> {
            var view = this.controls[0],
                response: any = true;

            if (isObject(view) && isFunction(view.canNavigateFrom)) {
                response = view.canNavigateFrom();
            }

            return this._Promise.resolve(response);
        }

        navigateTo(routeInfo: routing.IRouteInfo) {
            var resolve = this._Promise.resolve.bind(this._Promise),
                injector = this.nextInjector || this._Injector.getDependency(routeInfo.delegate.view),
                nodeMap = this._createNodeMap(injector),
                element = this.element,
                node = nodeMap.element,
                parameters = routeInfo.parameters,
                query = routeInfo.query,
                control = <ViewControl>nodeMap.uiControlNode.control;

            element.appendChild(node);

            var animationPromise = this._animationPromise;
            if (isPromise(animationPromise)) {
                animationPromise.dispose();
            }

            this._animationPromise = this._animator.animate(this.element, __Enter);

            var viewportManager = this._managerCache.read(this.uid),
                manager = this._ElementManagerFactory.getInstance(),
                promise: async.IThenable<void>;

            viewportManager.children = [];
            manager.initialize(nodeMap, viewportManager);

            if (isFunction(control.navigatedTo)) {
                promise = resolve(control.navigatedTo(routeInfo.parameters, query));
            } else {
                promise = resolve();
            }

            return promise
                .catch(noop)
                .then(() => {
                    manager.setUiControlTemplate();
                    return manager.templatePromise;
                });
        }

        navigateFrom() {
            var view = this.controls[0],
                promise: async.IThenable<void>;

            if (isObject(view) && isFunction(view.navigatingFrom)) {
                promise = this._Promise.resolve(view.navigatingFrom());
            } else {
                promise = this._Promise.resolve();
            }

            return promise
                .catch(noop)
                .then(() => {
                    Control.dispose(view);
                });
        }

        dispose() {
            this.router.unregister(this);
            this.navigator.dispose();
        }

        protected _createNodeMap(injector: dependency.Injector<ViewControl>) {
            var control = this.nextView || injector.inject(),
                doc = this._document,
                type = injector.name,
                replaceWith = control.replaceWith,
                node: HTMLElement = (isEmpty(replaceWith) || replaceWith === 'any') ?
                    doc.createElement('div') : doc.createElement(replaceWith);

            node.setAttribute(__Control, type);
            node.className = __ViewControl;

            return <processing.INodeMap>{
                element: node,
                attributes: {},
                nodes: [],
                uiControlNode: {
                    control: <any>control,
                    nodeName: type,
                    expressions: <Array<expressions.IParsedExpression>>[],
                    injector: <any>injector,
                    childManagerLength: 0
                }
            };
        }

        protected _getParentViewport(): Viewport {
            var viewport = this.parent,
                type = this.type;

            while (!isNull(viewport) && viewport.type !== type) {
                viewport = viewport.parent;
            }

            return <Viewport><any>viewport;
        }
    }

    register.control(__Viewport, Viewport);
}
