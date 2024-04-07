
export function setExerciseDefaults(exercise, currentAssignmentId, currentExercises) {
    if (exercise.name.startsWith("q:")) {
        exercise.name = exercise.name.substring(2);
    }
    exercise.assignment_id = currentAssignmentId;
    exercise.question_id = exercise.id;
    let clen = currentExercises.length;
    // Use the last exercise to set the default values
    exercise.points = clen ? currentExercises[clen - 1].points : 1;
    exercise.autograde = clen ? currentExercises[clen - 1].autograde : "pct_correct";
    exercise.which_to_grade = clen ? currentExercises[clen - 1].which_to_grade : "best_answer";
    exercise.sorting_priority = clen;
    return exercise;
}
