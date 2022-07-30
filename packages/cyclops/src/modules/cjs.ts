/**
 * Detect if the module is a CommonJS module based on the require() function.
 *
 * TODO: We should also detect if the module is a CommonJS module based on
 * the global.require() function.
 */
export function isCommonJSModuleImport(estreeNode: any): boolean {
  if (
    estreeNode.type === "CallExpression" &&
    estreeNode.callee?.name === "require"
  ) {
    return true;
  }

  return false;
}
