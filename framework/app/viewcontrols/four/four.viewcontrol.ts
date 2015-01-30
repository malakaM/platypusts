﻿module app.viewcontrols {
    'use strict';
    var count = 0;
    export class Four extends plat.ui.ViewControl {
        templateUrl = 'viewcontrols/four/four.viewcontrol.html';
        context: { views: Array<Function>; } = {
            views: [One, Two, Three, Four]
        };

        constructor(private Promise: plat.async.IPromise, router: plat.routing.Router) {
            super();

            router.configure([
                { pattern: '/one', view: One },
                { pattern: '/two', view: Two },
                { pattern: '/three', view: Three },
                { pattern: '/four', view: Four }
            ]);
        }

        navigatedTo() {
            
        }

        navigatingFrom() {
            // console.log('navigatingFrom:', this.uid);
        }

        canNavigateFrom() {

        }

        canNavigateTo() {
            // console.log('canNavigateTo:', this.uid);
            //return this.Promise.resolve().then(() => {
            //    if (count++ === 3) {
            //        this.navigator.navigate(Three);
            //        return false;
            //    }
            //});
        }
    }

    plat.register.viewControl('four', Four, [
        plat.async.IPromise,
        plat.routing.Router
    ]);
}
