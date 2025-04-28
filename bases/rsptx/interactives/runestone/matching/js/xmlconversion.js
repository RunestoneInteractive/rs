export function xmlToJson(xmlString) {
    // 1) Parse the XML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) {
      throw new Error('XML parse error: ' + err.textContent);
    }
  
    // 2) Helper to extract [ { id, label }, … ] from <premise> or <response>
    function itemsFrom(tagName) {
      return Array.from(doc.querySelectorAll(tagName))
        .map(el => {
          const idEl    = el.querySelector('id');
          const labelEl = el.querySelector('label');
          return {
            id:    idEl    ? idEl.textContent.trim() : '',
            // innerHTML preserves any markup inside the label
            label: labelEl ? labelEl.innerHTML.trim() : ''
          };
        });
    }
  
    // 3) Helper to build [ [p, r], [p, r], … ]
    function correctAnswersFrom() {
      return Array.from(doc.querySelectorAll('edge'))
        .map(edgeEl => {
          const labs = Array.from(edgeEl.querySelectorAll('label'));
          // take first two <label> children as the pair
          return labs.slice(0, 2).map(l => l.textContent.trim());
        });
    }
  
    // 4) Return in { left, right, correctAnswers } shape
    return {
      left:           itemsFrom('premise'),
      right:          itemsFrom('response'),
      correctAnswers: correctAnswersFrom()
    };
  }
  