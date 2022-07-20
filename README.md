<p align="center">
	<img alt="cyclops" src="https://user-images.githubusercontent.com/43391199/176795254-531273fc-5496-4f39-86f0-88b9cae3287d.png" width="320">
</p>

**cyclops** is a minimalist developer tool that can be used to generate directed graphs from your JavaScript/Node.js project. It can automatically collect metadata, detect circular dependencies and can be used to implement affected/incremental patterns as it exposes a way to know precisely dependencies for each graph node.

> **Note**
>
> **cyclops** is meant to represent all the file tree structure but was designed to only include dependencies that are currently being used in the project based on the entrypoint. Consequently unused files won't be included in the graph structure.

* ✅ Works for **JavaScript/Node.js** projects (ECMAScript and CommonJS modules)
* ✅ Deeply detects **circular dependencies** in an efficient way
* ✅ Deeply **collect all dependencies of the project graph**
* ✅ Deep **parent and child dependencies traversals**
* ✅ Node.js core, binary and JSON modules are excluded by default
* ✅ Third-party libraries are excluded by default

Work in progress includes:
* 🛠 Caching on graph operations to provide better traversal efficiency 
* 🛠 Collect metadata on the graph (unused imports, unoptimized imports)
* 🛠 Collect metadata on each traversed node (file size, number of other nodes depending on it, etc)
* 🛠 Resolve workspaces/monorepos graphs

## Examples

To initialize the dependency graph, the default exported function must be used first.
Once executed, the default function returns a set of functions to retrieve some
information about the graph just built.

```javascript
import cyclops from "cyclops";

const { getStructure } = await cyclops({
  entrypoint: "index.js"
});

const { graph, files } = getStructure();
console.log(graph); // logs { "index.js": { id: "index.js", adjacentTo: [], body: {...} } };
console.log(files); // logs [ "index.js" ]
```

**Search for circular dependencies**
```javascript
import cyclops from "cyclops";

const { getCircularDependencies, hasCircularDependencies } = await cyclops({
  entrypoint: "index.js"
});

// Imagine that starting from "index.js" cyclops detects a circular dependency
// between "core.js" and "utils.js" files

console.log(getCircularDependencies()); // logs [ [ "core.js", "utils.js" ] ]
console.log(hasCircularDependencies()); // logs "true"
```

**Search for leaves (nodes with no children i.e: dependency)**

leaf.js
```javascript
console.log("I'm a leaf because I have no dependency");
```

index.js
```javascript
import cyclops from "cyclops";

const { findLeaves } = await cyclops({
  entrypoint: "leaf.js"
});

console.log(findLeaves()); // logs [ "leaf.js" ]
```

**Deeply search for parent dependencies of a given node**

children.js
```javascript
export const childrenFunction = () => {};
```

parent.js
```javascript
import { childrenFunction } from "./children.js";

childrenFunction();
```

index.js
```javascript
import cyclops from "cyclops";

const { findParentsOf } = await cyclops({
  entrypoint: "parent.js"
});

console.log(findParentsOf("children.js")); // logs [ "parent.js" ]
```