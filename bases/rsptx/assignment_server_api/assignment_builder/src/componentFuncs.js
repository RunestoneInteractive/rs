// Render a question in the provided div.

// TODO: remove document.querySelector dependency
export async function renderRunestoneComponent(
    componentSrc,
    whereDiv, // ref
    moreOpts
) {
    /**
     *  The easy part is adding the componentSrc to the existing div.
     *  The tedious part is calling the right functions to turn the
     *  source into the actual component.
     */
    if (!componentSrc) {
        whereDiv.innerHTML = `<p>Sorry, no source is available for preview or grading</p>`;
        return;
    }
    if (typeof moreOpts === "undefined") {
        moreOpts = {};
    }
    var author = null;
    if ("author" in moreOpts) {
        author = moreOpts.author;
        delete moreOpts.author;
    }
    let patt = /..\/_images/g;
    componentSrc = componentSrc.replace(
        patt,
        `${window.eBookConfig.app}/books/published/${window.eBookConfig.basecourse}/_images`
    );
    whereDiv.innerHTML = componentSrc;

    if (typeof window.componentMap === "undefined") {
        window.componentMap = {};
    }

    let componentKind =
        whereDiv.current.querySelector(`[data-component]`).dataset.component;
    // webwork problems do not have a data-component attribute so we have to try to figure it out.
    //
    if (
        (!componentKind && componentSrc.indexOf("handleWW") >= 0) ||
        componentSrc.indexOf("webwork") >= 0
    ) {
        componentKind = "webwork";
    }
    // Import all the js needed for this component before rendering
    await window.runestoneComponents.runestone_import(componentKind);
    let opt = {};
    opt.orig = whereDiv.current.querySelector(`[data-component]`);
    if (opt.orig) {
        opt.lang = opt.orig.dataset.lang;
        if (!opt.lang) {
            opt.lang = opt.orig.querySelector("[data-lang]").dataset.lang;
        }
        opt.useRunestoneServices = false;
        opt.graderactive = false;
        opt.python3 = true;
        if (typeof moreOpts !== "undefined") {
            for (let key in moreOpts) {
                opt[key] = moreOpts[key];
            }
        }
    }

    if (typeof component_factory === "undefined") {
        alert(
            "Error:  Missing the component factory!  probably a webpack version mismatch"
        );
    } else {
        if (!window.component_factory[componentKind] && !whereDiv.innerHTML) {
            whereDiv.innerHTML = `<p>Preview not available for ${componentKind}</p>`;
        } else {
            try {
                let res = window.component_factory[componentKind](opt);
                res.multiGrader = moreOpts.multiGrader;
                if (componentKind === "activecode") {
                    if (moreOpts.multiGrader) {
                        window.componentMap[
                            `${moreOpts.gradingContainer} ${res.divid}`
                        ] = res;
                    } else {
                        window.componentMap[res.divid] = res;
                    }
                }
            } catch (e) {
                console.log(e);
            }
        }
    }
    //MathJax.typeset([document.querySelector(`#${whereDiv}`)]);
}

export function createActiveCodeTemplate(
    uniqueId,
    instructions,
    language,
    prefix_code,
    starter_code,
    suffix_code
) {
    var preview_src = `
<div class="ptx-runestone-container">
<div class="runestone explainer ac_section ">
<div data-component="activecode" id="${uniqueId}" data-question_Form.Label="4.2.2.2">
<div class="ac_question">
<p>${instructions}</p>

</div>
<textarea data-lang="${language}" id="${uniqueId}_editor"
    data-timelimit=25000  data-codelens="true"  style="visibility: hidden;"
    data-audio=''
    data-wasm=/_static
    >
${prefix_code}
^^^^
${starter_code}
====
${suffix_code}

</textarea>
</div>
</div>
</div>
    `;
    return preview_src;
}
