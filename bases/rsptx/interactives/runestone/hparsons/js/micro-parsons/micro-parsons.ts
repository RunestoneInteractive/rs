import { MicroParsonsEvent } from "./LoggingEvents";
import { ParsonsInput } from "./ParsonsInput";
import "./style/style.css";
import hljs from "highlight.js/lib/core";

import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("python", python);

export class MicroParsonsElement extends HTMLElement {
  private root: HTMLElement;

  private _parsonsData: Array<string>;
  public parsonsExplanation: Array<string> | null;
  public hparsonsInput: IParsonsInput;
  private inputType: string;

  public static toolCount: number = 0;

  public toolNumber: number;

  public temporaryInputEvent: MicroParsonsEvent.Input | null;

  public language: string;
  public hljsLanguage: string | undefined;

  public codeBefore: string | null;
  public codeAfter: string | null;

  constructor() {
    super();

    MicroParsonsElement.toolCount += 1;
    this.toolNumber = MicroParsonsElement.toolCount;

    this.root = this;

    const reusable = this.getAttribute("reuse") ? true : false;
    const randomize = this.getAttribute("randomize") ? true : false;
    this.hparsonsInput = new ParsonsInput(this, reusable, randomize);

    // a div wrapping the input and the test case status
    // init regex input based on the input type
    this._parsonsData = new Array<string>();
    this.parsonsExplanation = null;
    this.inputType = "parsons";
    // support all languages specified here, or "raw" for raw html.
    // for other languages or none, render text as-is.
    this.language = this.getAttribute("language") || "none";
    let languageMap = new Map(
      Object.entries({
        html: "xml",
        python: "python",
        javascript: "javascript",
        java: "java",
        sql: "sql",
      }),
    );
    this.hljsLanguage = languageMap.get(this.language);

    this.initInput();
    this.temporaryInputEvent = null;

    this.codeBefore = null;
    this.codeAfter = null;
  }

  set parsonsData(data: Array<string>) {
    this._parsonsData = data;
    if (this.inputType == "parsons") {
      (this.hparsonsInput as ParsonsInput).setSourceBlocks(
        data,
        this.parsonsExplanation,
      );
    }
  }

  get parsonsData(): Array<string> {
    return this._parsonsData;
  }

  public logEvent = (eventContent: any): void => {
    const ev = new CustomEvent("micro-parsons", {
      bubbles: true,
      detail: { ...eventContent },
    });
    this.dispatchEvent(ev);
  };

  private initInput() {
    // the only mode supporting is parsons right now; removed the text entry mode
    this.inputType = "parsons";
    this._parsonsData = new Array<string>();
    this.parsonsExplanation = null;
    const reusable = this.getAttribute("reuse") != null ? true : false;
    const randomize = this.getAttribute("randomize") != null ? true : false;
    this.hparsonsInput = new ParsonsInput(this, reusable, randomize);
    this.root.appendChild(this.hparsonsInput.el);
  }

  public resetInput() {
    (this.hparsonsInput as ParsonsInput).resetInput();
    const resetEvent: MicroParsonsEvent.Reset = {
      type: "reset",
    };
    this.logEvent(resetEvent);
  }

  // restore student answer from outside storage
  public restoreAnswer(answer: Array<string>) {
    this.hparsonsInput.restoreAnswer(answer);
  }

  public restoreAnswerByIndices(indices: Array<number>) {
    (this.hparsonsInput as ParsonsInput).restoreAnswerByIndices(indices);
  }

  public getCurrentInput(addSpace: boolean) {
    return this.hparsonsInput.getText(addSpace);
  }

  public getParsonsTextArray() {
    return (this.hparsonsInput as ParsonsInput)._getTextArray();
  }

  public getBlockIndices(): number[] {
    return (this.hparsonsInput as ParsonsInput).getBlockIndices();
  }

  public setCodeContext(props: {
    before: string | null;
    after: string | null;
  }) {
    if (props.before) {
      this.codeBefore = props.before;
      let container: HTMLPreElement;
      if (this.querySelector(".context.before")) {
        container = this.querySelector(".context.before") as HTMLPreElement;
      } else {
        container = document.createElement("pre");
        container.className = "context before";
        this.querySelector(".hparsons-input")!.insertBefore(
          container,
          this.querySelector(".drop-area"),
        );
      }
      container.innerHTML = this.codeBefore;
      if (this.hljsLanguage) {
        container.className = "context before";
        container.classList.add(this.hljsLanguage);
        hljs.highlightElement(container);
      }
    }
    if (props.after) {
      this.codeAfter = props.after;
      let container: HTMLPreElement;
      if (this.querySelector(".context.after")) {
        container = this.querySelector(".context.after") as HTMLPreElement;
      } else {
        container = document.createElement("pre");
        container.className = "context after";
        this.querySelector(".hparsons-input")!.appendChild(container);
      }
      container.innerHTML = this.codeAfter;
      if (this.hljsLanguage) {
        container.className = "context after";
        container.classList.add(this.hljsLanguage);
        hljs.highlightElement(container);
      }
    }
  }
}

export const InitMicroParsons = (props: MicroParsonsProps) => {
  let parentElem: HTMLElement | null;
  try {
    parentElem = document.querySelector(props.selector);
  } catch {
    throw "micro-parsons: init: selector error";
  }
  if (parentElem == null || parentElem.tagName != "DIV") {
    throw "micro-parsons: element not a div";
  }
  const language =
    ["javascript", "sql", "java", "html", "python", "raw"].indexOf(
      props.language || "",
    ) == -1
      ? ""
      : `language='${props.language}'`;
  const id = props.id ? `id='${props.id}'` : "";
  const innerHTML = `<micro-parsons ${props.reuse ? "reuse" : ""} ${props.randomize === false ? "" : "randomize"} ${language} ${id}></micro-parsons>`;
  parentElem.innerHTML = innerHTML;
  const mParsons = parentElem.firstChild as MicroParsonsElement;
  mParsons.parsonsExplanation = props.parsonsTooltips;
  mParsons.parsonsData = props.parsonsBlocks;
  if (props.context) {
    mParsons.setCodeContext(props.context);
  }
};

customElements.define("micro-parsons", MicroParsonsElement);
