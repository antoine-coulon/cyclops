import path from "node:path";

import builtinModules from "builtin-modules";

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

export function adaptModuleExtension(module: string): string {
  if (isJavaScriptModule(module)) {
    return module;
  }

  return module.concat(".js");
}
