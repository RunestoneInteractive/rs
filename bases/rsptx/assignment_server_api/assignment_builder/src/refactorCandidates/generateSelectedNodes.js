export const generateSelectedNodes = (ePickerNodes, exercises) => {
  let selectedNodes = {};
  // Not super efficient, but we need to set the selectedNodes for the ePicker
  // maybe better to include more question data with the assignment_questions then we
  // would not have to search.

  for (let ch of ePickerNodes) {
    for (let sc of ch.children) {
      for (let q of sc.children) {
        if (exercises.find((d) => d.question_id === q.data.id)) {
          selectedNodes[q.key] = { checked: true, partialChecked: false };
          selectedNodes[q.data.chapter] = { checked: false, partialChecked: true };
          selectedNodes[q.data.subchapter] = { checked: false, partialChecked: true };
        }
      }
    }
  }

  return selectedNodes;
};
