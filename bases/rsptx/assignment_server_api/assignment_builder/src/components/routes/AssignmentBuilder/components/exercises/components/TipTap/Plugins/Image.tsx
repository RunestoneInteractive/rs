import TipTapExtensionImage from "@tiptap/extension-image";

export const TipTapImage = TipTapExtensionImage.extend({
  addAttributes() {
    return {
      src: {
        default: ""
      },
      alt: {
        default: undefined
      },
      title: {
        default: undefined
      },
      width: {
        default: undefined
      },
      height: {
        default: undefined
      },
      style: {
        default: undefined
      }
    };
  }
});

export type TipTapImageAttributes = {
  src: string;
  alt?: string;
  title?: string;
  width?: string | undefined;
  height?: string | undefined;
  style?: string;
};
