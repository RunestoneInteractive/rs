/*==========================================
=======    Master tabbedstuff.js    ========
============================================
===     This file contains the JS for    ===
=== the Runestone tabbedStuff component. ===
============================================
===              Created by              ===
===           Isaiah Mayerchak           ===
===               06/15/15               ===
===             Brad Miller              ===
===               06/15/15               ===
==========================================*/
"use strict";

var TSList = {}; // Dictionary that contains all instances of TabbedStuff objects

import RunestoneBase from "../../common/js/runestonebase";
import "../css/tabbedstuff.css";

// Define TabbedStuff object
export class TabbedStuff extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig;
        this.origElem = orig; // entire original <div> element that will be replaced by new HTML
        this.divid = orig.id;
        this.inactive = orig.hasAttribute("data-inactive");
        this.togglesList = []; // For use in Codemirror/Disqus
        this.childTabs = [];
        this.populateChildTabs();
        this.activeTab = 0; // default value--activeTab is the index of the tab that starts open
        this.findActiveTab();
        this.createTabContainer();
        this.indicate_component_ready();
    }
    /*===========================================
    == Update attributes of instance variables ==
    ==    variables according to specifications    ==
    ===========================================*/
    populateChildTabs() {
        for (var i = 0; i < this.origElem.childNodes.length; i++) {
            const node = this.origElem.childNodes[i];
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                node.dataset.component === "tab"
            ) {
                this.childTabs.push(node);
            }
        }
    }
    findActiveTab() {
        for (var i = 0; i < this.childTabs.length; i++) {
            if (this.childTabs[i].hasAttribute("data-active")) {
                this.activeTab = i;
            }
        }
    }
    /*==========================================
    == Creating/appending final HTML elements ==
    ==========================================*/
    createTabContainer() {
        this.containerDiv = document.createElement("div");
        this.containerDiv.id = this.divid;
        const origClass = this.origElem.getAttribute("class");
        if (origClass) {
            this.containerDiv.classList.add(
                ...origClass.split(" ").filter(Boolean),
            );
        }
        this.containerDiv.setAttribute("role", "tabpanel");
        this.tabsUL = document.createElement("ul");
        this.tabsUL.id = this.divid + "_tab";
        this.tabsUL.classList.add("nav", "nav-tabs");
        this.tabsUL.setAttribute("role", "tablist");
        this.tabContentDiv = document.createElement("div"); // Create tab content container that holds tab panes w/content
        this.tabContentDiv.classList.add("tab-content");
        this.createTabs(); // create and append tabs to the <ul>
        this.containerDiv.appendChild(this.tabsUL);
        this.containerDiv.appendChild(this.tabContentDiv);
        this.origElem.replaceWith(this.containerDiv);
    }
    createTabs() {
        // Create tabs in format <li><a><span></span></a></li> to be appended to the <ul>
        for (var i = 0; i < this.childTabs.length; i++) {
            // First create tabname and tabfriendly name that has no spaces to be used for the id
            var tabListElement = document.createElement("li");
            tabListElement.setAttribute("role", "presentation");
            tabListElement.setAttribute(
                "aria-controls",
                this.divid + "-" + i,
            );
            var tabElement = document.createElement("a");
            tabElement.setAttribute("href", "#" + this.divid + "-" + i);
            tabElement.setAttribute("role", "tab");
            tabElement.addEventListener("click", this.handleTabClick(i));
            var tabTitle = document.createElement("span"); // Title of tab--what the user will see
            tabTitle.textContent = this.childTabs[i].dataset.tabname;
            tabElement.appendChild(tabTitle);
            tabListElement.appendChild(tabElement);
            this.tabsUL.appendChild(tabListElement);
            // tabPane is what holds the contents of the tab
            var tabPaneDiv = document.createElement("div");
            tabPaneDiv.id = this.divid + "-" + i;
            tabPaneDiv.classList.add("tab-pane");
            tabPaneDiv.setAttribute("role", "tabpanel");
            tabPaneDiv.appendChild(this.childTabs[i]);
            if (!this.inactive) {
                if (this.activeTab === i) {
                    tabListElement.classList.add("active");
                    tabPaneDiv.classList.add("active");
                }
            }
            this.togglesList.push(tabElement);
            this.tabContentDiv.appendChild(tabPaneDiv);
        }
    }
    /*=====================================================
    == Tab switching (was Bootstrap 3's jQuery tab plugin) ==
    =====================================================*/
    handleTabClick(index) {
        return (event) => {
            event.preventDefault();
            this.showTab(index);
        };
    }
    showTab(index) {
        for (const li of this.tabsUL.children) {
            li.classList.remove("active");
        }
        for (const pane of this.tabContentDiv.children) {
            pane.classList.remove("active");
        }
        this.tabsUL.children[index].classList.add("active");
        const pane = this.tabContentDiv.children[index];
        pane.classList.add("active");
        // Anything that was rendered while the pane was hidden may need a
        // nudge now that it is visible (was the shown.bs.tab handler).
        for (const link of pane.querySelectorAll(".disqus_thread_link")) {
            link.click();
        }
        for (const el of pane.querySelectorAll(".CodeMirror")) {
            el.CodeMirror.refresh();
        }
    }
}

/*=================================
== Find the custom HTML tags and ==
==     execute our code on them        ==
=================================*/
function initTabbedStuff() {
    for (const element of document.querySelectorAll(
        "[data-component=tabbedStuff]",
    )) {
        TSList[element.id] = new TabbedStuff({ orig: element });
    }
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTabbedStuff);
} else {
    initTabbedStuff();
}
