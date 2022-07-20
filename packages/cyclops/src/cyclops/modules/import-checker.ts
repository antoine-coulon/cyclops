import path from "node:path";

import builtinModules from "builtin-modules";

import { FileReader } from "../../file-reader";

const NODE_PROTOCOL = "node:";

export function isBuiltinModule(module: string): boolean {
  if (module.startsWith("node:")) {
    // node:fs => fs
    const moduleName = module.slice(NODE_PROTOCOL.length);

    // node:fs/promises
    if (module.includes("/")) {
      return isBuiltinModule(moduleName);
    }

    return builtinModules.includes(moduleName);
  } else if (module.includes("/")) {
    const [moduleName] = module.split("/");

    return builtinModules.includes(moduleName);
  }

  return false;
}

export function isThirdPartyModule(module: string): boolean {
  return !module.startsWith(".");
}

export function isJSONModule(module: string): boolean {
  return module.endsWith(".json");
}

export function isBinaryModule(module: string): boolean {
  return module.endsWith(".node");
}

const kExpectedModuleExtensions = new Set([".js", ".mjs", ".cjs"]);

export function isJavaScriptModule(module: string): boolean {
  return kExpectedModuleExtensions.has(path.extname(module));
}

// Given a module name, resolve it to a file path.
export async function resolveImportedModulePath(
  module: string,
  fileReader: FileReader
): Promise<string> {
  // If the module name is the module itself, we have nothing to do.
  if (isJavaScriptModule(module)) {
    return module;
  }

  try {
    /**
     * In case of CommonJS modules, the module can be targetted through a directory
     * import e.g: require("./lib") which will eventually resolve to lib/index.js.
     */
    const maybePathToModule = path.join(module, "index.js");

    await fileReader.read(maybePathToModule);

    // If the file is found, we must resolve the path to the index.js file.
    return maybePathToModule;
  } catch {}

  // Otherwise, require("./lib") will resolve to "./lib.js".
  return module.concat(".js");
}
