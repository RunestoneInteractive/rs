export {};

declare global {
  type EBookConfig = Partial<{
    isInstructor: boolean;
    course: string;
    username: string;
    isLoggedIn: boolean;
    author: string;
  }>;

  interface Window {
    eBookConfig: EBookConfig;
  }
}
