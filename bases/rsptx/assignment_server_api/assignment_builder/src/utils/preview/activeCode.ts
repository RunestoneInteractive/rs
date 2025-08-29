import { sanitizeId } from "../sanitize";

export const generateActiveCodePreview = (
  instructions: string,
  language: string,
  prefix_code: string,
  starter_code: string,
  suffix_code: string,
  name: string,
  stdin?: string
): string => {
  const safeId = sanitizeId(name);

  // Add data-stdin attribute to textarea if stdin is provided
  const stdinAttr = stdin && stdin.trim() ? ` data-stdin="${stdin}"` : "";

  return `
<div class="runestone explainer ac_section ">
<div data-component="activecode" id="${safeId}" data-question_label="${name}">
<div id="${safeId}_question" class="ac_question">
<p>${instructions}</p>

</div>
<textarea 
    data-lang="${language}" id="${safeId}_editor" 
    data-timelimit=25000  data-codelens="true"   
    data-audio=''      
    data-wasm=/_static
    ${stdinAttr}
    style="visibility: hidden;">
${prefix_code}
^^^^
${starter_code}
====
${suffix_code}
</textarea> 
</div>
</div>
  `;
};
