// Clientside callbacks shared by the visualization pages. Dash loads every
// .js file in assets/ automatically; pages call these through
// ClientsideFunction(namespace="rs", ...).

window.dash_clientside = Object.assign({}, window.dash_clientside, {
    rs: {
        /**
         * Mirror the page's selections into the query string so a reload,
         * bookmark or shared link restores them.
         *
         * Called with one argument per selection control, then the list of
         * query-string names for those controls (a dcc.Store). Uses
         * replaceState rather than a dcc.Location: a Location change would
         * re-run Dash's page router and rebuild the page, and pushState would
         * make Back step through every dropdown change.
         */
        syncQuery: function (...args) {
            const names = args.pop() || [];
            const params = new URLSearchParams(window.location.search);
            names.forEach((name, i) => {
                const value = args[i];
                if (value === null || value === undefined || value === "") {
                    params.delete(name);
                } else {
                    params.set(name, value);
                }
            });
            const query = params.toString();
            const url =
                window.location.pathname +
                (query ? "?" + query : "") +
                window.location.hash;
            window.history.replaceState(window.history.state, "", url);
            return window.dash_clientside.no_update;
        },

        /**
         * "Updated 10:42 AM" on the reader's own clock, once there are
         * results to date.
         */
        updatedAt: function (children) {
            const empty =
                children === null ||
                children === undefined ||
                (Array.isArray(children) && children.length === 0);
            if (empty) {
                return "";
            }
            const time = new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
            });
            return "Updated " + time;
        },
    },
});
