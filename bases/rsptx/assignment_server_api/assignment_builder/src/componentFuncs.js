// Render a question in the provided div.

// TODO: remove document.querySelector dependency
export async function renderRunestoneComponent(
  previewRef, // This is a React ref object
  moreOpts
) {
  /**
   *  The HTML template for the component is in the innerHTML of the
   *  previewRef.  whenever the  template changes we need to re-render
   *  We do this by extracing the [data-component] attribute and then
   *  Use the value of that attribute to look up the component factory
   *  The component factory then turns the template into the fully rendered
   * component.
   */
  if (typeof moreOpts === "undefined") {
    moreOpts = {};
  }
  if ("author" in moreOpts) {
    delete moreOpts.author;
  }
  let patt = /..\/_images/g;

  previewRef.current.innerHTML = previewRef.current.innerHTML.replace(
    patt,
    `${window.eBookConfig.app}/books/published/${window.eBookConfig.basecourse}/_images`
  );

  if (typeof window.componentMap === "undefined") {
    window.componentMap = {};
  }

  // figure out what kind of component we are dealing with
  let componentKind = previewRef.current.querySelector("[data-component]").dataset.component;
  // webwork problems do not have a data-component attribute so we have to try to figure it out.
  //

  if (
    (!componentKind && previewRef.current.innerHTML.indexOf("handleWW") >= 0) ||
    previewRef.current.innerHTML.indexOf("webwork") >= 0
  ) {
    componentKind = "webwork";
  }
  // Import all the js needed for this component before rendering
  await window.runestoneComponents.runestone_import(componentKind);
  let opt = {};

  opt.orig = previewRef.current.querySelector("[data-component]");
  if (opt.orig) {
    opt.lang = opt.orig.dataset.lang;
    if (!opt.lang) {
      let langData = opt.orig.querySelector("[data-lang]");

      if (langData) {
        opt.lang = langData.dataset.lang;
      }
    }
    // We don't want to store runs or keep results so set useServices to fales
    opt.useRunestoneServices = false;
    opt.graderactive = false;
    opt.python3 = true;
    if (typeof moreOpts !== "undefined") {
      for (let key in moreOpts) {
        opt[key] = moreOpts[key];
      }
    }
  }

  // loading a valid component will also initialize the component factory
  if (typeof component_factory === "undefined") {
    alert("Error:  Missing the component factory!  probably a webpack version mismatch");
  } else {
    if (!window.component_factory[componentKind] && !previewRef.innerHTML) {
      previewRef.current.innerHTML = `<p>Preview not available for ${componentKind}</p>`;
    } else {
      try {
        // Grab the preamble if it exists.
        // add it to opt so that it can be used by the component factory
        // This is used for mathjax processing of the preview.
        let preamble = document.querySelector("div.hidden-content.process-math");
        if (preamble) {
          preamble = preamble.innerHTML;
          opt.preamble = preamble;
        }
        let res = window.component_factory[componentKind](opt);
        console.log("res", res);

        // For components with async initialization (like selectquestion),
        // call initialize() method if it exists
        if (!!moreOpts.isCalledFromBuilder && res && typeof res.initialize === "function") {
          await res.initialize();
        }

        res.multiGrader = moreOpts.multiGrader;
        if (componentKind === "activecode") {
          if (moreOpts.multiGrader) {
            window.componentMap[`${moreOpts.gradingContainer} ${res.divid}`] = res;
          } else {
            window.componentMap[res.divid] = res;
          }
        }
        // add a button to the preview to allow the user to flag this compenent for review
        let flagButton = document.createElement("button");
        console.log("res", res);
        flagButton.classList.add("flag-for-review");
        flagButton.textContent = "Flag for Review";
        flagButton.addEventListener("click", async function () {
          let data = {
            question_name: res.divid || res.selector_id || res.origOpts.orig.id
          };
          if (!data.question_name) {
            alert("Error:  Cannot determine question name to flag for review");
            return;
          }
          console.log("Flagging question for review", data.question_name);
          // Send a POST request to the server to flag the question
          let response = await fetch("/admin/instructor/flag_question", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (response.ok) {
            let resp = await response.json();
            if (resp.success === true) {
              flagButton.textContent = "Question Flagged";
              flagButton.style.backgroundColor = "#22c55e";
              flagButton.style.color = "white";
              flagButton.disabled = true;
            } else {
              alert("Error: " + resp.message);
            }
          } else {
            alert("Error: " + response.statusText);
          }
        });
        previewRef.current.appendChild(flagButton);
      } catch (e) {
        console.log(e);
        previewRef.current.innerHTML = `<p>An error occurred while trying to render a ${componentKind}</p>`;
      }
    }
  }
  // TODO: Make sure MathJax is loaded and typeset the preview
  //MathJax.typeset([previewRef.current]);
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

export function createMCQTemplate(uniqueId, instructions, choices) {
  // count the number of correct choices
  var numCorrect = 0;

  for (let i = 0; i < choices.length; i++) {
    if (choices[i].correct) {
      numCorrect++;
    }
  }
  var preview_src = `
    <div class="ptx-runestone-container">
    <div class="runestone explainer ac_section ">
    <ul data-component="multiplechoice" id="${uniqueId}" data-multipleanswers='${numCorrect > 1 ? "true" : "false"}'>
    <p>${instructions}</p>
    `;

  for (let i = 0; i < choices.length; i++) {
    preview_src += `<li data-component="answer" 
                id="${uniqueId}_opt_${String.fromCharCode(97 + i)}"
                ${choices[i].correct ? "data-correct='yes'" : ""}
            >
            ${choices[i].choice}
            </li>
            <li data-component="feedback"
                id="${uniqueId}_opt_${String.fromCharCode(97 + i)}"
            >
            ${choices[i].feedback}
            </li>`;
  }
  preview_src += "</ul></div></div>";
  console.log(preview_src);
  return preview_src;
}

export function createShortAnswerTemplate(uniqueId, instructions, attachment) {
  var preview_src = `
    <div class="ptx-runestone-container">
    <div class="runestone explainer ac_section ">
    <div data-component="shortanswer" id="${uniqueId}" ${attachment ? "data-attachment" : ""}>
    <p>${instructions}</p>
    </div></div></div>`;

  return preview_src;
}
