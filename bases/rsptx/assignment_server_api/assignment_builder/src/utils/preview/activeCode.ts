import { sanitizeId } from "../sanitize";

export interface DataFileInfo {
  acid: string;
  filename?: string;
}

export interface IoTest {
  input: string;
  out: string;
}

// Activecode options that come mostly from books. Each is optional and is
// written only when set; see docs/source/question_json_schema.rst.
export interface ActiveCodeAdvancedOptions {
  visible_prefix_code?: string;
  visible_suffix_code?: string;
  iotests?: IoTest[];
  filename?: string;
  timeLimit?: number;
  compileArgs?: string;
  linkArgs?: string;
  runArgs?: string;
  interpreterArgs?: string;
  addFiles?: string[];
  compileAlso?: string;
  sourceFile?: string;
  highlightLines?: string;
  includes?: string[];
  dbUrl?: string;
  autoRun?: boolean;
  hideCode?: boolean;
  hideHistory?: boolean;
  enableDownload?: boolean;
  gradeButton?: boolean;
  noPair?: boolean;
  showLastSql?: boolean;
  chatCodes?: boolean;
  tie?: string;
  caption?: string;
}

// question_json key -> textarea attribute, and how the value is written. Keep
// in step with ACTIVECODE_OPTIONS in components/rsptx/build_tools/question_json.py.
const ACTIVECODE_ATTRIBUTES: Record<string, [string, "string" | "bool" | "comma" | "space"]> = {
  compileArgs: ["data-compileargs", "string"],
  linkArgs: ["data-linkargs", "string"],
  runArgs: ["data-runargs", "string"],
  interpreterArgs: ["data-interpreterargs", "string"],
  addFiles: ["data-add-files", "comma"],
  compileAlso: ["data-compile-also", "string"],
  sourceFile: ["data-sourcefile", "string"],
  highlightLines: ["data-highlight-lines", "string"],
  includes: ["data-include", "space"],
  dbUrl: ["data-dburl", "string"],
  autoRun: ["data-autorun", "bool"],
  hideCode: ["data-hidecode", "bool"],
  hideHistory: ["data-hidehistory", "bool"],
  enableDownload: ["data-enabledownload", "bool"],
  gradeButton: ["data-gradebutton", "bool"],
  noPair: ["data-nopair", "bool"],
  showLastSql: ["data-showlastsql", "bool"],
  chatCodes: ["data-chatcodes", "bool"],
  tie: ["data-tie", "string"],
  caption: ["data-caption", "string"]
};

const ADVANCED_OPTION_KEYS: (keyof ActiveCodeAdvancedOptions)[] = [
  "visible_prefix_code",
  "visible_suffix_code",
  "iotests",
  "filename",
  "timeLimit",
  ...(Object.keys(ACTIVECODE_ATTRIBUTES) as (keyof ActiveCodeAdvancedOptions)[])
];

// The advanced options set on a question (or form data), and nothing else.
export const pickActiveCodeAdvancedOptions = (
  data: Partial<ActiveCodeAdvancedOptions>
): ActiveCodeAdvancedOptions => {
  const options: Record<string, unknown> = {};

  for (const key of ADVANCED_OPTION_KEYS) {
    if (data[key] !== undefined && data[key] !== null) {
      options[key] = data[key];
    }
  }

  return options as ActiveCodeAdvancedOptions;
};

export const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Text inside a <textarea> is decoded but not parsed, so only & and < need it.
export const escapeTextarea = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// The textarea attributes for the ACTIVECODE_ATTRIBUTES options that are set
export const advancedAttributes = (advanced: ActiveCodeAdvancedOptions): string =>
  Object.entries(ACTIVECODE_ATTRIBUTES)
    .map(([key, [attribute, kind]]) => {
      const value = advanced[key as keyof ActiveCodeAdvancedOptions];

      if (value === undefined || value === "" || value === false) return "";
      if (Array.isArray(value) && value.length === 0) return "";
      if (kind === "bool") return ` ${attribute}="yes"`;
      if (kind === "comma")
        return ` ${attribute}="${escapeAttribute((value as string[]).join(","))}"`;
      if (kind === "space")
        return ` ${attribute}="${escapeAttribute((value as string[]).join(" "))}"`;

      return ` ${attribute}="${escapeAttribute(String(value))}"`;
    })
    .join("");

