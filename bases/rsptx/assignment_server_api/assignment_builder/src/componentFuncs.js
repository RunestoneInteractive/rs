// Render a question in the provided div.


// TODO: remove document.querySelector dependency
export async function renderRunestoneComponent(
    componentSrc,
    whereDiv,
    moreOpts
) {
    /**
     *  The easy part is adding the componentSrc to the existing div.
     *  The tedious part is calling the right functions to turn the
     *  source into the actual component.
     */
    if (!componentSrc) {
        document.querySelector(
            `#${whereDiv}`
        ).innerHTML = `<p>Sorry, no source is available for preview or grading</p>`;
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
    document.querySelector(`#${whereDiv}`).innerHTML = componentSrc;

    if (typeof window.componentMap === "undefined") {
        window.componentMap = {};
    }

    let componentKind = document.querySelector(`#${whereDiv} [data-component]`)
        .dataset.component;
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
    opt.orig = document.querySelector(`#${whereDiv} [data-component]`);
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
        if (
            !window.component_factory[componentKind] &&
            !document.querySelector(`#${whereDiv}`).innerHTML
        ) {
            document.querySelector(
                `#${whereDiv}`
            ).innerHTML = `<p>Preview not available for ${componentKind}</p>`;
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
    if (!opt.graderactive) {
        if (whereDiv !== "modal-preview" && whereDiv !== "questiondisplay") {
            // if we are in modal we are already editing
            let mp = document.querySelector("#modal-preview")
            if (mp) {
                mp.dataset.orig_divid = opt.acid || moreOpts.acid || opt.orig.id;
            }
            // save the original divid
            if (author) {
                let authorInfo = document.createElement("p");
                authorInfo.innerHTML = `Written by: ${author}`;
                document.querySelector(`#${whereDiv}`).appendChild(authorInfo);
            }
            let editButton = document.createElement("button");
            let constrainbc =
                document.getElementById("qbankform")
            if (constrainbc) {
                constrainbc = constrainbc.checked;
            }
            editButton.textContent = "Edit Question";
            editButton.classList.add("btn", "btn-normal");
            editButton.dataset.dataTarget = "#editModal";
            editButton.dataset.dataToggle = "modal";
            editButton.addEventListener("click", async function (event) {
                let jsheaders = new Headers({
                    "Content-type": "application/json; charset=utf-8",
                    Accept: "application/json",
                });

                let data = {
                    method: "GET",
                    question_name: opt.acid || moreOpts.acid || opt.orig.id,
                    constrainbc: constrainbc,
                    headers: jsheaders,
                };

                let res = await fetch("/runestone/admin/question_text", data)
                let rst = document.querySelector("#editRST");
                if (res.ok) {
                    let js = await res.json();
                    rst.textContent = js;
                };
            })
            document.querySelector(`#${whereDiv}`).appendChild(editButton);
            let closeButton = document.createElement("button");
            closeButton.textContent = "Close Preview";
            closeButton.classList.add("btn", "btn-normal");
            closeButton.style.marginLeft = "20px";
            closeButton.addEventListener("click", function (event) {
                document.querySelector("#component-preview").innerHTML = "";
            });
            document.querySelector(`#${whereDiv}`).appendChild(closeButton);

            let reportButton = document.createElement("button");
            reportButton.textContent = "Flag for Review";
            reportButton.style.float = "right";
            reportButton.classList.add("btn", "btn-warning");
            reportButton.addEventListener("click", function (event) {
                if (
                    window.confirm(
                        "Clicking OK will mark this question for review as poor or inappropriate so that it may be removed."
                    )
                ) {
                    let jsheaders = new Headers({
                        "Content-type": "application/json; charset=utf-8",
                        Accept: "application/json",
                    });

                    let data = {
                        question_name: opt.acid || moreOpts.acid || opt.orig.id,
                        headers: jsheaders,
                        method: "POST",
                    };
                    fetch("/runestone/admin/flag_question", data).then(
                        function (obj) {
                            alert(
                                "Flagged -- This question will be reviewed by an editor"
                            );
                            reportButton.disabled = true;
                        }
                    );
                }
            });
            document.querySelector(`#${whereDiv}`).appendChild(reportButton);
            let qraw = document.querySelector("#qrawhtmlmodal")
            if (qraw) {
                qraw.innerHTML = "";
            }
            let editrst = document
                .querySelector("#editRST")
            if (editrst) {
                editrst
                .addEventListener("keypress", function () {
                    document.querySelector("#qrawhtmlmodal").innerHTML = ""; //ensure html refresh
                });
            }
        }
    }
    //MathJax.typeset([document.querySelector(`#${whereDiv}`)]);
}
