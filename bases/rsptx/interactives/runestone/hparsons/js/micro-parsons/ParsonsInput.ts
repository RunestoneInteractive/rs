import Sortable from "sortablejs";
import { MicroParsonsEvent } from "./LoggingEvents";
import hljs from "highlight.js/lib/core";

declare class MicroParsons {
  logEvent(event: any): void;
  public temporaryInputEvent: any;
  public toolNumber: number;
  public language: string;
  public hljsLanguage: string | undefined;
}

export class ParsonsInput implements IParsonsInput {
  // The input element
  public el: HTMLDivElement;
  private _dropArea: HTMLDivElement;
  private _dragArea: HTMLDivElement;
  private _dropSortable: Sortable | null;
  private _dragSortable: Sortable | null;
  public parentElement: MicroParsons;
  private _prevPosition: number;
  public reusable: boolean;
  private randomize: boolean;
  private storedSourceBlocks: Array<string>;
  private storedSourceBlockExplanations: Array<string> | null;
  private blockOrder: Array<number>;
  private hljsLanguage: string | undefined;
  private _liveRegion: HTMLDivElement;

  // if the input has been initialized once
  private initialized: boolean;
  constructor(
    parentElement: MicroParsons,
    reusable: boolean,
    randomize: boolean,
  ) {
    this.el = document.createElement("div");
    this.el.classList.add("hparsons-input");

    this.parentElement = parentElement;

    this.el.id =
      "hparsonstool-" + this.parentElement.toolNumber + "-parsons-input";

    const dragTip = document.createElement("div");
    dragTip.innerText = "Drag or click the blocks below to form your code:";
    dragTip.classList.add("hparsons-tip");
    this.el.append(dragTip);

    this._dragArea = document.createElement("div");
    this.el.appendChild(this._dragArea);
    this._dragArea.classList.add("drag-area");
    this._dragArea.setAttribute("role", "listbox");
    this._dragArea.setAttribute("aria-label", "Available blocks");

    const dropTip = document.createElement("div");
    dropTip.innerText = "Your code (click on a block to remove it):";
    dropTip.classList.add("hparsons-tip");
    this.el.append(dropTip);

    this._dropArea = document.createElement("div");
    this.el.appendChild(this._dropArea);
    this._dropArea.classList.add("drop-area");
    this._dropArea.setAttribute("role", "listbox");
    this._dropArea.setAttribute("aria-label", "Answer area");
    this._prevPosition = -1;

    // Visually-hidden live region for screen-reader announcements
    this._liveRegion = document.createElement("div");
    this._liveRegion.setAttribute("aria-live", "polite");
    this._liveRegion.setAttribute("aria-atomic", "true");
    this._liveRegion.classList.add("sr-only");
    this.el.appendChild(this._liveRegion);

    this.storedSourceBlocks = [];
    this.blockOrder = [];
    this.storedSourceBlockExplanations = null;

    this.reusable = reusable;
    this.randomize = randomize;

    this._dragSortable = null;
    this._dropSortable = null;
    this._initSortable();
    this._setupKeyboardNav();

    this.initialized = false;
  }

  public getText = (addSpace: boolean): string => {
    let ret = "";
    if (this._dropArea.hasChildNodes()) {
      let el = this._dropArea.firstChild as HTMLDivElement;
      ret += this._getTextFromBlock(el);
      while (el.nextSibling) {
        el = el.nextSibling as HTMLDivElement;
        ret += addSpace ? " " : "";
        ret += this._getTextFromBlock(el);
      }
      return ret;
    } else {
      return ret;
    }
  };

  public getBlockIndices = (): number[] => {
    const blocks = this._dropArea.querySelectorAll(".parsons-block");
    return Array.from(blocks).map((block) =>
      parseInt((block as HTMLDivElement).dataset.index || "-1"),
    );
  };

  // getting the code from one block, and ignore tooltip text
  private _getTextFromBlock = (block: HTMLDivElement): string => {
    if (this.parentElement.language == "raw") {
      return block.innerHTML;
    }
    if (!block.lastChild || block.lastChild.nodeType != Node.ELEMENT_NODE) {
      return block.textContent || "";
    }
    const tooltipLength = (
      block.lastChild as HTMLDivElement
    ).classList.contains("parsons-tooltip")
      ? (block.lastChild as HTMLDivElement).textContent?.length || 0
      : 0;
    if (tooltipLength > 0) {
      return (block.textContent || "").slice(0, -tooltipLength);
    }
    return block.textContent || "";
  };

