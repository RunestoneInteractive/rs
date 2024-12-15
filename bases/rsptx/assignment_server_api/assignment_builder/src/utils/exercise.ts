export const createExerciseId = (): string => {
  const today = new Date();
  const date =
    today.getFullYear() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");
  const randInt = Math.floor(Math.random() * 10000);

  return `exercise_${date}_${randInt}`;
};
