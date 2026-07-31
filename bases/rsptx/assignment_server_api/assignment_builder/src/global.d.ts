export {};

declare global {
  type EBookConfig = Partial<{
    isInstructor: boolean;
    course: string;
    username: string;
    isLoggedIn: boolean;
    author: string;
    /** IANA timezone of the course, e.g. "America/Chicago". */
    courseTimezone: string;
  }>;

  interface Window {
    eBookConfig: EBookConfig;
  }
}
