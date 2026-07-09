// Book pages provide jQuery and jQuery UI as page globals (webpack marks
// jquery as an external). Tests for components that still depend on them
// must import this shim explicitly. Once a component is migrated off
// jQuery, drop this import from its tests -- a passing suite without the
// shim proves the component no longer touches jQuery.
import $ from "jquery";

globalThis.$ = $;
globalThis.jQuery = $;

// Just enough of jQuery UI for component construction in tests.
$.fn.slider = function (arg, opt, val) {
    const el = this[0];
    if (!el) return this;
    if (!el._sliderState) {
        el._sliderState = { value: 0, max: 0, disabled: false };
        // jQuery UI creates an <a> handle; activecode sets an aria-label on it.
        el.appendChild(document.createElement("a"));
    }
    const state = el._sliderState;
    if (arg === undefined || typeof arg === "object") {
        Object.assign(state, arg || {});
        return this;
    }
    if (arg === "value") {
        if (opt === undefined) return state.value;
        state.value = opt;
        $(el).trigger("slidechange");
        return this;
    }
    if (arg === "option") {
        if (val === undefined) return state[opt];
        state[opt] = val;
        if (opt === "value") $(el).trigger("slidechange");
        return this;
    }
    if (arg === "disable") state.disabled = true;
    if (arg === "enable") state.disabled = false;
    return this;
};

$.fn.resizable = function () {
    return this;
};