  // Durstenfeld shuffle
  private shuffleArray(array: Array<any>) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  public setSourceBlocks = (
    data: Array<string>,
    tooltips: Array<string> | null,
  ): void => {
    this.blockOrder = [];
    for (let i = 0; i < data.length; ++i) {
      this.blockOrder.push(i);
    }

    // shuffle source blocks if randomize
    if (this.randomize) {
      let originalOrder = JSON.stringify(this.blockOrder);
      this.shuffleArray(this.blockOrder);
      while (JSON.stringify(this.blockOrder) == originalOrder) {
        this.shuffleArray(this.blockOrder);
      }
    }

    this.storedSourceBlocks = data;
    this.storedSourceBlockExplanations = tooltips;
    this._resetInput();
  };

  // TODO: not efficient enough. should not need to create new elements; simply sorting them should be good.
  private _resetInput = (): void => {
    // clearing previous blocks
    while (this._dragArea.firstChild) {
      this._dragArea.removeChild(this._dragArea.firstChild);
    }
    while (this._dropArea.firstChild) {
      this._dropArea.removeChild(this._dropArea.firstChild);
    }

    // add new blocks
    for (let i = 0; i < this.blockOrder.length; ++i) {
      const newBlock = document.createElement("div");
      newBlock.dataset.index = this.blockOrder[i].toString();
      this._dragArea.appendChild(newBlock);
      if (this.storedSourceBlocks[this.blockOrder[i]] === " ") {
        newBlock.innerHTML = "&nbsp;";
      } else {
        if (this.parentElement.hljsLanguage) {
          newBlock.innerHTML = hljs.highlight(
            this.storedSourceBlocks[this.blockOrder[i]],
            { language: this.parentElement.hljsLanguage, ignoreIllegals: true },
          ).value;
        } else if (this.parentElement.language == "raw") {
          newBlock.innerHTML = this.storedSourceBlocks[this.blockOrder[i]];
        } else {
          newBlock.innerText = this.storedSourceBlocks[this.blockOrder[i]];
        }
      }
      newBlock.style.display = "inline-block";
      newBlock.classList.add("parsons-block");
      newBlock.onclick = (ev) => {
        this._onBlockClicked(newBlock, ev);
      };
      // creating tooltip
      if (
        this.storedSourceBlockExplanations &&
        this.storedSourceBlockExplanations[this.blockOrder[i]]
      ) {
        const tooltip = document.createElement("div");
        tooltip.innerText =
          this.storedSourceBlockExplanations[this.blockOrder[i]];
        tooltip.classList.add("parsons-tooltip");
        newBlock.appendChild(tooltip);
      }
    }

    this._updateBlockAria();
  };

  private _onBlockClicked = (block: Node, ev: Event): void => {
    const blockText = this._getTextFromBlock(block as HTMLDivElement).trim();
    if (block.parentElement == this._dragArea) {
      let endPosition;
      if (this.reusable) {
        const blockCopy = block.cloneNode(true) as HTMLDivElement;
        blockCopy.onclick = (ev) => this._onBlockClicked(blockCopy, ev);
        this._dropArea.appendChild(blockCopy);
        endPosition = this._getBlockPosition(blockCopy);
      } else {
        this._dropArea.appendChild(block);
        endPosition = this._getBlockPosition(block);
      }
      const inputEvent: MicroParsonsEvent.Input = {
        type: "input",
        action: MicroParsonsEvent.InputAction.ADD,
        position: [-1, endPosition],
        answer: this._getTextArray(),
      };
      if (ev.isTrusted) {
        // if false: could be triggered by restoreAnswer.
        this.parentElement.logEvent(inputEvent);
      }
      this._updateBlockAria();
      this._announce(`${blockText} moved to answer area`);
    } else {
      const startPosition = this._getBlockPosition(block);
      if (this.reusable) {
        this._dropArea.removeChild(block);
      } else {
        this._dragArea.appendChild(block);
      }
      const inputEvent: MicroParsonsEvent.Input = {
        type: "input",
        action: MicroParsonsEvent.InputAction.REMOVE,
        position: [startPosition, -1],
        answer: this._getTextArray(),
      };
      this.parentElement.logEvent(inputEvent);
      this._updateBlockAria();
      this._announce(`${blockText} moved to available blocks`);
    }
  };

