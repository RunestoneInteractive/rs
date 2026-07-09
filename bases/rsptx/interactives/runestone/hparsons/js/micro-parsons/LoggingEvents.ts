// This file contains the event definition for micro Parsons problems.
export namespace MicroParsonsEvent {
  export enum InputAction {
    ADD = "add",
    MOVE = "move",
    REMOVE = "remove",
  }

  export type Input = {
    type: "input";
    action: InputAction;
    // Position: The index of the block before the input action, and index of the block after the input action.
    // -1 indicates that the block is not in the answer.
    // e.g. [-1, 0] Means a block is *added* to the answer to the *beginning*;
    //      [2, -1] means a block at index 2 is *removed* from the answer;
    //      [1, 2] means the moved block previously had an index of 1. After moving it, its index becomes 2.
    // * Note1: I recognize it is not ideal to store in a list, but tuples are not defined in JSON.
    // * Note2: This input event does not capture the movement in the "source" blocks.
    position: [number, number];
    // The final answer *after* the input action.
    answer: Array<string>;
  };

  export type Tooltip = {
    type: "tooltip";
    block: string;
    tooltip: string;
    show: boolean; // true if showing the tooltip, false if hiding
  };

  export type Reset = {
    type: "reset";
  };

  export type RestoreAnswer = {
    type: "restore";
    answer: Array<string>;
  };
}
