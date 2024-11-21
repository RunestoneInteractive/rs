export function setExerciseDefaults(exercise, currentAssignmentId, currentExercises) {
  exercise.assignment_id = currentAssignmentId;
  exercise.question_id = exercise.id;
  let clen = currentExercises.length;
  // Use the last exercise to set the default values

  exercise.points = clen ? currentExercises[clen - 1].points : 1;
  exercise.autograde = clen ? currentExercises[clen - 1].autograde : "pct_correct";
  exercise.which_to_grade = clen ? currentExercises[clen - 1].which_to_grade : "best_answer";
  exercise.sorting_priority = clen;
  exercise.reading_assignment = false;
  return exercise;
}

export function setReadingDefaults(exercise, currentAssignmentId, currentExercises) {
  exercise.assignment_id = currentAssignmentId;
  exercise.question_id = exercise.id;
  let clen = currentExercises.length;
  // Use the last exercise to set the default values

  exercise.points = clen ? currentExercises[clen - 1].points : 1;
  exercise.sorting_priority = clen;
  exercise.reading_assignment = true;
  exercise.autograde = "interaction";
  exercise.which_to_grade = "best_answer";
  exercise.activities_required = Math.round(exercise.numQuestions * 0.8);
  exercise.required = exercise.activities_required;
  return exercise;
}