  private _initSortable = (): void => {
    if (this.reusable) {
      this._dragSortable = new Sortable(this._dragArea, {
        group: {
          name: "shared",
          pull: "clone",
          put: false,
        },
        sort: false,
        direction: "horizontal",
        animation: 150,
        draggable: ".parsons-block",
        onClone: (event) => {
          const newBlock = event.clone;
          newBlock.onclick = (ev) => this._onBlockClicked(newBlock, ev);
        },
      });

      this._dropSortable = new Sortable(this._dropArea, {
        group: "shared",
        direction: "horizontal",
        animation: 150,
        draggable: ".parsons-block",
        onAdd: (event) => {
          const inputEvent: MicroParsonsEvent.Input = {
            type: "input",
            action: MicroParsonsEvent.InputAction.ADD,
            position: [-1, this._getBlockPosition(event.item)],
            answer: this._getTextArray(),
          };
          this.parentElement.logEvent(inputEvent);
          this._updateBlockAria();
        },
        onStart: (event) => {
          this._prevPosition = this._getBlockPosition(event.item);
        },
        onEnd: (event) => {
          let endposition;
          let action = MicroParsonsEvent.InputAction.MOVE;
          const upperbound = this._dropArea.getBoundingClientRect().top;
          const lowerbound = this._dropArea.getBoundingClientRect().bottom;
          if (
            (event as any).originalEvent.clientY > lowerbound ||
            (event as any).originalEvent.clientY < upperbound
          ) {
            const item = event.item as HTMLElement;
            if (item.parentNode) {
              item.parentNode.removeChild(item);
            }
            endposition = -1;
            action = MicroParsonsEvent.InputAction.REMOVE;
          } else {
            endposition = this._getBlockPosition(event.item);
          }
          const inputEvent: MicroParsonsEvent.Input = {
            type: "input",
            action: action,
            position: [this._prevPosition, endposition],
            answer: this._getTextArray(),
          };
          this.parentElement.logEvent(inputEvent);
          this._updateBlockAria();
        },
      });
    } else {
      this._dragSortable = new Sortable(this._dragArea, {
        group: {
          name: "shared",
          // pull: 'clone',
          // put: false
        },
        // sort: false,
        direction: "horizontal",
        animation: 150,
        draggable: ".parsons-block",
      });

      this._dropSortable = new Sortable(this._dropArea, {
        group: "shared",
        direction: "horizontal",
        animation: 150,
        draggable: ".parsons-block",
        onAdd: (event) => {
          const inputEvent: MicroParsonsEvent.Input = {
            type: "input",
            action: MicroParsonsEvent.InputAction.ADD,
            position: [-1, this._getBlockPosition(event.item)],
            answer: this._getTextArray(),
          };
          this.parentElement.logEvent(inputEvent);
          this._updateBlockAria();
        },
        onStart: (event) => {
          this._prevPosition = this._getBlockPosition(event.item);
        },
        onEnd: (event) => {
          let endposition = this._getBlockPosition(event.item);
          const action =
            endposition == -1
              ? MicroParsonsEvent.InputAction.REMOVE
              : MicroParsonsEvent.InputAction.MOVE;
          const inputEvent: MicroParsonsEvent.Input = {
            type: "input",
            action: action,
            position: [this._prevPosition, endposition],
            answer: this._getTextArray(),
          };
          this.parentElement.logEvent(inputEvent);
          this._updateBlockAria();
        },
      });
    }
  };

  public updateTestStatus = (result: string): void => {
    if (this._dropArea.classList.contains(result)) {
      return;
    }
    if (this._dropArea.classList.contains("Pass")) {
      this._dropArea.classList.remove("Pass");
    } else if (this._dropArea.classList.contains("Fail")) {
      this._dropArea.classList.remove("Fail");
    } else if (this._dropArea.classList.contains("Error")) {
      this._dropArea.classList.remove("Error");
    }
    this._dropArea.classList.add(result);
  };

  // -----------------------------------------------------------------------
  // Accessibility helpers
  // -----------------------------------------------------------------------

  /** Sync role, aria-selected, and roving tabindex for all blocks. */
  private _updateBlockAria = (): void => {
    const applyToArea = (area: HTMLDivElement, isAnswer: boolean) => {
      const blocks = area.querySelectorAll<HTMLDivElement>(".parsons-block");
      blocks.forEach((block, i) => {
        block.setAttribute("role", "option");
        block.setAttribute("aria-selected", isAnswer ? "true" : "false");
        block.setAttribute("tabindex", i === 0 ? "0" : "-1");
      });
    };
    applyToArea(this._dragArea, false);
    applyToArea(this._dropArea, true);
  };

  /** Move focus to a specific block, updating roving tabindex within its area. */
  private _focusBlock = (block: HTMLDivElement, area: HTMLDivElement): void => {
    area.querySelectorAll<HTMLDivElement>(".parsons-block").forEach((b) => {
      b.setAttribute("tabindex", "-1");
    });
    block.setAttribute("tabindex", "0");
    block.focus();
  };

  /** Announce a message to screen readers via the live region. */
  private _announce = (message: string): void => {
    // Clear first so repeated identical messages still trigger re-announcement
    this._liveRegion.textContent = "";
    setTimeout(() => {
      this._liveRegion.textContent = message;
    }, 10);
  };

