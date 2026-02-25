/*
ShowEval, a JS module for creating visualizations of expression evaluation. Mainly for programming tutorials.

Al Sweigart
al@inventwithpython.com
https://github.com/asweigart/
*/

var SHOWEVAL = (function () {
  var thisModule = {};


  thisModule.ShowEval = function(container, steps, showTrace, addButtons) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    this.container = container;
    this.container.classList.add('showEval');
    this.steps = steps.slice();
    this.currentStep = 0;
    this.createTrace = showTrace; // TODO - reset doesn't work for traces

    if (addButtons == true) {
      let nextButton = document.createElement("button");
      nextButton.textContent = 'Next';
      nextButton.addEventListener("click", () => {
        this.evaluateStep();
      });
      this.container.appendChild(nextButton);

      let resetButton = document.createElement("button");
      resetButton.textContent = 'Reset';
      resetButton.addEventListener("click", () => {
        this.evaluateStep();
      });
      this.container.appendChild(resetButton);

      let codeDiv = document.createElement("div");
      this.container.appendChild(codeDiv);
      this.container = codeDiv;
    }

    // create elements
    this.currentStepDiv = document.createElement('div');
    this.currentStepDiv.classList.add('currentStepDiv');
    this.container.appendChild(this.currentStepDiv);
    
    let preSpan = document.createElement('span');
    preSpan.style.verticalAlign = 'text-top';
    preSpan.classList.add('pre');
    this.currentStepDiv.appendChild(preSpan);
    
    let evalSpan = document.createElement('span');
    evalSpan.style.verticalAlign = 'text-top';
    evalSpan.classList.add('eval');
    this.currentStepDiv.appendChild(evalSpan);
    
    let postSpan = document.createElement('span');
    postSpan.style.verticalAlign = 'text-top';
    postSpan.classList.add('post');
    this.currentStepDiv.appendChild(postSpan);

    // parse steps and turn into a 4-string array: ['pre', 'before eval', 'after eval', 'post']
    for (var i = 0 ; i < this.steps.length; i++) {
      var s = this.steps[i];
      this.steps[i] = [s.substring(0, s.indexOf('{{')), // 'pre'
                       s.substring(s.indexOf('{{') + 2, s.indexOf('}}{{')), // 'before eval'
                       s.substring(s.indexOf('}}{{') + 4, s.indexOf('}}', s.indexOf('}}{{') + 4)), // 'after eval'
                       s.substring(s.indexOf('}}', s.indexOf('}}{{') + 4) + 2)];  // 'post'
    }
    this.reset();
  };

  thisModule.ShowEval.prototype.reset = function() {
    this.container.querySelectorAll('.previousStep').forEach(el => el.remove());
    this.setStep(0);
  };

  thisModule.ShowEval.prototype.setStep = function(step) {
    this.currentStep = step;
    newWidth = this.getWidth(this.steps[this.currentStep][1]);
    this.currentStepDiv.querySelector('.eval').style.width = newWidth + 'px';
    this.currentStepDiv.querySelector('.pre').innerHTML = this.steps[step][0];
    this.currentStepDiv.querySelector('.eval').innerHTML = this.steps[step][1];
    this.currentStepDiv.querySelector('.post').innerHTML = this.steps[step][3];
  };

  thisModule.ShowEval.prototype.getWidth = function(text) { // TODO - class style must match or else width will be off.
    var newElem = document.createElement('div');
    newElem.classList.add('showEval');
    newElem.style.display = 'none';
    newElem.innerHTML = text;
    document.body.appendChild(newElem);
    var newWidth = newElem.offsetWidth + 1; // +1 is a hack
    newElem.remove();

    return newWidth;
  };

  thisModule.ShowEval.prototype.createPreviousStepDiv = function(step) {
    let prevDiv = document.createElement('div');
    prevDiv.classList.add('previousStep');
    prevDiv.innerHTML = this.steps[step][0] + this.steps[step][1] + this.steps[step][3];
    this.currentStepDiv.parentNode.insertBefore(prevDiv, this.currentStepDiv);
  };

  thisModule.ShowEval.prototype.evaluateStep = function(step) {
    if (step === undefined) {
      step = this.currentStep;
    }
    if (this.currentStep >= this.steps.length) {
      //this.currentStep = 0;
      //step = 0;
      return; // do nothing if on last step
    }
    this.setStep(step);

    var fadeInSpeed = 0;
    if (this.createTrace) {
      this.createPreviousStepDiv(step);
      this.currentStepDiv.style.display = 'none';
      fadeInSpeed = 200;
    }

    newWidth = this.getWidth(this.steps[step][2]);
    var evalElem = this.currentStepDiv.querySelector('.eval');

    var thisShowEval = this;

    evalElem.style.color = 'red';

    // Fade in currentStepDiv
    this.fadeToOpacity(this.currentStepDiv, 1, fadeInSpeed, function() {
      window.setTimeout(function() {
        // Fade out evalElem
        thisShowEval.fadeToOpacity(evalElem, 0, 400, function() {
          //evalElem.style.overflow = 'hidden';
          // Animate width
          thisShowEval.animateWidth(evalElem, newWidth, 400, function() {
            evalElem.innerHTML = thisShowEval.steps[step][2];
            // Fade in evalElem
            thisShowEval.fadeToOpacity(evalElem, 1, 400, function() {
              window.setTimeout(function() {
                //evalElem.style.overflow = 'visible';
                evalElem.style.color = 'black';
                thisShowEval.currentStep += 1;
                if (thisShowEval.currentStep < thisShowEval.steps.length) {
                  thisShowEval.setStep(thisShowEval.currentStep);
                }
              }, 600);
            });
          });
        });
      }, 600);
    });
  };

  // Helper function to fade element to specific opacity
  thisModule.ShowEval.prototype.fadeToOpacity = function(element, targetOpacity, duration, callback) {
    if (duration === 0) {
      element.style.opacity = targetOpacity;
      if (targetOpacity === 1 && element.style.display === 'none') {
        element.style.display = '';
      }
      if (callback) callback();
      return;
    }

    var startOpacity = parseFloat(window.getComputedStyle(element).opacity) || 0;
    var startTime = performance.now();
    
    if (targetOpacity === 1 && element.style.display === 'none') {
      element.style.display = '';
      element.style.opacity = startOpacity;
    }

    function animate(currentTime) {
      var elapsed = currentTime - startTime;
      var progress = Math.min(elapsed / duration, 1);
      
      element.style.opacity = startOpacity + (targetOpacity - startOpacity) * progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (callback) callback();
      }
    }
    
    requestAnimationFrame(animate);
  };

  // Helper function to animate width
  thisModule.ShowEval.prototype.animateWidth = function(element, targetWidth, duration, callback) {
    var startWidth = element.offsetWidth;
    var startTime = performance.now();

    function animate(currentTime) {
      var elapsed = currentTime - startTime;
      var progress = Math.min(elapsed / duration, 1);
      
      element.style.width = (startWidth + (targetWidth - startWidth) * progress) + 'px';
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (callback) callback();
      }
    }
    
    requestAnimationFrame(animate);
  };

  return thisModule;
}());

var s;
let next = document.querySelector("#nextStep");
let reset = document.querySelector("#reset");
reset.addEventListener("click", function () {
  console.log("Reset button clicked");
  s.reset(0);
});
let nextStep = document.querySelector("#nextStep");
nextStep.addEventListener("click", function () {
  const frameid = window.frameElement.id;
  console.log(`Next Step button clicked in frame ${frameid}`);
  const message = {
    subject: "SPLICE.sendEvent",
    name: "nextStepClicked",
    activity_id: frameid,
    message_id: 10,
  };
  window.parent.postMessage(message, "*");
  s.evaluateStep();
});


