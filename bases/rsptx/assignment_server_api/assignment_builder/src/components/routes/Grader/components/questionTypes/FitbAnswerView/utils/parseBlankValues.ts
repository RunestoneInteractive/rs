export const parseBlankValues = (answer: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(answer);

    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return answer ? answer.split(",") : [];
  }
};
