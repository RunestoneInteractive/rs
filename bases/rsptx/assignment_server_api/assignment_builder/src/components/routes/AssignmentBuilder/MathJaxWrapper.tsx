import { MathJaxContext } from "better-react-mathjax";
import { ReactNode } from "react";

interface MathJaxWrapperProps {
  children: ReactNode;
}

export const mathJaxConfig = {
  loader: {
    load: ["output/chtml", "[tex]/ams", "[tex]/newcommand", "[tex]/boldsymbol"]
  },
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"]
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"]
    ],
    processEscapes: true,
    packages: {
      "[+]": ["ams", "newcommand", "boldsymbol"]
    },
    macros: {
      R: "\\mathbb{R}",
      N: "\\mathbb{N}",
      Z: "\\mathbb{Z}"
    }
  },
  chtml: {
    matchFontHeight: true,
    scale: 1.1,
    minScale: 0.5
  },
  svg: {
    fontCache: "global",
    scale: 1.1,
    minScale: 0.5,
    mtextInheritFont: true,
    merrorInheritFont: true,
    mathmlSpacing: true,
    skipAttributes: {},
    exFactor: 0.5,
    displayAlign: "center",
    displayIndent: "0"
  },
  startup: {
    typeset: false
  },
  options: {
    processHtmlClass: "katex",
    enableMenu: true,
    menuOptions: {
      settings: {
        zoom: "Click",
        zscale: "200%"
      }
    },
    skipHtmlTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
      "annotation",
      "annotation-xml"
    ],
    skipTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
      "annotation",
      "annotation-xml"
    ]
  }
};

export const MathJaxWrapper: React.FC<MathJaxWrapperProps> = ({ children }) => {
  return <MathJaxContext config={mathJaxConfig}>{children}</MathJaxContext>;
};
