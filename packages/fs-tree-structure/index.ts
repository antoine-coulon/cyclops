import path from "node:path";

import set from "lodash.set";

export type TreeStructure = { [key: string]: TreeStructure };

export function makeTreeStructure(filePaths: string[]): TreeStructure {
  return filePaths.reduce((tree, filePath) => {
    set(
      tree,
      filePath.split(path.sep).filter((pathSegment) => pathSegment !== "."),
      {}
    );

    return tree;
  }, {});
}
