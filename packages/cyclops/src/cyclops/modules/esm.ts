/**
 * ECMAScript Modules
 * Searching for named exports with no local variable binding such as
 * export { foo } from "./foo.js" as this export from another file is creating
 * a link between the two files.
 */
export function isEcmaScriptModuleImport(estreeNode: any): boolean {
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

  // Every type of import can be caught using the same node type
  if (estreeNode.type === "ImportDeclaration") {
    return true;
  }

  return false;
}
