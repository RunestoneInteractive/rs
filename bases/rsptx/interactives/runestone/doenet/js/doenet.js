"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
// TODO fix this, in the meantime including from sphinx_static_files.html
// ERROR in ./runestone/doenet/js/doenet-standalone.js 240673:19
//Module parse failed: Unterminated template (240673:19)
//You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders
//import "./doenet-standalone.js";

console.log("IN DOENET - add event listener for splice");
// SPLICE Events
window.addEventListener("message", (event) => {
  console.log("IN DOENET - got a message", event);
  if (event.data.subject == "SPLICE.reportScoreAndState") {
    console.log(event.data.score);
    console.log(event.data.state);
    event.data.course_name = eBookConfig.course;
    event.data.div_id = event.data.state.activityId;
    let ev = {
      event: "doenet",
      div_id: event.data.state.activityId,
      percent: event.data.score,
      correct: event.data.score  == 1 ? 'T' : 'F',
      act: JSON.stringify(event.data),
      answer: JSON.stringify(event.data),
    };
    window.componentMap[event.data.state.activityId].logBookEvent(ev);
  } else if (event.data.subject == "SPLICE.sendEvent") {
    console.log(event.data.location);
    console.log(event.data.name);
    console.log(event.data.data);
  }
});

// separate into constructor and init
export class Doenet extends RunestoneBase {
  constructor(opts) {
    super(opts);
    console.log(opts);
    console.log("Jason update oct 24th");
    this.doenetML = opts.doenetML;
    console.log("opts.orig.id", opts.orig.id);
    var orig = $(opts.orig).find("div")[0];
    console.log(orig);
    console.log(orig.id);
    console.log(`${eBookConfig.new_server_prefix}/logger/bookevent`);
    // todo - think about how we pass around the doenetML
    //window.renderDoenetToContainer(orig, this.doenetML);

    var loadPageStateUrl = `/ns/assessment/getDoenetState?div_id=${opts.orig.id}&course_name=${eBookConfig.course}&event=doenet`
            // data.div_id = this.divid;
            // data.course = eBookConfig.course;
            // data.event = eventInfo;

    window.renderDoenetToContainer(orig, this.doenetML, {
      flags: {
        // showCorrectness,
        // readOnly,
        // showFeedback,
        // showHints,
        showCorrectness: true,
        readOnly: false,
        solutionDisplayMode: "button",
        showFeedback: true,
        showHints: true,
        allowLoadState: false,
        allowSaveState: true,
        allowLocalState: false,
        allowSaveSubmissions: true,
        allowSaveEvents: false,
        autoSubmit: false,
      },
      addBottomPadding: false,
      activityId: opts.orig.id,
      apiURLs: { 
        postMessages: true,
        loadPageState: loadPageStateUrl
      },
    });

    //this.checkServer("hparsonsAnswer", true);
  }

  async logCurrentAnswer(sid) {}

  renderFeedback() {}

  disableInteraction() {}

  checkLocalStorage() {}
  setLocalStorage() {}

  restoreAnswers(data) {
    console.log("TODO IMPLEMENT loading data from doenet activity", data);
  }
}

//
// Page Initialization
//

$(document).on("runestone:login-complete", function () {
  //ACFactory.createScratchActivecode();
  $("[data-component=doenet]").each(function () {
      if ($(this).closest("[data-component=timedAssessment]").length == 0) {
          // If this element exists within a timed component, don't render it here
          try {
              window.componentMap[this.id] = new Doenet({orig : this});
              // ACFactory.createActiveCode(
              //     this,
              //     $(this).find("textarea").data("lang")
              // );
          } catch (err) {
              console.log(`Error rendering Activecode Problem ${this.id}
              Details: ${err}`);
          }
      }
  });
  // The componentMap can have any component, not all of them have a disableSaveLoad
  // method or an enableSaveLoad method.  So we need to check for that before calling it.
  // if (loggedout) {
  //     for (let k in window.componentMap) {
  //         if (window.componentMap[k].disableSaveLoad) {
  //             window.componentMap[k].disableSaveLoad();
  //         }
  //     }
  // } else {
  //     for (let k in window.componentMap) {
  //         if (window.componentMap[k].enableSaveLoad) {
  //             window.componentMap[k].enableSaveLoad();
  //         }
  //     }
  // }
});

if (typeof window.component_factory === "undefined") {
  window.component_factory = {};
}
window.component_factory.doenet = (opts) => {
  return new Doenet(opts);
};
