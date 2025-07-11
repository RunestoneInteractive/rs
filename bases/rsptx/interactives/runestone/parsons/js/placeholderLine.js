import ParsonsLine from "./parsonsLine";

export default class PlaceholderLine extends ParsonsLine {
    constructor(problem) {
        super(problem, "placeholder", false);
        this.isPlaceholderLine = true;
    }
}