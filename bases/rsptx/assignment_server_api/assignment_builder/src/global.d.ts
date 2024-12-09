export {};

declare global {
  type EBookConfig = Partial<{
    isInstructor: boolean;
    course: string;
    username: string;
    isLoggedIn: boolean;
  }>;

  interface Window {
    eBookConfig: EBookConfig;
  }
}
