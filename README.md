<p align="center">
	<img alt="cyclops" src="https://user-images.githubusercontent.com/43391199/176795254-531273fc-5496-4f39-86f0-88b9cae3287d.png" width="320">
</p>

**cyclops** is a minimalist developer tool that can be used to efficiently generate directed graphs from your JavaScript/Node.js project. It can automatically collect metadata, detect circular dependencies and can be used to implement affected/incremental patterns as it exposes a way to know precisely dependencies for each graph node.

_Graph Construction_
**cyclops** is powered by [digraph-js](https://github.com/antoine-coulon/digraph-js), a _0 dependency_ Node.js library to make Directed Graph construction and traversal effortless.

> **Note**
>
> **cyclops** goal is to represent all the file tree structure but was designed to only include dependencies currently being used in the project based on the entrypoint. Consequently unused files (files that are not imported/exported by any other file) won't be included in the graph structure.

* ✅ Works for **JavaScript/Node.js** projects (ECMAScript and CommonJS modules)
* ✅ Deeply detects **circular dependencies** in an efficient way, with the ability to provide a max depth for the search
* ✅ Deeply **collect all dependencies of the project graph**
* ✅ Deep **parent and child dependencies traversals**
* ✅ Node.js core, binary and JSON modules are excluded by default
* ✅ Third-party libraries are excluded by default

Work in progress includes:
* 🛠 Allow unused dependency to be flagged
* 🛠 Caching on graph operations to provide better traversal efficiency 
* 🛠 Collect metadata on the graph (unused imports, unoptimized imports)
* 🛠 Collect metadata on each traversed node (file size, number of other nodes depending on it, etc)
* 🛠 Resolve workspaces/monorepos graphs

## How to use Cyclops

### **API**

```javascript
import cyclops from "cyclops";

const { getStructure, findCircularDependencies, findParentsOf, ... } = await cyclops(config);
```

### **Command line interface**

Cyclops exposes a CLI with the same features as the core library.

When the library installed locally

```bash
$ ./node_modules/.bin/cyclops --entrypoint=src/index.js
```

When the library installed globally

```bash
$ cyclops --entrypoint=src/index.js
```

### **VSCode extension** (wip)

### **Web Application** (wip)


## Examples

To initialize the dependency graph, the default exported function must be used first.
Once executed, the default function returns a set of functions to retrieve some
information about the graph just built.

```javascript
import cyclops from "cyclops";

const { getStructure } = await cyclops({
  entrypoint: "index.js",
  // ...rest of the config
});

const { graph, files } = getStructure();
console.log(graph); // logs { "index.js": { id: "index.js", adjacentTo: [], body: {...} } };
console.log(files); // logs [ "index.js" ]
```

### Search for circular dependencies
```javascript
import cyclops from "cyclops";

const { findCircularDependencies, hasCircularDependencies } = await cyclops({
  entrypoint: "index.js",
   // ...rest of the config
});

// Imagine that starting from "index.js" cyclops detects a circular dependency
// between "core.js" and "utils.js" files

console.log(findCircularDependencies()); // logs [ [ "core.js", "utils.js" ] ]
console.log(hasCircularDependencies()); // logs "true"

/**
 * The search for circular dependencies can also be restricted to a certain depth.
 * This can be useful on big projects for performance purposes.
 * This defaults to POSITIVE_INFINITY.
 */
console.log(findCircularDependencies({ maxDepth: 5 })); 
console.log(hasCircularDependencies({ maxDepth: 5 })); 
```

### Search for leaves (nodes with no children)

leaf.js
```javascript
console.log("I'm a leaf because I have no dependency");
```

index.js
```javascript
import cyclops from "cyclops";

const { findLeaves } = await cyclops({
  entrypoint: "leaf.js",
   // ...rest of the config
});

console.log(findLeaves()); // logs [ "leaf.js" ]
```

### Deeply search for parent dependencies of a given node

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
  entrypoint: "parent.js",
   // ...rest of the config
});

console.log(findParentsOf("children.js")); // logs [ "parent.js" ]
```