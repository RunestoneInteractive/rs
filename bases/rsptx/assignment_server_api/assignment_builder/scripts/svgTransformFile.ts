import camelcase from "camelcase";
import path from "path";

// Replaces SVG files in tests
export default (filename: string) => {
  const assetFilename = JSON.stringify(path.basename(filename));
  const pascalCaseFilename = camelcase(path.parse(filename).name, {
    pascalCase: true,
  });
  const componentName = `Svg${pascalCaseFilename}`;

  return {
    code: `import React from 'react';
      export default React.forwardRef(function ${componentName}(props, ref) {
        return {
          $$typeof: Symbol.for('react.element'),
          type: 'svg',
          ref: ref,
          key: null,
          props: Object.assign({}, props, {
            children: ${assetFilename}
          })
        };
      });
    `,
  };
};
