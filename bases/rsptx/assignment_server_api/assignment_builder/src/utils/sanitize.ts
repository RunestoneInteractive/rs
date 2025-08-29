export const sanitizeId = (name: string, fallback?: string): string => {
  const nameToUse = name || fallback || `generated_${Date.now()}`;

  let sanitized = nameToUse
    .replace(/[^a-zA-Z0-9\-_]/g, "_") // Replace invalid characters with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores to single
    .replace(/^_+|_+$/g, ""); // Remove leading and trailing underscores

  // Ensure ID starts with a letter (HTML spec requirement)
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = "id_" + sanitized;
  }

  return sanitized;
};

export const validateIdName = (name: string): string | null => {
  if (!name || name.trim().length === 0) {
    return "Name is required";
  }

  if (name.trim().length < 2) {
    return "Name must be at least 2 characters long";
  }

  // Check if name contains only valid characters for HTML ID
  if (!/^[a-zA-Z0-9\-_\s]+$/.test(name)) {
    return "Name can only contain letters, numbers, hyphens, underscores, and spaces";
  }

  if (!/^[a-zA-Z]/.test(name)) {
    return "Name must start with a letter";
  }

  return null;
};
