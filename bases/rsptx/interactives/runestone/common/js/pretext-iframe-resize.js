// Used for experimental custom runestone components implemented inside
// iframes. This script should automatically request that the iframe get
// resized to fit the content and update when content does.

// It will not install if the page is not inside an iframe, or if the page does not have a
// wrapper element with the attribute data-pretext-frame-resize="lti.frameResize".
// The wrapper element should be the outermost element of the interactive's -if.html page.

// PreTeXt's parent page loads lti_iframe_resizer.js. It identifies the
// sending iframe by contentWindow and expects a height in pixels.
function installPretextIframeResize() {
    if (window.parent === window) return;

    // PreTeXt marks the content wrapper on an interactive's -if.html page.
    const wrapper = document.querySelector(
        '[data-pretext-frame-resize="lti.frameResize"]',
    );
    if (!wrapper) return;
    // The generated aspect ratio reserves space before the component renders.
    // Once JS runs, use the component's actual height instead.
    wrapper.style.aspectRatio = "auto";

    let pending = false;
    let lastHeight = -1;
    const reportHeight = () => {
        pending = false;
        const height = Math.ceil(
            wrapper.getBoundingClientRect().bottom + window.scrollY,
        );
        if (height === lastHeight) return;
        lastHeight = height;
        window.parent.postMessage(
            { subject: "lti.frameResize", height },
            window.location.origin === "null" ? "*" : window.location.origin,
        );
    };
    const scheduleReport = () => {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(reportHeight);
    };

    // Runestone renders asynchronously, and later actions may change height.
    // Observe content rather than the viewport that the parent resizes.
    if (window.ResizeObserver) {
        new ResizeObserver(scheduleReport).observe(wrapper, {
            box: "border-box",
        });
    }
    scheduleReport();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPretextIframeResize, {
        once: true,
    });
} else {
    installPretextIframeResize();
}
