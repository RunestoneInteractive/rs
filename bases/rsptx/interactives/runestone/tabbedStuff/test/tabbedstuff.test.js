// Characterization tests for the TabbedStuff component. The DOM-construction
// tests were written against the jQuery implementation; the tab-switching
// tests encode the contract the jQuery-free version must own itself (the old
// implementation delegated switching to Bootstrap 3's jQuery tab plugin).
// Note: deliberately NO jquery-globals import here -- tabbedStuff must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TabbedStuff } from "../js/tabbedstuff.js";

function makeFixture({ id = "test_tabs_1", attrs = "", tabs } = {}) {
    tabs =
        tabs ??
        `
        <div data-component="tab" data-tabname="Question">
          <p>The question text.</p>
        </div>
        <div data-component="tab" data-tabname="Answer">
          <p>The answer text.</p>
        </div>`;
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="tabbedStuff" id="${id}" class="alert alert-warning" ${attrs}>${tabs}</div>
      </div>`;
    return document.getElementById(id);
}

async function makeTabs(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const ts = new TabbedStuff({ orig });
    await ts.component_ready_promise;
    return ts;
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
});

describe("construction", () => {
    it("replaces the original element with a tab list and panes", async () => {
        const ts = await makeTabs();
        const container = document.getElementById("test_tabs_1");
        expect(container).toBe(ts.containerDiv);
        expect(container.getAttribute("role")).toBe("tabpanel");
        const ul = container.querySelector("ul#test_tabs_1_tab");
        expect(ul.classList.contains("nav-tabs")).toBe(true);
        expect(ul.getAttribute("role")).toBe("tablist");
        const titles = [...ul.querySelectorAll("li a span")].map(
            (s) => s.textContent,
        );
        expect(titles).toEqual(["Question", "Answer"]);
        const panes = container.querySelectorAll(".tab-content .tab-pane");
        expect(panes.length).toBe(2);
        expect(panes[0].id).toBe("test_tabs_1-0");
        expect(panes[0].getAttribute("role")).toBe("tabpanel");
        expect(panes[0].textContent).toContain("The question text.");
        expect(panes[1].textContent).toContain("The answer text.");
    });

    it("carries the original classes over and links tabs to panes", async () => {
        await makeTabs();
        const container = document.getElementById("test_tabs_1");
        expect(container.classList.contains("alert-warning")).toBe(true);
        const anchors = container.querySelectorAll("li a");
        expect(anchors[0].getAttribute("href")).toBe("#test_tabs_1-0");
        expect(anchors[1].getAttribute("href")).toBe("#test_tabs_1-1");
        const lis = container.querySelectorAll("li");
        expect(lis[0].getAttribute("aria-controls")).toBe("test_tabs_1-0");
    });

    it("activates the first tab by default", async () => {
        await makeTabs();
        const container = document.getElementById("test_tabs_1");
        const lis = container.querySelectorAll("li");
        const panes = container.querySelectorAll(".tab-pane");
        expect(lis[0].classList.contains("active")).toBe(true);
        expect(panes[0].classList.contains("active")).toBe(true);
        expect(lis[1].classList.contains("active")).toBe(false);
        expect(panes[1].classList.contains("active")).toBe(false);
    });

    it("activates the tab marked data-active instead", async () => {
        await makeTabs({
            tabs: `
              <div data-component="tab" data-tabname="One"><p>1</p></div>
              <div data-component="tab" data-tabname="Two" data-active><p>2</p></div>`,
        });
        const container = document.getElementById("test_tabs_1");
        const lis = container.querySelectorAll("li");
        expect(lis[0].classList.contains("active")).toBe(false);
        expect(lis[1].classList.contains("active")).toBe(true);
    });

    it("activates nothing when the component is marked data-inactive", async () => {
        await makeTabs({ attrs: "data-inactive" });
        const container = document.getElementById("test_tabs_1");
        expect(container.querySelectorAll("li.active").length).toBe(0);
        expect(container.querySelectorAll(".tab-pane.active").length).toBe(0);
    });
});

describe("tab switching", () => {
    it("shows the clicked tab and hides the others", async () => {
        await makeTabs();
        const container = document.getElementById("test_tabs_1");
        const anchors = container.querySelectorAll("li a");
        const lis = container.querySelectorAll("li");
        const panes = container.querySelectorAll(".tab-pane");
        anchors[1].dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        expect(lis[1].classList.contains("active")).toBe(true);
        expect(panes[1].classList.contains("active")).toBe(true);
        expect(lis[0].classList.contains("active")).toBe(false);
        expect(panes[0].classList.contains("active")).toBe(false);
        anchors[0].dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        expect(lis[0].classList.contains("active")).toBe(true);
        expect(panes[1].classList.contains("active")).toBe(false);
    });

    it("refreshes CodeMirror instances in the shown tab", async () => {
        await makeTabs();
        const container = document.getElementById("test_tabs_1");
        const pane = container.querySelector("#test_tabs_1-1");
        const cmHost = document.createElement("div");
        cmHost.classList.add("CodeMirror");
        cmHost.CodeMirror = { refresh: vi.fn() };
        pane.appendChild(cmHost);
        container
            .querySelectorAll("li a")[1]
            .dispatchEvent(
                new MouseEvent("click", { bubbles: true, cancelable: true }),
            );
        expect(cmHost.CodeMirror.refresh).toHaveBeenCalled();
    });

    it("clicks deferred Disqus links in the shown tab", async () => {
        await makeTabs();
        const container = document.getElementById("test_tabs_1");
        const pane = container.querySelector("#test_tabs_1-1");
        const link = document.createElement("a");
        link.classList.add("disqus_thread_link");
        const clickSpy = vi.fn();
        link.addEventListener("click", clickSpy);
        pane.appendChild(link);
        container
            .querySelectorAll("li a")[1]
            .dispatchEvent(
                new MouseEvent("click", { bubbles: true, cancelable: true }),
            );
        expect(clickSpy).toHaveBeenCalled();
    });
});
