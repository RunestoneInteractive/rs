// Test stub for runestone/common/js/renderComponent.js, which imports
// webpack.index.js and with it every component in the repository.
export async function renderRunestoneComponent(html, divid) {
    const target = document.getElementById(divid);
    if (target) {
        target.innerHTML = html;
    }
}

export async function renderOneComponent() {}

// Stand-in for the timed-assessment rendering path: hand back an inspectable
// fake question instead of instantiating a real component.
export function createTimedComponent(htmlsrc, opts) {
    return {
        question: {
            containerDiv: document.createElement("div"),
            htmlsrc,
            opts,
        },
    };
}
