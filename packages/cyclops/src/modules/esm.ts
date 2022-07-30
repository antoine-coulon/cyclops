/**
 * Searching for named exports with no local variable binding such as
 * export { foo } from "./foo.js" as this export from another file is creating
 * a link between the two files.
 */
function isEcmaScriptModuleExport(estreeNode: any): boolean {
  /*
   * A named export with a local variable binding is not interesting as
   * it doesn't create a link between files:
   * const foo = () => {};
   * export { foo };
   * However, a named export with no local variable binding must be converted
   * as a link.
   */
  if (estreeNode.type === "ExportNamedDeclaration" && estreeNode.source) {
    return true;
  }

  // export * as foo from "./foo.js";
  // export * from "./foo.js"
  if (estreeNode.type === "ExportAllDeclaration") {
    return true;
  }

  return false;
}

function isEcmaScriptModuleImport(estreeNode: any): boolean {
  return estreeNode.type === "ImportDeclaration";
}

export function isEcmaScriptModuleDeclaration(estreeNode: any): boolean {
  return (
    isEcmaScriptModuleImport(estreeNode) || isEcmaScriptModuleExport(estreeNode)
  );
}
