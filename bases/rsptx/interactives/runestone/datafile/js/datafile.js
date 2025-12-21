/*==========================================
=======     Master datafile.js      ========
============================================
===     This file contains the JS for    ===
===   the Runestone Datafile component.  ===
============================================
===              Created by              ===
===           Isaiah Mayerchak           ===
===                6/8/15                ===
==========================================*/
"use strict";

import RunestoneBase from "../../common/js/runestonebase";
import "../css/datafile.css";

var dfList = {}; // Dictionary that contains all instances of Datafile objects

class DataFile extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig; // entire <pre> element that will be replaced by new HTML
        this.origElem = orig;
        this.divid = orig.id;
        this.dataEdit = this.parseBooleanAttribute(orig, "data-edit");
        this.isImage = this.parseBooleanAttribute(orig, "data-isimage");
        this.displayClass = "block"; // Users can specify the non-edit component to be hidden--default is not hidden
        if (this.parseBooleanAttribute(orig, "data-hidden")) {
            this.displayClass = "none";
        }
        // Users can specify numbers of rows/columns when editing is true
        this.numberOfRows = orig.dataset.rows;
        this.numberOfCols = orig.dataset.cols;

        if (!this.isImage) {
            if (this.dataEdit) {
                this.createTextArea();
            } else {
                this.createPre();
            }
            if (this.fileName) {
                this.containerDiv.dataset.filename = this.fileName;
            }
        }
        // search for a parent div with the class 'datafile_caption' in plain javascript
        let captionDiv = this.containerDiv.parentElement?.querySelector(".datafile_caption");
        if (captionDiv && this.displayClass === "none") {
            // hide the captionDiv if the datafile is hidden
            captionDiv.style.display = "none";
        }
        this.indicate_component_ready();
    }
    /*=====================================
    == Create either <pre> or <textarea> ==
    ==  depending on if editing is true  ==
    ==================================*/
    createPre() {
        this.containerDiv = document.createElement("pre");
        this.containerDiv.id = this.divid;
        this.containerDiv.style.display = this.displayClass;
        this.containerDiv.innerHTML = this.origElem.innerHTML;
        this.origElem.replaceWith(this.containerDiv);
    }
    createTextArea() {
        this.containerDiv = document.createElement("textarea");
        this.containerDiv.id = this.divid;
        if (this.numberOfRows) this.containerDiv.rows = this.numberOfRows;
        if (this.numberOfCols) this.containerDiv.cols = this.numberOfCols;
        this.containerDiv.innerHTML = this.origElem.innerHTML;
        this.containerDiv.classList.add("datafiletextfield");
        this.origElem.replaceWith(this.containerDiv);
    }
}

/*=================================
== Find the custom HTML tags and ==
==   execute our code on them    ==
=================================*/
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-component=datafile]").forEach(function (el) {
        try {
            dfList[el.id] = new DataFile({ orig: el });
        } catch (err) {
            console.log(`Error rendering DataFile ${el.id}`);
        }
    });
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}

window.component_factory.datafile = function (opts) {
    return new DataFile(opts);
};
