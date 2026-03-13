import { Dialog } from "primereact/dialog";
import { FC, useState } from "react";

import styles from "./TipTapDocModal.module.css";

interface TipTapDocModalProps {
  visible: boolean;
  onHide: () => void;
}

export const TipTapDocModal: FC<TipTapDocModalProps> = ({ visible, onHide }) => {
  return (
    <Dialog
      header="Rich Text Editor Guide"
      visible={visible}
      onHide={onHide}
      style={{ width: "50vw" }}
      breakpoints={{ "960px": "75vw", "641px": "90vw" }}
      className={styles.docModal}
    >
      <div className={styles.docContent}>
        <section className={styles.section}>
          <h3>Slash Commands</h3>
          <p>
            Type <code>/</code> to open the command menu with these options:
          </p>
          <ul>
            <li>
              <strong>Heading 1-6:</strong> Create different sized headings
            </li>
            <li>
              <strong>Bold Text:</strong> Make text bold
            </li>
            <li>
              <strong>Italic Text:</strong> Make text italic
            </li>
            <li>
              <strong>Bullet List:</strong> Create a bulleted list
            </li>
            <li>
              <strong>Numbered List:</strong> Create a numbered list
            </li>
            <li>
              <strong>Quote:</strong> Add a blockquote
            </li>
            <li>
              <strong>Code Block:</strong> Insert a code block with syntax highlighting
            </li>
            <li>
              <strong>Horizontal Rule:</strong> Add a horizontal line
            </li>
            <li>
              <strong>Link:</strong> Insert a hyperlink
            </li>
            <li>
              <strong>Image:</strong> Upload and insert an image
            </li>
            <li>
              <strong>YouTube Video:</strong> Embed a YouTube video
            </li>
            <li>
              <strong>Math Expression:</strong> Add mathematical formulas (LaTeX)
            </li>
            <li>
              <strong>Hard Break:</strong> Force a line break
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h3>Keyboard Shortcuts</h3>
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
          </div>
        </section>

        <section className={styles.section}>
          <h3>Math Expressions</h3>
          <p>
            <strong>
              All math must be wrapped in <code>\(</code> and <code>\)</code> delimiters!
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
          <h3>Bubble Menu</h3>
          <p>
            Select text to see formatting options in the bubble menu that appears above your
            selection.
          </p>
        </section>
      </div>
    </Dialog>
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
