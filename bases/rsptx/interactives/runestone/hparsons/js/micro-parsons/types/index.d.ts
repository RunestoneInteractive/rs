interface IParsonsInput {
    parentElement: MicroParsons;
	el: HTMLDivElement;
	getText(addSpace: boolean): string;
	updateTestStatus(string): void;
	// highlightError(number): void;
	removeFormat(): void;
	restoreAnswer(answer: any): void;
}

interface MicroParsonsProps {
	selector: string;
	id: string | null;
	reuse: boolean;
	randomize: boolean;
	parsonsBlocks: Array<string>;
	parsonsTooltips: Array<string>;
	language: string | null;
	context: {
		before: string | null;
		after: string | null;
	} | null;
}

interface IRegexStatusTag {
	el: HTMLSpanElement;
	updateStatus(string): void;
}

interface ITestStringInput {
	el: HTMLDivElement;
}

interface IStatusOutput {
	el: HTMLDivElement;
}

interface ITestButton {
	el: HTMLButtonElement;
}

interface ITestResult {
	el: HTMLDivElement;
}

interface IRegexOptions {
	el: HTMLDivElement;
	getFlags(): string?;
}

interface IParsonsInput {
	el: HTMLDivElement
}