export interface CodeTailorOptions {
  enableCodeTailor?: boolean;
  parsonspersonalize?: "movable" | "partial" | "";
  parsonsexample?: string;
  parsonsPersonalized?: boolean;
  enableCodelens?: boolean;
}

export const generateActiveCodePreview = (
  instructions: string,
  language: string,
  prefix_code: string,
  starter_code: string,
  suffix_code: string,
  name: string,
  stdin?: string,
  selectedDataFiles?: DataFileInfo[],
  codeTailorOptions?: CodeTailorOptions,
  advanced: ActiveCodeAdvancedOptions = {}
): string => {
  const safeId = sanitizeId(name);

  // Add data-stdin attribute to textarea if stdin is provided
  const stdinAttr = stdin && stdin.trim() ? ` data-stdin="${stdin}"` : "";

  const filenames =
    selectedDataFiles && selectedDataFiles.length > 0 ? selectedDataFiles.map((df) => df.acid) : [];
  const datafileAttr = filenames.length > 0 ? ` data-datafile="${filenames.join(",")}"` : "";

  // CodeTailor attributes
  let codeTailorAttrs = "";

  if (codeTailorOptions?.enableCodeTailor && codeTailorOptions?.parsonspersonalize) {
    codeTailorAttrs += ` data-parsonspersonalize="${codeTailorOptions.parsonspersonalize}"`;
    // If parsonsexample is provided, use it; otherwise default to LLM-example
    const parsonsExampleValue = codeTailorOptions.parsonsexample?.trim() || "LLM-example";

    codeTailorAttrs += ` data-parsonsexample="${parsonsExampleValue}"`;
    if (codeTailorOptions.parsonsPersonalized === false) {
      codeTailorAttrs += ' data-parsons-personalized="false"';
    }
  }

  // Codelens attribute - defaults to true
  const codelensEnabled = codeTailorOptions?.enableCodelens !== false;
  const codelensAttr = `data-codelens="${codelensEnabled}"`;

  // The code between the markers activecode.js splits on:
  // prefix ^^^^ visible prefix ^^^! starter ===! visible suffix ==== suffix
  const visiblePrefix =
    advanced.visible_prefix_code !== undefined ? `${advanced.visible_prefix_code}\n^^^!\n` : "";
  const visibleSuffix =
    advanced.visible_suffix_code !== undefined ? `\n===!\n${advanced.visible_suffix_code}` : "";
  const iotests = advanced.iotests ? `\n===iotests===\n${JSON.stringify(advanced.iotests)}` : "";
  const filenameAttr = advanced.filename
    ? ` data-filename="${escapeAttribute(advanced.filename)}"`
    : "";

  return `
<div class="runestone explainer ac_section ">
<div data-component="activecode" id="${safeId}" data-question_label="${name}"${filenameAttr}>
<div id="${safeId}_question" class="ac_question">
<p>${instructions}</p>

</div>
<textarea 
    data-lang="${language}" id="${safeId}_editor" 
    data-timelimit=${advanced.timeLimit ?? 25000}  ${codelensAttr}   
    data-audio=''      
    data-wasm=/_static
    ${stdinAttr}${datafileAttr}${codeTailorAttrs}${advancedAttributes(advanced)}
    style="visibility: hidden;">
${escapeTextarea(prefix_code)}
^^^^
${escapeTextarea(visiblePrefix + starter_code + visibleSuffix)}
====
${escapeTextarea(suffix_code + iotests)}
</textarea> 
</div>
</div>
  `;
};
