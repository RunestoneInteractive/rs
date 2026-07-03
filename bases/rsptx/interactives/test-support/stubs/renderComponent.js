// Test stub for runestone/common/js/renderComponent.js, which imports
// webpack.index.js and with it every component in the repository.
export async function renderRunestoneComponent(html, divid) {
    const target = document.getElementById(divid);
    if (target) {
        target.innerHTML = html;
    }
}

export async function renderOneComponent() {}
