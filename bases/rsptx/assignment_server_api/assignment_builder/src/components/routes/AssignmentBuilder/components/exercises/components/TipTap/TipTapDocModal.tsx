import { Modal } from "@mantine/core";
import { FC, useState } from "react";

import styles from "./TipTapDocModal.module.css";

interface TipTapDocModalProps {
  visible: boolean;
  onHide: () => void;
}

export const TipTapDocModal: FC<TipTapDocModalProps> = ({ visible, onHide }) => {
  return (
    <Modal
      title="Editor guide"
      opened={visible}
      onClose={onHide}
      size="50vw"
      className={styles.docModal}
      closeButtonProps={{ "aria-label": "Close" }}
      centered
    >
      <div className={styles.docContent}>
        <section className={styles.section}>
          <h3>Slash commands</h3>
          <p>
            Type <code>/</code> to open the command menu:
          </p>
          <ul>
            <li>
              <strong>Text formatting:</strong> bold, italic, underline, highlight, strikethrough,
              clear formatting
            </li>
            <li>
              <strong>Headings:</strong> levels 1–4
            </li>
            <li>
              <strong>Lists & structure:</strong> bullet list, numbered list, quote, horizontal rule
            </li>
            <li>
              <strong>Code & math:</strong> code block with syntax highlighting, inline code, LaTeX
              math
            </li>
            <li>
              <strong>Tables:</strong> insert a table, then add or delete rows and columns
            </li>
            <li>
              <strong>Media & links:</strong> link, image upload, image by URL, YouTube video
            </li>
          </ul>
          <p>Fill-in-the-blank editors also offer an "Add blank" command.</p>
        </section>

        <section className={styles.section}>
          <h3>Keyboard shortcuts</h3>
          <div className={styles.shortcuts}>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + B</kbd>
              <span>Bold</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + I</kbd>
              <span>Italic</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + U</kbd>
              <span>Underline</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + K</kbd>
              <span>Link</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + Shift + X</kbd>
              <span>Strikethrough</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl/Cmd + Shift + H</kbd>
              <span>Highlight</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Tab</kbd>
              <span>Indent a list item; insert a tab in code blocks</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Shift + Tab</kbd>
              <span>Outdent a list item</span>
            </div>
          </div>
          <p>Outside lists and code blocks, Tab moves focus to the next control.</p>
        </section>

        <section className={styles.section}>
          <h3>Math expressions</h3>
          <p>
            <strong>
              All math must be wrapped in <code>\(</code> and <code>\)</code> delimiters.
            </strong>{" "}
            Use LaTeX syntax for mathematical expressions:
          </p>
          <ul>
            <li>
              <strong>Inline math:</strong> <code>\(x^2 + y^2 = z^2\)</code> (backslash-parentheses)
            </li>
            <li>
              <strong>Block math:</strong> <code>\[\int_0^1 x^2 dx\]</code> (backslash-brackets for
              centered display)
            </li>
          </ul>
          <p>
            <strong>Quick tip:</strong> Type <code>\(\alpha\)</code> to get α,{" "}
            <code>\(\beta\)</code> to get β, etc.
          </p>
          <p>
            <strong>Important:</strong> All LaTeX symbols must be wrapped in <code>\(</code> and{" "}
            <code>\)</code> delimiters.
          </p>
          <p>Common symbols and usage:</p>
          <ul>
            <li>
              <strong>Greek letters:</strong>{" "}
              <code>
                \(\alpha\), \(\beta\), \(\gamma\), \(\delta\), \(\epsilon\), \(\theta\),
                \(\lambda\), \(\mu\), \(\pi\), \(\sigma\), \(\phi\), \(\omega\)
              </code>
            </li>
            <li>
              <strong>Fractions:</strong>{" "}
              <code>
                \(\frac{"{numerator}"}
                {"{denominator}"}\)
              </code>
            </li>
            <li>
              <strong>Superscripts:</strong> <code>\(x^{"{superscript}"}\)</code> or{" "}
              <code>\(x^2\)</code>
            </li>
            <li>
              <strong>Subscripts:</strong> <code>\(x_{"{subscript}"}\)</code> or{" "}
              <code>\(x_1\)</code>
            </li>
            <li>
              <strong>Square root:</strong> <code>\(\sqrt{"{x}"}\)</code> or{" "}
              <code>\(\sqrt[n]{"{x}"}\)</code>
            </li>
            <li>
              <strong>Integrals:</strong> <code>\(\int\), \(\sum\), \(\prod\)</code>
            </li>
            <li>
              <strong>Number sets (with shortcuts):</strong>{" "}
              <code>
                \(\R\), \(\N\), \(\Z\), \(\Q\), \(\C\) (shortcuts for \(\mathbb{"{R}"}\), \(\mathbb
                {"{N}"}\), etc.)
              </code>
            </li>
          </ul>
          <p>
            <strong>Examples:</strong>
          </p>
          <ul>
            <li>
              <code>\(\alpha + \beta = \gamma\)</code> → α + β = γ
            </li>
            <li>
              <code>
                \(\frac{"{1}"}
                {"{2}"} + \frac{"{1}"}
                {"{3}"} = \frac{"{5}"}
                {"{6}"}\)
              </code>{" "}
              → ½ + ⅓ = ⅚
            </li>
            <li>
              <code>
                \(\int_0^1 x^2 dx = \frac{"{1}"}
                {"{3}"}\)
              </code>{" "}
              → ∫₀¹ x² dx = ⅓
            </li>
            <li>
              <code>\(x^2 + y^2 = r^2\)</code> → x² + y² = r²
            </li>
            <li>
              <code>
                \(\sum_{"{i=1}"}^n i = \frac{"{n(n+1)}"}
                {"{2}"}\)
              </code>{" "}
              → Σᵢ₌₁ⁿ i = n(n+1)/2
            </li>
            <li>
              <code>\(\R \subseteq \C\) and \(\alpha \in \R\)</code> → ℝ ⊆ ℂ and α ∈ ℝ
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>Bubble menu</h3>
          <p>
            Select text to see formatting options in the bubble menu that appears above your
            selection.
          </p>
        </section>
      </div>
    </Modal>
  );
};

export const useTipTapDocModal = () => {
  const [visible, setVisible] = useState(false);

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  return {
    visible,
    showModal,
    hideModal
  };
};