  /** Wire up keyboard navigation for both block areas. */
  private _setupKeyboardNav = (): void => {
    this.el.addEventListener("keydown", (ev: KeyboardEvent) => {
      const block = (ev.target as HTMLElement).closest<HTMLDivElement>(
        ".parsons-block",
      );
      if (!block) return;

      const area = block.parentElement as HTMLDivElement;
      if (area !== this._dragArea && area !== this._dropArea) return;

      const blocks = Array.from(
        area.querySelectorAll<HTMLDivElement>(".parsons-block"),
      );
      const idx = blocks.indexOf(block);

      switch (ev.key) {
        case "ArrowRight":
        case "ArrowDown":
          ev.preventDefault();
          if (idx < blocks.length - 1) {
            this._focusBlock(blocks[idx + 1], area);
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
          ev.preventDefault();
          if (idx > 0) {
            this._focusBlock(blocks[idx - 1], area);
          }
          break;
        case " ":
        case "Enter": {
          ev.preventDefault();
          const wasInDragArea = area === this._dragArea;
          this._onBlockClicked(block, ev);
          // Focus the moved block in its new location
          let focusTarget: HTMLDivElement | null = null;
          if (wasInDragArea) {
            // Block (or its clone) is now in drop-area
            focusTarget = this.reusable
              ? (this._dropArea.lastElementChild as HTMLDivElement)
              : block;
          } else {
            // Block was removed from drop-area
            focusTarget = this.reusable
              ? ((this._dropArea.firstElementChild ||
                  this._dragArea.firstElementChild) as HTMLDivElement | null)
              : block;
          }
          if (focusTarget) {
            this._focusBlock(
              focusTarget,
              focusTarget.parentElement as HTMLDivElement,
            );
          }
          break;
        }
      }
    });
  };

  private _getBlockPosition = (block: Node): number => {
    let position = -1;
    const parent = this._dropArea;
    if (parent) {
      for (position = 0; position < parent.childNodes.length; ++position) {
        if (parent.childNodes[position] === block) {
          break;
        }
      }
    }
    return position;
  };

  public _getTextArray = (): Array<string> => {
    let answer: Array<string> = [];
    if (this._dropArea.hasChildNodes()) {
      let el = this._dropArea.firstChild as HTMLDivElement;
      answer.push(this._getTextFromBlock(el));
      while (el.nextSibling) {
        el = el.nextSibling as HTMLDivElement;
        answer.push(this._getTextFromBlock(el));
      }
    }
    return answer;
  };

  public removeFormat = (): void => {
    if (this._dropArea.hasChildNodes()) {
      let el = this._dropArea.firstChild as HTMLDivElement;
      el.style.removeProperty("background-color");
      while (el.nextSibling) {
        el = el.nextSibling as HTMLDivElement;
        el.style.removeProperty("background-color");
      }
    }
  };

  public resetInput = (): void => {
    if (this.reusable) {
      while (this._dropArea.firstChild) {
        this._dropArea.removeChild(this._dropArea.firstChild);
      }
      this._updateBlockAria();
    } else {
      this._resetInput(); // _resetInput already calls _updateBlockAria
    }
  };

  public restoreAnswer(answer: Array<string>): void {
    this.resetInput();
    const space = /^\s+$/;
    for (let i = 0; i < answer.length; ++i) {
      let isAnswerSpace = space.test(answer[i]);
      if (this._dragArea.hasChildNodes()) {
        let el = this._dragArea.firstChild as HTMLDivElement;
        while (el) {
          if (isAnswerSpace) {
            // current answer block is a list of space
            if (
              space.test(this._getTextFromBlock(el)) &&
              answer[i].length == this._getTextFromBlock(el).length
            ) {
              el.click();
              break;
            }
          } else if (this._getTextFromBlock(el) == answer[i]) {
            // found the block
            el.click();
            break;
          }
          el = el.nextSibling as HTMLDivElement;
        }
      }
    }
    const restoreEvent: MicroParsonsEvent.RestoreAnswer = {
      type: "restore",
      answer: answer,
    };
    this.parentElement.logEvent(restoreEvent);
  }

  public restoreAnswerByIndices(indices: Array<number>): void {
    this.resetInput();

    for (let i = 0; i < indices.length; ++i) {
      const target = String(indices[i]);

      if (this._dragArea.hasChildNodes()) {
        let el = this._dragArea.firstChild as HTMLDivElement;
        while (el) {
          if (el.dataset.index === target) {
            el.click(); // preserve reusable/nonreusable behavior
            break;
          }
          el = el.nextSibling as HTMLDivElement;
        }
      }
    }

    // Keep logging type-compatible without touching LoggingEvents in this PR:
    const restoreEvent: MicroParsonsEvent.RestoreAnswer = {
      type: "restore",
      // store as strings to satisfy Array<string> type
      answer: indices.map(String),
    };
    this.parentElement.logEvent(restoreEvent);
  }
}
