export const generateActiveCodePreview = (
  instructions: string,
  language: string,
  prefix_code: string,
  starter_code: string,
  suffix_code: string,
  name: string
): string => {
  // Sanitize ID by replacing spaces and special chars with underscores
  const safeId = name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

  return `
<div class="runestone explainer ac_section ">
<div data-component="activecode" id="${safeId}" data-question_label="${name}">
<div id="${safeId}_question" class="ac_question">
<p>${instructions}</p>

</div>
<textarea data-lang="${language}" id="${safeId}_editor" 
      data-timelimit=25000  data-codelens="true"   
    data-audio=''      
           data-wasm=/_static
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
