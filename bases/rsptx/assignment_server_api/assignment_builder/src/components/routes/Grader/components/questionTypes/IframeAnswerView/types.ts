export interface SpliceGraderApi {
  registerGraderFrame: (frame: HTMLIFrameElement, state: unknown) => void;
  unregisterGraderFrame: (frame: HTMLIFrameElement) => void;
}

export interface FrameSpec {
  src: string;
  style: string;
}
