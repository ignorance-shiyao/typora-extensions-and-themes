import "./chunks/chunk-NZLE2WMY.js";

// extensions/scripts/mindmap-vendor/node_modules/@markmap/core/dist/index.js
function translate(x, y) {
  return [
    1,
    0,
    0,
    1,
    x,
    y
  ];
}
function scaleAround(k, cx, cy) {
  return [
    k,
    0,
    0,
    k,
    cx * (1 - k),
    cy * (1 - k)
  ];
}
function multiply(a, b) {
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b02, b12, b22, b32, b42, b52] = b;
  return [
    a0 * b02 + a2 * b12,
    a1 * b02 + a3 * b12,
    a0 * b22 + a2 * b32,
    a1 * b22 + a3 * b32,
    a0 * b42 + a2 * b52 + a4,
    a1 * b42 + a3 * b52 + a5
  ];
}
function unionRects(rects) {
  let [x0, y0, x1, y1] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity
  ];
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  if (x0 > x1) return {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0
  };
}
function expandRect(rect, by) {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2
  };
}
var OPPOSITE = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top"
};
function oppositeSide(side) {
  return OPPOSITE[side];
}
function findPath(root2, id2) {
  if (root2.id === id2) return [root2];
  for (const child of root2.children) {
    const path = findPath(child, id2);
    if (path) return [root2, ...path];
  }
}
function findNode(root2, id2) {
  return findPath(root2, id2)?.at(-1);
}
function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}
function isSafeCSSValue(value) {
  return value.length > 0 && value.length <= 100 && !/[;{}<>\\'"]|\/\*/.test(value);
}
var validators = {
  number(min, integer = false) {
    return (value, key) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return { warning: `\`${key}\` must be a number` };
      if (value < min || integer && !Number.isInteger(value)) return { warning: `\`${key}\` must be ${integer ? "an integer " : ""}>= ${min}` };
      return { value };
    };
  },
  /** A short non-empty string, such as a name to look up. */
  string() {
    return (value, key) => typeof value === "string" && value.trim() && value.length <= 100 ? { value: value.trim() } : { warning: `\`${key}\` must be a non-empty string` };
  },
  oneOf(values) {
    return (value, key) => values.includes(value) ? { value } : { warning: `\`${key}\` must be one of ${values.map((v) => `\`${v}\``).join(", ")}` };
  },
  boolean() {
    return (value, key) => typeof value === "boolean" ? { value } : { warning: `\`${key}\` must be true or false` };
  },
  /** One CSS color or a list of them; always normalized to a list. Unsafe values are dropped. */
  colors() {
    return (value, key) => {
      const colors = typeof value === "string" ? [value] : value;
      if (!Array.isArray(colors) || !colors.length) return { warning: `\`${key}\` must be a color or a list of colors` };
      const safe = colors.filter((c) => typeof c === "string" && isSafeCSSValue(c.trim())).map((c) => c.trim());
      return {
        value: safe.length ? safe : void 0,
        warning: safe.length < colors.length ? `\`${key}\` has invalid colors, which were ignored` : void 0
      };
    };
  }
};
var CORE_SCHEMA = {
  foldLevel: validators.number(0, true),
  wrapWidth: validators.number(0),
  levelGap: validators.number(0),
  siblingGap: validators.number(0),
  zoom: validators.boolean(),
  pan: validators.boolean(),
  fitPadding: validators.number(0),
  fitMaxScale: validators.number(0.01),
  minScale: validators.number(1e-3),
  maxScale: validators.number(0.01),
  duration: validators.number(0),
  layout: validators.string(),
  theme: validators.string(),
  colorScheme: validators.oneOf([
    "light",
    "dark",
    "auto"
  ])
};
function validateOptions(input, schema) {
  const options = {};
  const rest = {};
  const warnings = [];
  if (input == null) return {
    options,
    rest,
    warnings
  };
  if (typeof input !== "object" || Array.isArray(input)) return {
    options,
    rest,
    warnings: ["`markmap` options must be an object"]
  };
  for (const [key, raw] of Object.entries(input)) {
    const validate = Object.hasOwn(schema, key) ? schema[key] : void 0;
    if (!validate) {
      rest[key] = raw;
      continue;
    }
    const { value, warning } = validate(raw, key);
    if (warning) warnings.push(warning);
    if (value !== void 0) options[key] = value;
  }
  return {
    options,
    rest,
    warnings
  };
}
function readJSONOptions(input) {
  return validateOptions(input, CORE_SCHEMA);
}
function unknownOptionWarnings(rest) {
  return Object.keys(rest).map((key) => `Unknown option \`${key}\``);
}

// extensions/scripts/mindmap-vendor/node_modules/flatqueue/index.js
var FlatQueue = class {
  /**
   * Creates an empty queue. If `capacity` is provided, the queue is backed by fixed-size typed
   * arrays for better performance and memory use, but can't grow beyond `capacity`. `values` uses
   * `ValuesArray` (default `Float64Array`) and `ids` uses `IdsArray` (default `Uint32Array`); pass
   * narrower constructors like `Uint16Array` if your values or ids are known to fit them.
   *
   * @param {number} [capacity]
   * @param {TypedArrayConstructor} [ValuesArray]
   * @param {TypedArrayConstructor} [IdsArray]
   */
  constructor(capacity = Infinity, ValuesArray = Float64Array, IdsArray = Uint32Array) {
    const fixed = capacity !== Infinity;
    this.ids = fixed ? (
      /** @type {T[]} */
      /** @type {unknown} */
      new IdsArray(capacity)
    ) : [];
    this.values = fixed ? (
      /** @type {number[]} */
      /** @type {unknown} */
      new ValuesArray(capacity)
    ) : [];
    this.capacity = capacity;
    this.length = 0;
  }
  /** Removes all items from the queue. */
  clear() {
    this.length = 0;
  }
  /**
   * Adds `item` to the queue with the specified `priority`.
   *
   * `priority` must be a number. Items are sorted and returned from low to high priority. Multiple items
   * with the same priority value can be added to the queue, but there is no guaranteed order between these items.
   *
   * For fixed-capacity queues, throws a `RangeError` if the queue is already full.
   *
   * @param {T} item
   * @param {number} priority
   */
  push(item, priority) {
    if (this.length === this.capacity) throw new RangeError("Queue is at capacity.");
    let pos = this.length++;
    while (pos > 0) {
      const parent = pos - 1 >> 1;
      const parentValue = this.values[parent];
      if (priority >= parentValue) break;
      this.ids[pos] = this.ids[parent];
      this.values[pos] = parentValue;
      pos = parent;
    }
    this.ids[pos] = item;
    this.values[pos] = priority;
  }
  /**
   * Removes and returns the item from the head of this queue, which is one of
   * the items with the lowest priority. If this queue is empty, returns `undefined`.
   */
  pop() {
    if (this.length === 0) return void 0;
    const ids = this.ids, values = this.values, top = ids[0], last = --this.length;
    if (last > 0) {
      const id2 = ids[last];
      const value = values[last];
      let pos = 0;
      const halfLen = last >> 1;
      while (pos < halfLen) {
        const left = (pos << 1) + 1;
        const right = left + 1;
        const child = left + (+(right < last) & +(values[right] < values[left]));
        if (values[child] >= value) break;
        ids[pos] = ids[child];
        values[pos] = values[child];
        pos = child;
      }
      ids[pos] = id2;
      values[pos] = value;
    }
    return top;
  }
  /** Returns the item from the head of this queue without removing it. If this queue is empty, returns `undefined`. */
  peek() {
    return this.length > 0 ? this.ids[0] : void 0;
  }
  /**
   * Returns the priority value of the item at the head of this queue without
   * removing it. If this queue is empty, returns `undefined`.
   */
  peekValue() {
    return this.length > 0 ? this.values[0] : void 0;
  }
  /**
   * Shrinks the internal arrays to `this.length`. No-op for queues with fixed capacity.
   *
   * `pop()` and `clear()` calls don't free memory automatically to avoid unnecessary resize operations.
   * This also means that items that have been added to the queue can't be garbage collected until
   * a new item is pushed in their place, or this method is called.
   */
  shrink() {
    if (Array.isArray(this.ids)) this.ids.length = this.length;
    if (Array.isArray(this.values)) this.values.length = this.length;
  }
};

// extensions/scripts/mindmap-vendor/node_modules/flatbush/index.js
var ARRAY_TYPES = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
var VERSION = 3;
var Flatbush = class _Flatbush {
  /**
   * Recreate a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data.
   * @param {ArrayBufferLike} data
   * @param {number} [byteOffset=0] byte offset to the start of the Flatbush buffer in the referenced ArrayBuffer.
   * @returns {Flatbush} index
   */
  static from(data, byteOffset = 0) {
    if (byteOffset % 8 !== 0) {
      throw new Error("byteOffset must be 8-byte aligned.");
    }
    if (!data || data.byteLength === void 0 || "buffer" in data) {
      throw new Error("Data must be an instance of ArrayBuffer or SharedArrayBuffer.");
    }
    const [magic, versionAndType] = new Uint8Array(data, byteOffset + 0, 2);
    if (magic !== 251) {
      throw new Error("Data does not appear to be in a Flatbush format.");
    }
    const version2 = versionAndType >> 4;
    if (version2 !== VERSION) {
      throw new Error(`Got v${version2} data when expected v${VERSION}.`);
    }
    const ArrayType = ARRAY_TYPES[versionAndType & 15];
    if (!ArrayType) {
      throw new Error("Unrecognized array type.");
    }
    const [nodeSize] = new Uint16Array(data, byteOffset + 2, 1);
    const [numItems] = new Uint32Array(data, byteOffset + 4, 1);
    return new _Flatbush(numItems, nodeSize, ArrayType, void 0, data, byteOffset);
  }
  /**
   * Create a Flatbush index that will hold a given number of items.
   * @param {number} numItems
   * @param {number} [nodeSize=16] Size of the tree node (16 by default).
   * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
   * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
   * @param {ArrayBufferLike} [data] (Only used internally)
   * @param {number} [byteOffset=0] (Only used internally)
   */
  constructor(numItems, nodeSize = 16, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data, byteOffset = 0) {
    if (numItems === void 0) throw new Error("Missing required argument: numItems.");
    if (isNaN(numItems) || numItems <= 0) throw new Error(`Unexpected numItems value: ${numItems}.`);
    this.numItems = +numItems;
    this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
    this.byteOffset = byteOffset;
    let n = numItems;
    let numNodes = n;
    this._levelBounds = [n * 4];
    do {
      n = Math.ceil(n / this.nodeSize);
      numNodes += n;
      this._levelBounds.push(numNodes * 4);
    } while (n !== 1);
    this.ArrayType = ArrayType;
    this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;
    const arrayTypeIndex = ARRAY_TYPES.indexOf(ArrayType);
    const nodesByteSize = numNodes * 4 * ArrayType.BYTES_PER_ELEMENT;
    if (arrayTypeIndex < 0) {
      throw new Error(`Unexpected typed array class: ${ArrayType}.`);
    }
    const BoxCtor = ArrayType;
    const IdxCtor = this.IndexArrayType;
    if (data) {
      this.data = data;
      this._boxes = new BoxCtor(data, byteOffset + 8, numNodes * 4);
      this._indices = new IdxCtor(data, byteOffset + 8 + nodesByteSize, numNodes);
      this._pos = numNodes * 4;
      this.minX = this._boxes[this._pos - 4];
      this.minY = this._boxes[this._pos - 3];
      this.maxX = this._boxes[this._pos - 2];
      this.maxY = this._boxes[this._pos - 1];
    } else {
      const data2 = this.data = new ArrayBufferType(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
      this._boxes = new BoxCtor(data2, 8, numNodes * 4);
      this._indices = new IdxCtor(data2, 8 + nodesByteSize, numNodes);
      this._pos = 0;
      this.minX = Infinity;
      this.minY = Infinity;
      this.maxX = -Infinity;
      this.maxY = -Infinity;
      new Uint8Array(data2, 0, 2).set([251, (VERSION << 4) + arrayTypeIndex]);
      new Uint16Array(data2, 2, 1)[0] = this.nodeSize;
      new Uint32Array(data2, 4, 1)[0] = numItems;
    }
    this._queue = new FlatQueue();
  }
  /**
   * Add a given rectangle to the index.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @returns {number} A zero-based, incremental number that represents the newly added rectangle.
   */
  add(minX, minY, maxX = minX, maxY = minY) {
    const pos = this._pos;
    const index = pos >> 2;
    const boxes = this._boxes;
    this._indices[index] = index;
    boxes[pos] = minX;
    boxes[pos + 1] = minY;
    boxes[pos + 2] = maxX;
    boxes[pos + 3] = maxY;
    this._pos = pos + 4;
    if (minX < this.minX) this.minX = minX;
    if (minY < this.minY) this.minY = minY;
    if (maxX > this.maxX) this.maxX = maxX;
    if (maxY > this.maxY) this.maxY = maxY;
    return index;
  }
  /** Perform indexing of the added rectangles. */
  finish() {
    if (this._pos >> 2 !== this.numItems) {
      throw new Error(`Added ${this._pos >> 2} items when expected ${this.numItems}.`);
    }
    const boxes = this._boxes;
    if (this.numItems <= this.nodeSize) {
      boxes[this._pos++] = this.minX;
      boxes[this._pos++] = this.minY;
      boxes[this._pos++] = this.maxX;
      boxes[this._pos++] = this.maxY;
      return;
    }
    const { numItems, minX, minY, nodeSize, _indices: indices, _levelBounds: levelBounds } = this;
    const width = this.maxX - minX || 1;
    const height = this.maxY - minY || 1;
    const hilbertValues = new Int32Array(numItems);
    const hilbertMax = (1 << 16) - 1;
    const sx = hilbertMax / width;
    const sy = hilbertMax / height;
    for (let i = 0, pos2 = 0; i < numItems; i++) {
      const itemMinX = boxes[pos2++];
      const itemMinY = boxes[pos2++];
      const itemMaxX = boxes[pos2++];
      const itemMaxY = boxes[pos2++];
      const x = sx * ((itemMinX + itemMaxX) / 2 - minX) | 0;
      const y = sy * ((itemMinY + itemMaxY) / 2 - minY) | 0;
      hilbertValues[i] = hilbert(x, y);
    }
    sort(hilbertValues, boxes, indices, 0, numItems - 1, nodeSize);
    let pos = numItems * 4;
    for (let i = 0, readPos = 0; i < levelBounds.length - 1; i++) {
      const end = levelBounds[i];
      while (readPos < end) {
        const nodeIndex = readPos;
        let nodeMinX = boxes[readPos++];
        let nodeMinY = boxes[readPos++];
        let nodeMaxX = boxes[readPos++];
        let nodeMaxY = boxes[readPos++];
        for (let j = 1; j < nodeSize && readPos < end; j++) {
          nodeMinX = Math.min(nodeMinX, boxes[readPos++]);
          nodeMinY = Math.min(nodeMinY, boxes[readPos++]);
          nodeMaxX = Math.max(nodeMaxX, boxes[readPos++]);
          nodeMaxY = Math.max(nodeMaxY, boxes[readPos++]);
        }
        indices[pos >> 2] = nodeIndex;
        boxes[pos++] = nodeMinX;
        boxes[pos++] = nodeMinY;
        boxes[pos++] = nodeMaxX;
        boxes[pos++] = nodeMaxY;
      }
    }
    this._pos = pos;
  }
  /**
   * Search the index by a bounding box.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {(index: number, x0: number, y0: number, x1: number, y1: number) => boolean} [filterFn] An optional function that is called on every found item; if supplied, only items for which this function returns true will be included in the results array.
   * @returns {number[]} An array of indices of items intersecting or touching the given bounding box.
   */
  search(minX, minY, maxX, maxY, filterFn) {
    if (this._pos !== this._boxes.length) {
      throw new Error("Data not yet indexed - call index.finish().");
    }
    const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, nodeSize } = this;
    const numItems4 = this.numItems * 4;
    let nodeIndex = boxes.length - 4;
    let level = levelBounds.length - 1;
    const q = [];
    const results = [];
    let contained = false;
    while (nodeIndex !== void 0) {
      const end = Math.min(nodeIndex + nodeSize * 4, levelBounds[level]);
      const isNode = nodeIndex >= numItems4;
      if (contained) {
        this._collectContained(nodeIndex, end, level, numItems4, results, filterFn);
      } else {
        for (let pos = nodeIndex; pos < end; pos += 4) {
          const x0 = boxes[pos];
          if (maxX < x0) continue;
          const y0 = boxes[pos + 1];
          if (maxY < y0) continue;
          const x1 = boxes[pos + 2];
          if (minX > x1) continue;
          const y1 = boxes[pos + 3];
          if (minY > y1) continue;
          const index = indices[pos >> 2] | 0;
          if (isNode) {
            const c = +(minX <= x0 && minY <= y0 && maxX >= x1 && maxY >= y1);
            q.push(index | c, level - 1);
          } else if (filterFn === void 0 || filterFn(index, x0, y0, x1, y1)) {
            results.push(index);
          }
        }
      }
      level = /** @type {number} */
      q.pop();
      nodeIndex = q.pop();
      if (nodeIndex !== void 0) {
        contained = (nodeIndex & 1) === 1;
        nodeIndex &= ~1;
      }
    }
    return results;
  }
  /**
   * Collect all leaves of a subtree that's fully inside the query, skipping intersection tests.
   * Because the tree is packed bottom-up, those leaves occupy one contiguous block of the leaf
   * level, so we skip traversal entirely: descend to the first leaf, then sweep the flat range.
   * @param {number} nodeIndex
   * @param {number} end
   * @param {number} level
   * @param {number} numItems4
   * @param {number[]} results
   * @param {((index: number, x0: number, y0: number, x1: number, y1: number) => boolean) | undefined} filterFn
   */
  _collectContained(nodeIndex, end, level, numItems4, results, filterFn) {
    const boxes = this._boxes;
    const indices = this._indices;
    let pos = nodeIndex;
    for (let l = level; l > 0; l--) pos = indices[pos >> 2];
    const leafEnd = Math.min(pos + (end - nodeIndex) * this.nodeSize ** level, numItems4);
    if (filterFn === void 0) {
      for (; pos < leafEnd; pos += 4) results.push(indices[pos >> 2] | 0);
    } else {
      for (; pos < leafEnd; pos += 4) {
        const index = indices[pos >> 2] | 0;
        if (filterFn(index, boxes[pos], boxes[pos + 1], boxes[pos + 2], boxes[pos + 3])) results.push(index);
      }
    }
  }
  /**
   * Check whether any item intersects or touches a bounding box, stopping at the first match.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {(index: number, x0: number, y0: number, x1: number, y1: number) => boolean} [filterFn] An optional function that is called on found items; if supplied, only items for which this function returns true count as a match.
   * @returns {boolean} Whether a matching item was found.
   */
  collides(minX, minY, maxX, maxY, filterFn) {
    if (this._pos !== this._boxes.length) {
      throw new Error("Data not yet indexed - call index.finish().");
    }
    const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, nodeSize } = this;
    const numItems4 = this.numItems * 4;
    let nodeIndex = boxes.length - 4;
    let level = levelBounds.length - 1;
    const q = [];
    while (nodeIndex !== void 0) {
      const end = Math.min(nodeIndex + nodeSize * 4, levelBounds[level]);
      const isNode = nodeIndex >= numItems4;
      for (let pos = nodeIndex; pos < end; pos += 4) {
        const x0 = boxes[pos];
        if (maxX < x0) continue;
        const y0 = boxes[pos + 1];
        if (maxY < y0) continue;
        const x1 = boxes[pos + 2];
        if (minX > x1) continue;
        const y1 = boxes[pos + 3];
        if (minY > y1) continue;
        const index = indices[pos >> 2] | 0;
        if (isNode) {
          q.push(index, level - 1);
        } else if (filterFn === void 0 || filterFn(index, x0, y0, x1, y1)) {
          return true;
        }
      }
      level = /** @type {number} */
      q.pop();
      nodeIndex = q.pop();
    }
    return false;
  }
  /**
   * Search items in order of distance from the given point.
   * @param {number} x
   * @param {number} y
   * @param {number} [maxResults=Infinity]
   * @param {number} [maxDistance=Infinity]
   * @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
   * @returns {number[]} An array of indices of items found.
   */
  neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
    if (this._pos !== this._boxes.length) {
      throw new Error("Data not yet indexed - call index.finish().");
    }
    const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, _queue: q, nodeSize } = this;
    const numItems4 = this.numItems * 4;
    const nodeSize4 = nodeSize * 4;
    const results = [];
    const maxDistSquared = maxDistance * maxDistance;
    const trackNearest = maxResults === 1;
    let bound = maxDistSquared;
    q.push(boxes.length - 4 << 1, 0);
    while (q.length) {
      const top = q.ids[0];
      if (top & 1) {
        q.pop();
        results.push(top >> 1);
        if (results.length === maxResults) break;
        continue;
      }
      q.pop();
      const nodeIndex = top >> 1;
      const isLeafLevel = nodeIndex < numItems4;
      const end = Math.min(nodeIndex + nodeSize4, upperBound(nodeIndex, levelBounds));
      for (let pos = nodeIndex; pos < end; pos += 4) {
        const minX = boxes[pos];
        const minY = boxes[pos + 1];
        const maxX = boxes[pos + 2];
        const maxY = boxes[pos + 3];
        const dx = Math.max(Math.max(minX - x, x - maxX), 0);
        const dy = Math.max(Math.max(minY - y, y - maxY), 0);
        const dist = dx * dx + dy * dy;
        if (dist > bound) continue;
        const childIndex = indices[pos >> 2] | 0;
        if (isLeafLevel) {
          if (filterFn === void 0 || filterFn(childIndex)) {
            q.push(childIndex << 1 | 1, dist);
            if (trackNearest && dist < bound) bound = dist;
          }
        } else {
          q.push(childIndex << 1, dist);
        }
      }
    }
    q.clear();
    return results;
  }
};
function upperBound(value, arr) {
  let i = 0;
  let j = arr.length - 1;
  while (i < j) {
    const m = i + j >> 1;
    if (arr[m] > value) {
      j = m;
    } else {
      i = m + 1;
    }
  }
  return arr[i];
}
function sort(values, boxes, indices, left, right, nodeSize) {
  const stack = [left, right];
  while (stack.length) {
    const r = stack.pop() || 0;
    const l = stack.pop() || 0;
    if (r - l <= nodeSize && Math.floor(l / nodeSize) >= Math.floor(r / nodeSize)) continue;
    const a = values[l];
    const b = values[l + r >> 1];
    const c = values[r];
    const pivot = a > b !== a > c ? a : b < a !== b < c ? b : c;
    let i = l - 1;
    let j = r + 1;
    while (true) {
      do
        i++;
      while (values[i] < pivot);
      do
        j--;
      while (values[j] > pivot);
      if (i >= j) break;
      swap(values, boxes, indices, i, j);
    }
    stack.push(l, j, j + 1, r);
  }
}
function swap(values, boxes, indices, i, j) {
  const temp = values[i];
  values[i] = values[j];
  values[j] = temp;
  const k = 4 * i;
  const m = 4 * j;
  const a = boxes[k];
  const b = boxes[k + 1];
  const c = boxes[k + 2];
  const d = boxes[k + 3];
  boxes[k] = boxes[m];
  boxes[k + 1] = boxes[m + 1];
  boxes[k + 2] = boxes[m + 2];
  boxes[k + 3] = boxes[m + 3];
  boxes[m] = a;
  boxes[m + 1] = b;
  boxes[m + 2] = c;
  boxes[m + 3] = d;
  const e = indices[i];
  indices[i] = indices[j];
  indices[j] = e;
}
function hilbert(x, y) {
  let a = x ^ y;
  let b = 65535 ^ a;
  let c = 65535 ^ (x | y);
  let d = x & (y ^ 65535);
  let A2 = a | b >> 1;
  let B2 = a >> 1 ^ a;
  let C2 = c ^ (c >> 1 ^ b & d >> 1);
  let D2 = d ^ (a & c >> 1 ^ d >> 1);
  a = A2 & A2 >> 2 ^ B2 & B2 >> 2;
  b = A2 & B2 >> 2 ^ B2 & (A2 ^ B2) >> 2;
  c = C2 ^ (A2 & C2 >> 2 ^ B2 & D2 >> 2);
  d = D2 ^ (B2 & C2 >> 2 ^ (A2 ^ B2) & D2 >> 2);
  A2 = a & a >> 4 ^ b & b >> 4;
  B2 = a & b >> 4 ^ b & (a ^ b) >> 4;
  C2 = c ^ (a & c >> 4 ^ b & d >> 4);
  D2 = d ^ (b & c >> 4 ^ (a ^ b) & d >> 4);
  c = C2 ^ (A2 & C2 >> 8 ^ B2 & D2 >> 8);
  d = D2 ^ (B2 & C2 >> 8 ^ (A2 ^ B2) & D2 >> 8);
  c ^= c >> 1;
  d ^= d >> 1;
  a = x ^ y;
  b = d | 65535 ^ (a | c);
  a = (a | a << 8) & 16711935;
  a = (a | a << 4) & 252645135;
  a = (a | a << 2) & 858993459;
  a = (a | a << 1) & 1431655765;
  b = (b | b << 8) & 16711935;
  b = (b | b << 4) & 252645135;
  b = (b | b << 2) & 858993459;
  b = (b | b << 1) & 1431655765;
  return ((b << 1 | a) >>> 0) - 2147483648;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/count.js
function count(node) {
  var sum = 0, children2 = node.children, i = children2 && children2.length;
  if (!i) sum = 1;
  else while (--i >= 0) sum += children2[i].value;
  node.value = sum;
}
function count_default() {
  return this.eachAfter(count);
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/each.js
function each_default(callback) {
  var node = this, current, next = [node], children2, i, n;
  do {
    current = next.reverse(), next = [];
    while (node = current.pop()) {
      callback(node), children2 = node.children;
      if (children2) for (i = 0, n = children2.length; i < n; ++i) {
        next.push(children2[i]);
      }
    }
  } while (next.length);
  return this;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/eachBefore.js
function eachBefore_default(callback) {
  var node = this, nodes = [node], children2, i;
  while (node = nodes.pop()) {
    callback(node), children2 = node.children;
    if (children2) for (i = children2.length - 1; i >= 0; --i) {
      nodes.push(children2[i]);
    }
  }
  return this;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/eachAfter.js
function eachAfter_default(callback) {
  var node = this, nodes = [node], next = [], children2, i, n;
  while (node = nodes.pop()) {
    next.push(node), children2 = node.children;
    if (children2) for (i = 0, n = children2.length; i < n; ++i) {
      nodes.push(children2[i]);
    }
  }
  while (node = next.pop()) {
    callback(node);
  }
  return this;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/sum.js
function sum_default(value) {
  return this.eachAfter(function(node) {
    var sum = +value(node.data) || 0, children2 = node.children, i = children2 && children2.length;
    while (--i >= 0) sum += children2[i].value;
    node.value = sum;
  });
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/sort.js
function sort_default(compare) {
  return this.eachBefore(function(node) {
    if (node.children) {
      node.children.sort(compare);
    }
  });
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/path.js
function path_default(end) {
  var start2 = this, ancestor = leastCommonAncestor(start2, end), nodes = [start2];
  while (start2 !== ancestor) {
    start2 = start2.parent;
    nodes.push(start2);
  }
  var k = nodes.length;
  while (end !== ancestor) {
    nodes.splice(k, 0, end);
    end = end.parent;
  }
  return nodes;
}
function leastCommonAncestor(a, b) {
  if (a === b) return a;
  var aNodes = a.ancestors(), bNodes = b.ancestors(), c = null;
  a = aNodes.pop();
  b = bNodes.pop();
  while (a === b) {
    c = a;
    a = aNodes.pop();
    b = bNodes.pop();
  }
  return c;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/ancestors.js
function ancestors_default() {
  var node = this, nodes = [node];
  while (node = node.parent) {
    nodes.push(node);
  }
  return nodes;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/descendants.js
function descendants_default() {
  var nodes = [];
  this.each(function(node) {
    nodes.push(node);
  });
  return nodes;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/leaves.js
function leaves_default() {
  var leaves = [];
  this.eachBefore(function(node) {
    if (!node.children) {
      leaves.push(node);
    }
  });
  return leaves;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/links.js
function links_default() {
  var root2 = this, links = [];
  root2.each(function(node) {
    if (node !== root2) {
      links.push({ source: node.parent, target: node });
    }
  });
  return links;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-hierarchy/src/hierarchy/index.js
function hierarchy(data, children2) {
  var root2 = new Node(data), valued = +data.value && (root2.value = data.value), node, nodes = [root2], child, childs, i, n;
  if (children2 == null) children2 = defaultChildren;
  while (node = nodes.pop()) {
    if (valued) node.value = +node.data.value;
    if ((childs = children2(node.data)) && (n = childs.length)) {
      node.children = new Array(n);
      for (i = n - 1; i >= 0; --i) {
        nodes.push(child = node.children[i] = new Node(childs[i]));
        child.parent = node;
        child.depth = node.depth + 1;
      }
    }
  }
  return root2.eachBefore(computeHeight);
}
function node_copy() {
  return hierarchy(this).eachBefore(copyData);
}
function defaultChildren(d) {
  return d.children;
}
function copyData(node) {
  node.data = node.data.data;
}
function computeHeight(node) {
  var height = 0;
  do
    node.height = height;
  while ((node = node.parent) && node.height < ++height);
}
function Node(data) {
  this.data = data;
  this.depth = this.height = 0;
  this.parent = null;
}
Node.prototype = hierarchy.prototype = {
  constructor: Node,
  count: count_default,
  each: each_default,
  eachAfter: eachAfter_default,
  eachBefore: eachBefore_default,
  sum: sum_default,
  sort: sort_default,
  path: path_default,
  ancestors: ancestors_default,
  descendants: descendants_default,
  leaves: leaves_default,
  links: links_default,
  copy: node_copy
};

// extensions/scripts/mindmap-vendor/node_modules/d3-flextree/package.json
var package_default = {
  name: "d3-flextree",
  version: "2.1.2",
  main: "build/d3-flextree.js",
  module: "index",
  "jsnext:main": "index",
  author: {
    name: "Chris Maloney",
    url: "http://chrismaloney.org"
  },
  description: "Flexible tree layout algorithm that allows for variable node sizes.",
  keywords: [
    "d3",
    "d3-module",
    "layout",
    "tree",
    "hierarchy",
    "d3-hierarchy",
    "plugin",
    "d3-plugin",
    "infovis",
    "visualization",
    "2d"
  ],
  homepage: "https://github.com/klortho/d3-flextree",
  license: "WTFPL",
  repository: {
    type: "git",
    url: "https://github.com/klortho/d3-flextree.git"
  },
  scripts: {
    clean: "rm -rf build demo test",
    "build:demo": "rollup -c --environment BUILD:demo",
    "build:dev": "rollup -c --environment BUILD:dev",
    "build:prod": "rollup -c --environment BUILD:prod",
    "build:test": "rollup -c --environment BUILD:test",
    build: "rollup -c",
    lint: "eslint index.js src",
    "test:main": "node test/bundle.js",
    "test:browser": "node test/browser-tests.js",
    test: "npm-run-all test:*",
    prepare: "npm-run-all clean build lint test"
  },
  dependencies: {
    "d3-hierarchy": "^1.1.5"
  },
  devDependencies: {
    "babel-plugin-external-helpers": "^6.22.0",
    "babel-preset-es2015-rollup": "^3.0.0",
    d3: "^4.13.0",
    "d3-selection-multi": "^1.0.1",
    eslint: "^4.19.1",
    jsdom: "^11.6.2",
    "npm-run-all": "^4.1.2",
    rollup: "^0.55.3",
    "rollup-plugin-babel": "^2.7.1",
    "rollup-plugin-commonjs": "^8.0.2",
    "rollup-plugin-copy": "^0.2.3",
    "rollup-plugin-json": "^2.3.0",
    "rollup-plugin-node-resolve": "^3.0.2",
    "rollup-plugin-uglify": "^3.0.0",
    "uglify-es": "^3.3.9"
  }
};

// extensions/scripts/mindmap-vendor/node_modules/d3-flextree/src/flextree.js
var { version } = package_default;
var defaults = Object.freeze({
  children: (data) => data.children,
  nodeSize: (node) => node.data.size,
  spacing: 0
});
function flextree(options) {
  const opts = Object.assign({}, defaults, options);
  function accessor(name) {
    const opt = opts[name];
    return typeof opt === "function" ? opt : () => opt;
  }
  function layout(tree) {
    const wtree = wrap(getWrapper(), tree, (node) => node.children);
    wtree.update();
    return wtree.data;
  }
  function getFlexNode() {
    const nodeSize = accessor("nodeSize");
    const spacing = accessor("spacing");
    return class FlexNode extends hierarchy.prototype.constructor {
      constructor(data) {
        super(data);
      }
      copy() {
        const c = wrap(this.constructor, this, (node) => node.children);
        c.each((node) => node.data = node.data.data);
        return c;
      }
      get size() {
        return nodeSize(this);
      }
      spacing(oNode) {
        return spacing(this, oNode);
      }
      get nodes() {
        return this.descendants();
      }
      get xSize() {
        return this.size[0];
      }
      get ySize() {
        return this.size[1];
      }
      get top() {
        return this.y;
      }
      get bottom() {
        return this.y + this.ySize;
      }
      get left() {
        return this.x - this.xSize / 2;
      }
      get right() {
        return this.x + this.xSize / 2;
      }
      get root() {
        const ancs = this.ancestors();
        return ancs[ancs.length - 1];
      }
      get numChildren() {
        return this.hasChildren ? this.children.length : 0;
      }
      get hasChildren() {
        return !this.noChildren;
      }
      get noChildren() {
        return this.children === null;
      }
      get firstChild() {
        return this.hasChildren ? this.children[0] : null;
      }
      get lastChild() {
        return this.hasChildren ? this.children[this.numChildren - 1] : null;
      }
      get extents() {
        return (this.children || []).reduce(
          (acc, kid) => FlexNode.maxExtents(acc, kid.extents),
          this.nodeExtents
        );
      }
      get nodeExtents() {
        return {
          top: this.top,
          bottom: this.bottom,
          left: this.left,
          right: this.right
        };
      }
      static maxExtents(e0, e1) {
        return {
          top: Math.min(e0.top, e1.top),
          bottom: Math.max(e0.bottom, e1.bottom),
          left: Math.min(e0.left, e1.left),
          right: Math.max(e0.right, e1.right)
        };
      }
    };
  }
  function getWrapper() {
    const FlexNode = getFlexNode();
    const nodeSize = accessor("nodeSize");
    const spacing = accessor("spacing");
    return class extends FlexNode {
      constructor(data) {
        super(data);
        Object.assign(this, {
          x: 0,
          y: 0,
          relX: 0,
          prelim: 0,
          shift: 0,
          change: 0,
          lExt: this,
          lExtRelX: 0,
          lThr: null,
          rExt: this,
          rExtRelX: 0,
          rThr: null
        });
      }
      get size() {
        return nodeSize(this.data);
      }
      spacing(oNode) {
        return spacing(this.data, oNode.data);
      }
      get x() {
        return this.data.x;
      }
      set x(v) {
        this.data.x = v;
      }
      get y() {
        return this.data.y;
      }
      set y(v) {
        this.data.y = v;
      }
      update() {
        layoutChildren(this);
        resolveX(this);
        return this;
      }
    };
  }
  function wrap(FlexClass, treeData, children2) {
    const _wrap = (data, parent) => {
      const node = new FlexClass(data);
      Object.assign(node, {
        parent,
        depth: parent === null ? 0 : parent.depth + 1,
        height: 0,
        length: 1
      });
      const kidsData = children2(data) || [];
      node.children = kidsData.length === 0 ? null : kidsData.map((kd) => _wrap(kd, node));
      if (node.children) {
        Object.assign(node, node.children.reduce(
          (hl, kid) => ({
            height: Math.max(hl.height, kid.height + 1),
            length: hl.length + kid.length
          }),
          node
        ));
      }
      return node;
    };
    return _wrap(treeData, null);
  }
  Object.assign(layout, {
    nodeSize(arg) {
      return arguments.length ? (opts.nodeSize = arg, layout) : opts.nodeSize;
    },
    spacing(arg) {
      return arguments.length ? (opts.spacing = arg, layout) : opts.spacing;
    },
    children(arg) {
      return arguments.length ? (opts.children = arg, layout) : opts.children;
    },
    hierarchy(treeData, children2) {
      const kids = typeof children2 === "undefined" ? opts.children : children2;
      return wrap(getFlexNode(), treeData, kids);
    },
    dump(tree) {
      const nodeSize = accessor("nodeSize");
      const _dump = (i0) => (node) => {
        const i1 = i0 + "  ";
        const i2 = i0 + "    ";
        const { x, y } = node;
        const size = nodeSize(node);
        const kids = node.children || [];
        const kdumps = kids.length === 0 ? " " : `,${i1}children: [${i2}${kids.map(_dump(i2)).join(i2)}${i1}],${i0}`;
        return `{ size: [${size.join(", ")}],${i1}x: ${x}, y: ${y}${kdumps}},`;
      };
      return _dump("\n")(tree);
    }
  });
  return layout;
}
flextree.version = version;
var layoutChildren = (w, y = 0) => {
  w.y = y;
  (w.children || []).reduce((acc, kid) => {
    const [i, lastLows] = acc;
    layoutChildren(kid, w.y + w.ySize);
    const lowY = (i === 0 ? kid.lExt : kid.rExt).bottom;
    if (i !== 0) separate(w, i, lastLows);
    const lows = updateLows(lowY, i, lastLows);
    return [i + 1, lows];
  }, [0, null]);
  shiftChange(w);
  positionRoot(w);
  return w;
};
var resolveX = (w, prevSum, parentX) => {
  if (typeof prevSum === "undefined") {
    prevSum = -w.relX - w.prelim;
    parentX = 0;
  }
  const sum = prevSum + w.relX;
  w.relX = sum + w.prelim - parentX;
  w.prelim = 0;
  w.x = parentX + w.relX;
  (w.children || []).forEach((k) => resolveX(k, sum, w.x));
  return w;
};
var shiftChange = (w) => {
  (w.children || []).reduce((acc, child) => {
    const [lastShiftSum, lastChangeSum] = acc;
    const shiftSum = lastShiftSum + child.shift;
    const changeSum = lastChangeSum + shiftSum + child.change;
    child.relX += changeSum;
    return [shiftSum, changeSum];
  }, [0, 0]);
};
var separate = (w, i, lows) => {
  const lSib = w.children[i - 1];
  const curSubtree = w.children[i];
  let rContour = lSib;
  let rSumMods = lSib.relX;
  let lContour = curSubtree;
  let lSumMods = curSubtree.relX;
  let isFirst = true;
  while (rContour && lContour) {
    if (rContour.bottom > lows.lowY) lows = lows.next;
    const dist = rSumMods + rContour.prelim - (lSumMods + lContour.prelim) + rContour.xSize / 2 + lContour.xSize / 2 + rContour.spacing(lContour);
    if (dist > 0 || dist < 0 && isFirst) {
      lSumMods += dist;
      moveSubtree(curSubtree, dist);
      distributeExtra(w, i, lows.index, dist);
    }
    isFirst = false;
    const rightBottom = rContour.bottom;
    const leftBottom = lContour.bottom;
    if (rightBottom <= leftBottom) {
      rContour = nextRContour(rContour);
      if (rContour) rSumMods += rContour.relX;
    }
    if (rightBottom >= leftBottom) {
      lContour = nextLContour(lContour);
      if (lContour) lSumMods += lContour.relX;
    }
  }
  if (!rContour && lContour) setLThr(w, i, lContour, lSumMods);
  else if (rContour && !lContour) setRThr(w, i, rContour, rSumMods);
};
var moveSubtree = (subtree, distance) => {
  subtree.relX += distance;
  subtree.lExtRelX += distance;
  subtree.rExtRelX += distance;
};
var distributeExtra = (w, curSubtreeI, leftSibI, dist) => {
  const curSubtree = w.children[curSubtreeI];
  const n = curSubtreeI - leftSibI;
  if (n > 1) {
    const delta = dist / n;
    w.children[leftSibI + 1].shift += delta;
    curSubtree.shift -= delta;
    curSubtree.change -= dist - delta;
  }
};
var nextLContour = (w) => {
  return w.hasChildren ? w.firstChild : w.lThr;
};
var nextRContour = (w) => {
  return w.hasChildren ? w.lastChild : w.rThr;
};
var setLThr = (w, i, lContour, lSumMods) => {
  const firstChild = w.firstChild;
  const lExt = firstChild.lExt;
  const curSubtree = w.children[i];
  lExt.lThr = lContour;
  const diff = lSumMods - lContour.relX - firstChild.lExtRelX;
  lExt.relX += diff;
  lExt.prelim -= diff;
  firstChild.lExt = curSubtree.lExt;
  firstChild.lExtRelX = curSubtree.lExtRelX;
};
var setRThr = (w, i, rContour, rSumMods) => {
  const curSubtree = w.children[i];
  const rExt = curSubtree.rExt;
  const lSib = w.children[i - 1];
  rExt.rThr = rContour;
  const diff = rSumMods - rContour.relX - curSubtree.rExtRelX;
  rExt.relX += diff;
  rExt.prelim -= diff;
  curSubtree.rExt = lSib.rExt;
  curSubtree.rExtRelX = lSib.rExtRelX;
};
var positionRoot = (w) => {
  if (w.hasChildren) {
    const k0 = w.firstChild;
    const kf = w.lastChild;
    const prelim = (k0.prelim + k0.relX - k0.xSize / 2 + kf.relX + kf.prelim + kf.xSize / 2) / 2;
    Object.assign(w, {
      prelim,
      lExt: k0.lExt,
      lExtRelX: k0.lExtRelX,
      rExt: kf.rExt,
      rExtRelX: kf.rExtRelX
    });
  }
};
var updateLows = (lowY, index, lastLows) => {
  while (lastLows !== null && lowY >= lastLows.lowY)
    lastLows = lastLows.next;
  return {
    lowY,
    index,
    next: lastLows
  };
};

// extensions/scripts/mindmap-vendor/node_modules/@markmap/render/dist/index.js
var SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/|[^:/?#]*(?:[/?#]|$))/i;
function sanitizeUrl(url) {
  const trimmed = url.trim();
  return SAFE_URL.test(trimmed) ? trimmed : void 0;
}
var basicContent = {
  name: "basic",
  transform(content, node) {
    const { checked } = node.data;
    if (typeof checked !== "boolean") return content;
    return [{
      type: "checkbox",
      checked
    }, ...content];
  },
  styles: {
    strong: () => ({ font: { weight: 700 } }),
    emphasis: () => ({ font: { style: "italic" } }),
    delete: (_inline, style2) => ({ decoration: { strike: style2.fill } }),
    mark: () => ({ decoration: {
      background: "var(--mm-mark-bg)",
      radius: 2
    } }),
    inlineCode: (_inline, style2, ctx) => ({
      font: {
        family: ctx.theme.codeFontFamily,
        size: style2.font.size * 0.875,
        weight: 400,
        style: "normal"
      },
      fill: "var(--mm-code-text)",
      decoration: {
        background: "var(--mm-code-bg)",
        radius: 3,
        padding: style2.font.size * 0.2
      }
    }),
    link: (inline) => {
      const href = sanitizeUrl(inline.url);
      return {
        fill: "var(--mm-link)",
        decoration: href ? { href } : void 0
      };
    }
  },
  atoms: { checkbox: {
    measure(_inline, style2) {
      const size = Math.round(style2.font.size * 0.8);
      return {
        width: size + style2.font.size * 0.35,
        height: size,
        baseline: size
      };
    },
    render(inline, box, style2) {
      const size = box.height;
      const stroke = Math.max(1, style2.font.size / 12);
      const frame2 = {
        kind: "rect",
        x: box.x + stroke / 2,
        y: box.y + stroke / 2,
        w: size - stroke,
        h: size - stroke,
        r: size * 0.2,
        stroke: "var(--mm-checkbox)",
        strokeWidth: stroke,
        fill: inline.checked ? "var(--mm-checkbox)" : "none"
      };
      if (!inline.checked) return [frame2];
      const [x, y] = [box.x, box.y];
      return [frame2, {
        kind: "path",
        d: `M${x + size * 0.25},${y + size * 0.52}L${x + size * 0.43},${y + size * 0.7}L${x + size * 0.76},${y + size * 0.32}`,
        stroke: "var(--mm-bg)",
        strokeWidth: stroke * 1.5
      }];
    }
  } }
};
var noteContent = {
  name: "notes",
  transform(content, node) {
    const count2 = node.notes.length;
    if (!count2) return content;
    return [...content, {
      type: "noteMarker",
      count: count2
    }];
  },
  atoms: { noteMarker: {
    measure(_inline, style2) {
      const dot = Math.round(style2.font.size * 0.4);
      return {
        width: style2.font.size * 0.35 + dot,
        height: dot,
        baseline: dot / 2 + style2.font.size * 0.27
      };
    },
    render(_inline, box) {
      const dot = box.height;
      const x = box.x + box.width - dot;
      const hit = Math.max(16, dot * 2.5);
      return [{
        kind: "rect",
        x,
        y: box.y,
        w: dot,
        h: dot,
        r: dot / 2,
        fill: "var(--mm-note-dot)"
      }, {
        kind: "hit",
        action: "notes",
        rect: {
          x: x + dot / 2 - hit / 2,
          y: box.y + dot / 2 - hit / 2,
          width: hit,
          height: hit
        }
      }];
    }
  } }
};
var PLACEHOLDER = {
  width: 40,
  height: 30
};
var DEFAULT_MAX_WIDTH = 320;
var DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
function sanitizeImageUrl(url) {
  const trimmed = url.trim();
  return DATA_IMAGE.test(trimmed) ? trimmed : sanitizeUrl(trimmed);
}
function browserLoader() {
  if (typeof Image === "undefined") return void 0;
  return (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve({
      width: img.naturalWidth,
      height: img.naturalHeight
    }));
    img.addEventListener("error", () => reject(/* @__PURE__ */ new Error(`Could not load ${src}`)));
    img.src = src;
  });
}
function fit(given, natural) {
  const { width, height } = given;
  if (width && height) return {
    width,
    height
  };
  if (!natural?.width || !natural.height) return void 0;
  const ratio = natural.width / natural.height;
  if (width) return {
    width,
    height: width / ratio
  };
  if (height) return {
    width: height * ratio,
    height
  };
  return natural;
}
var guess = ({ width, height }) => width || height ? {
  width: width ?? height,
  height: height ?? width
} : PLACEHOLDER;
function altSize(alt, style2, ctx) {
  const { font } = style2;
  return {
    width: ctx.measurer.measure(alt, font),
    height: font.lineHeight,
    baseline: (font.lineHeight + font.size * 0.7) / 2
  };
}
function altText(alt, box, style2, ctx) {
  if (!alt) return [];
  const { baseline } = altSize(alt, style2, ctx);
  const run = {
    text: alt,
    x: 0,
    y: baseline,
    font: style2.font,
    fill: style2.fill
  };
  return [{
    kind: "text",
    x: box.x,
    y: box.y,
    runs: [run]
  }];
}
function createImageContent(options = {}) {
  const loadSize = options.loadSize ?? browserLoader();
  const allow = options.allow ?? (() => true);
  const sizes = /* @__PURE__ */ new Map();
  const loading = /* @__PURE__ */ new Map();
  const load = (src, ctx) => {
    if (!loadSize || sizes.has(src)) return;
    let task = loading.get(src);
    if (!task) {
      task = loadSize(src).then((size) => sizes.set(src, size), () => sizes.set(src, null)).finally(() => loading.delete(src));
      loading.set(src, task);
    }
    ctx.defer?.(task);
  };
  const imageSize = (inline, ctx) => {
    const src = sanitizeImageUrl(inline.url);
    if (!src || !allow(src)) return void 0;
    const given = inline.data ?? {};
    const natural = sizes.get(src);
    let size = fit(given, natural ?? void 0);
    if (!size) {
      if (natural === null) return void 0;
      load(src, ctx);
      size = guess(given);
    }
    const max = ctx.wrapWidth && ctx.wrapWidth > 0 ? ctx.wrapWidth : options.maxWidth ?? DEFAULT_MAX_WIDTH;
    return size.width > max ? {
      width: max,
      height: size.height * max / size.width
    } : size;
  };
  return {
    name: "images",
    atoms: { image: {
      measure(inline, style2, ctx) {
        const size = imageSize(inline, ctx);
        return size ? {
          ...size,
          baseline: size.height
        } : altSize(inline.alt ?? "", style2, ctx);
      },
      render(inline, box, style2, ctx) {
        const src = imageSize(inline, ctx) && sanitizeImageUrl(inline.url);
        const alt = altText(inline.alt, box, style2, ctx);
        if (!src) return alt;
        const { x, y, width: w, height: h } = box;
        const image = {
          kind: "image",
          x,
          y,
          w,
          h,
          src
        };
        if (alt.length) image.fallback = [{
          kind: "group",
          clip: box,
          children: alt
        }];
        return [image];
      }
    } }
  };
}
var imageContent = createImageContent();
var defaultContentPlugins = [
  basicContent,
  imageContent,
  noteContent
];
function visibleNodes(root2, folded) {
  const result = [];
  const visit = (node) => {
    result.push(node);
    if (!folded?.has(node.id)) node.children.forEach(visit);
  };
  visit(root2);
  return result;
}
function layoutTree(root2, options) {
  const { sizes, folded, levelGap = 80, siblingGap = 5 } = options;
  const sizeOf = (node) => {
    const size = sizes.get(node.id);
    if (!size) throw new Error(`Missing size for node ${node.id}`);
    return size;
  };
  const layout = flextree({
    children: (node) => folded?.has(node.id) ? void 0 : node.children,
    nodeSize: (h) => {
      const { width, height } = sizeOf(h.data);
      return [height, width + levelGap];
    },
    spacing: (a, b) => a.parent === b.parent ? siblingGap : siblingGap * 2
  });
  const tree = layout.hierarchy(root2);
  layout(tree);
  const nodes = [];
  const byId = /* @__PURE__ */ new Map();
  const convert = (h, parent) => {
    const { width, height } = sizeOf(h.data);
    const item = {
      node: h.data,
      parent,
      children: [],
      depth: h.depth,
      folded: !!folded?.has(h.data.id) && h.data.children.length > 0,
      rect: {
        x: h.y,
        y: h.x - height / 2,
        width,
        height
      },
      direction: "right"
    };
    nodes.push(item);
    byId.set(item.node.id, item);
    for (const child of h.children ?? []) item.children.push(convert(child, item));
    return item;
  };
  convert(tree);
  return {
    nodes,
    byId,
    bounds: unionRects(nodes.map((n) => n.rect))
  };
}
var treeLayout = {
  name: "tree",
  layout: layoutTree
};
function leafCount(node) {
  return node.children.length ? node.children.reduce((sum, c) => sum + leafCount(c), 0) : 1;
}
function splitBranches(children2) {
  const weights = children2.map(leafCount);
  const total = weights.reduce((a, b) => a + b, 0);
  let best = children2.length;
  let bestDiff = Infinity;
  let right = 0;
  for (let k = 1; k <= children2.length; k++) {
    right += weights[k - 1];
    const diff = Math.abs(right - (total - right));
    if (diff <= bestDiff) {
      best = k;
      bestDiff = diff;
    }
  }
  return best;
}
function layoutTwoSided(root2, options) {
  if (options.folded?.has(root2.id) || root2.children.length < 2) return layoutTree(root2, options);
  const split = splitBranches(root2.children);
  const side = (children2) => layoutTree({
    ...root2,
    children: children2
  }, options);
  const right = side(root2.children.slice(0, split));
  const left = side(root2.children.slice(split));
  const rootRect = right.nodes[0].rect;
  const place = /* @__PURE__ */ new Map();
  for (const item of right.nodes) place.set(item.node.id, {
    rect: item.rect,
    direction: "right"
  });
  for (const item of left.nodes.slice(1)) {
    const { rect } = item;
    const x = rootRect.x * 2 + rootRect.width - rect.x - rect.width;
    place.set(item.node.id, {
      rect: {
        ...rect,
        x
      },
      direction: "left"
    });
  }
  const nodes = [];
  const byId = /* @__PURE__ */ new Map();
  const visit = (node, depth, parent) => {
    const { rect, direction } = place.get(node.id);
    const folded = !!options.folded?.has(node.id) && node.children.length > 0;
    const item = {
      node,
      parent,
      children: [],
      depth,
      folded,
      rect,
      direction
    };
    nodes.push(item);
    byId.set(node.id, item);
    if (!folded) for (const child of node.children) item.children.push(visit(child, depth + 1, item));
    return item;
  };
  visit(root2, 0);
  return {
    nodes,
    byId,
    bounds: unionRects(nodes.map((n) => n.rect))
  };
}
var twoSidedLayout = {
  name: "two-sided",
  layout: layoutTwoSided
};
var SIBLING_GAP_FACTOR = 3;
function layoutOrgChart(root2, options) {
  const { sizes, folded, levelGap = 80, siblingGap = 5 } = options;
  const scaledGap = siblingGap * SIBLING_GAP_FACTOR;
  const sizeOf = (node) => {
    const size = sizes.get(node.id);
    if (!size) throw new Error(`Missing size for node ${node.id}`);
    return size;
  };
  const layout = flextree({
    children: (node) => folded?.has(node.id) ? void 0 : node.children,
    nodeSize: (h) => {
      const { width, height } = sizeOf(h.data);
      return [width, height + levelGap];
    },
    spacing: (a, b) => a.parent === b.parent ? scaledGap : scaledGap * 2
  });
  const tree = layout.hierarchy(root2);
  layout(tree);
  const nodes = [];
  const byId = /* @__PURE__ */ new Map();
  const convert = (h, parent) => {
    const { width, height } = sizeOf(h.data);
    const item = {
      node: h.data,
      parent,
      children: [],
      depth: h.depth,
      folded: !!folded?.has(h.data.id) && h.data.children.length > 0,
      rect: {
        x: h.x - width / 2,
        y: h.y,
        width,
        height
      },
      direction: "bottom"
    };
    nodes.push(item);
    byId.set(item.node.id, item);
    for (const child of h.children ?? []) item.children.push(convert(child, item));
    return item;
  };
  convert(tree);
  return {
    nodes,
    byId,
    bounds: unionRects(nodes.map((n) => n.rect))
  };
}
var orgChartLayout = {
  name: "org-chart",
  layout: layoutOrgChart
};
function fontToCss(font) {
  return `${font.style} ${font.weight} ${font.size}px ${font.family}`;
}
function createCanvasMeasurer(ctx) {
  const context = ctx ?? createContext();
  const cache = /* @__PURE__ */ new Map();
  return { measure(text, font) {
    const css = fontToCss(font);
    const key = `${css}
${text}`;
    let width = cache.get(key);
    if (width == null) {
      if (context.font !== css) context.font = css;
      width = context.measureText(text).width;
      cache.set(key, width);
    }
    return width;
  } };
}
function createContext() {
  const context = (typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1)).getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  return context;
}
function branchIndex(path, count2, colorDepth = 0) {
  const id2 = colorDepth > 0 && path.length > colorDepth ? path[colorDepth - 1] : path.at(-1);
  return Number.parseInt(hashString(id2), 36) % Math.max(1, count2);
}
var DEFAULT_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf"
];
function branchColors(options) {
  const colors = options.color?.length ? options.color : DEFAULT_COLORS;
  const colorDepth = options.colorDepth ?? 0;
  return {
    tokens: Object.fromEntries(colors.map((color2, i) => [`mm-branch-${i}`, color2])),
    colorOf: (path) => `var(--mm-branch-${branchIndex(path, colors.length, colorDepth)})`
  };
}
var CONTENT_TOKENS = {
  "mm-link": "#0097e6",
  "mm-code-bg": "#f0f0f0",
  "mm-code-text": "#555",
  "mm-mark-bg": "#ffeaa7",
  "mm-checkbox": "#555",
  "mm-note-dot": "#999",
  "mm-syntax-keyword": "#cf222e",
  "mm-syntax-string": "#0a3069",
  "mm-syntax-comment": "#6e7781",
  "mm-syntax-number": "#0550ae",
  "mm-syntax-title": "#8250df",
  "mm-syntax-attr": "#116329"
};
var DARK_CONTENT_TOKENS = {
  "mm-link": "#4fb3f6",
  "mm-code-bg": "#2f2f33",
  "mm-code-text": "#d4d4d4",
  "mm-mark-bg": "#6b5a1e",
  "mm-checkbox": "#bbb",
  "mm-note-dot": "#888",
  "mm-syntax-keyword": "#ff7b72",
  "mm-syntax-string": "#a5d6ff",
  "mm-syntax-comment": "#8b949e",
  "mm-syntax-number": "#79c0ff",
  "mm-syntax-title": "#d2a8ff",
  "mm-syntax-attr": "#7ee787"
};
var SYSTEM_FONT = {
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  size: 16,
  weight: 400,
  style: "normal",
  lineHeight: 20
};
var CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
function alignFor(direction) {
  if (direction === "left") return "end";
  if (direction === "right") return "start";
  return "center";
}
function sCurve(from, to) {
  const vertical = from.side === "top" || from.side === "bottom";
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const controls = vertical ? `${from.x},${my},${to.x},${my}` : `${mx},${from.y},${mx},${to.y}`;
  return `M${from.x},${from.y}C${controls},${to.x},${to.y}`;
}
function sidePoint(width, height, side, gap = 0) {
  if (side === "left") return {
    x: -gap,
    y: height / 2
  };
  if (side === "right") return {
    x: width + gap,
    y: height / 2
  };
  if (side === "top") return {
    x: width / 2,
    y: -gap
  };
  return {
    x: width / 2,
    y: height + gap
  };
}
var RADIUS = 8;
var TOGGLE_RADIUS = 5;
function createCardsTheme(options = {}) {
  const { tokens: branchTokens, colorOf } = branchColors(options);
  return {
    name: "cards",
    options: {
      color: validators.colors(),
      colorDepth: validators.number(0, true)
    },
    configure: (next) => createCardsTheme({
      ...options,
      ...next
    }),
    tokens: {
      "mm-text": "#222",
      "mm-bg": "#f6f7f9",
      "mm-card-bg": "#fff",
      ...CONTENT_TOKENS,
      ...branchTokens
    },
    darkTokens: {
      "mm-text": "#e6e6e6",
      "mm-bg": "#17181b",
      "mm-card-bg": "#25262b",
      ...DARK_CONTENT_TOKENS
    },
    font: SYSTEM_FONT,
    codeFontFamily: CODE_FONT,
    textFill: "var(--mm-text)",
    node: {
      padding: [
        6,
        12,
        6,
        12
      ],
      minHeight: 32,
      textAlign: (ctx) => alignFor(ctx.direction),
      presence: (presence, box) => ({
        opacity: presence,
        transform: scaleAround(0.6 + 0.4 * presence, box.width / 2, box.height / 2)
      }),
      render(_node, box, ctx) {
        const color2 = colorOf(ctx.path);
        const card = {
          kind: "rect",
          x: 0,
          y: 0,
          w: box.width,
          h: box.height,
          r: RADIUS,
          fill: "var(--mm-card-bg)",
          stroke: color2,
          strokeWidth: ctx.depth === 0 ? 2.5 : 1.5
        };
        if (!ctx.hasChildren) return [card];
        const at = sidePoint(box.width, box.height, ctx.direction);
        return [card, {
          kind: "rect",
          x: at.x - TOGGLE_RADIUS,
          y: at.y - TOGGLE_RADIUS,
          w: 10,
          h: 10,
          r: TOGGLE_RADIUS,
          fill: ctx.folded ? color2 : "var(--mm-card-bg)",
          stroke: color2,
          strokeWidth: 1.5
        }];
      },
      anchor(rect, side) {
        const at = sidePoint(rect.width, rect.height, side);
        return {
          x: rect.x + at.x,
          y: rect.y + at.y,
          side
        };
      }
    },
    edge: { render: (from, to, ctx) => [{
      kind: "path",
      d: sCurve(from, to),
      stroke: colorOf(ctx.node.path),
      strokeWidth: 1.5
    }] }
  };
}
var cardsTheme = createCardsTheme();
var CIRCLE_RADIUS = 6;
var TOP_GAP = 4;
var lineWidth = (depth) => 1 + 3 / 2 ** depth;
function createClassicTheme(options = {}) {
  const { tokens: branchTokens, colorOf } = branchColors(options);
  return {
    name: "classic",
    options: {
      color: validators.colors(),
      colorDepth: validators.number(0, true)
    },
    configure: (next) => createClassicTheme({
      ...options,
      ...next
    }),
    tokens: {
      "mm-text": "#333",
      "mm-bg": "#fff",
      "mm-toggle-bg": "#fff",
      ...CONTENT_TOKENS,
      ...branchTokens
    },
    darkTokens: {
      "mm-text": "#ddd",
      "mm-bg": "#1e1e1e",
      "mm-toggle-bg": "#1e1e1e",
      ...DARK_CONTENT_TOKENS
    },
    font: SYSTEM_FONT,
    codeFontFamily: CODE_FONT,
    textFill: "var(--mm-text)",
    node: {
      padding: [
        0,
        8,
        0,
        8
      ],
      minHeight: 16,
      textAlign: (ctx) => alignFor(ctx.direction),
      render(_node, box, ctx) {
        const color2 = colorOf(ctx.path);
        const width = lineWidth(ctx.depth);
        const y = box.height + width / 2;
        const cx = {
          left: 0,
          right: box.width,
          top: box.width / 2,
          bottom: box.width / 2
        }[ctx.direction];
        const chrome = [{
          kind: "path",
          d: `M0,${y}H${box.width}`,
          stroke: color2,
          strokeWidth: width
        }];
        if (!ctx.hasChildren) return chrome;
        return [...chrome, {
          kind: "rect",
          x: cx - CIRCLE_RADIUS,
          y: y - CIRCLE_RADIUS,
          w: 12,
          h: 12,
          r: CIRCLE_RADIUS,
          fill: ctx.folded ? color2 : "var(--mm-toggle-bg)",
          stroke: color2,
          strokeWidth: 1.5
        }];
      },
      anchor(rect, side, ctx) {
        const y = rect.y + rect.height + lineWidth(ctx.depth) / 2;
        if (side === "left") return {
          x: rect.x,
          y,
          side
        };
        if (side === "right") return {
          x: rect.x + rect.width,
          y,
          side
        };
        return {
          x: rect.x + rect.width / 2,
          y: side === "top" ? rect.y - TOP_GAP : y,
          side
        };
      }
    },
    edge: { render: (from, to, ctx) => [{
      kind: "path",
      d: sCurve(from, to),
      stroke: colorOf(ctx.node.path),
      strokeWidth: lineWidth(ctx.node.depth)
    }] }
  };
}
var classicTheme = createClassicTheme();
var GAP = 6;
var DOT_RADIUS = 3.5;
var minimalTheme = {
  name: "minimal",
  tokens: {
    "mm-text": "#333",
    "mm-bg": "#fff",
    "mm-edge": "#c4c4c4",
    ...CONTENT_TOKENS
  },
  darkTokens: {
    "mm-text": "#ddd",
    "mm-bg": "#1e1e1e",
    "mm-edge": "#555",
    ...DARK_CONTENT_TOKENS
  },
  font: SYSTEM_FONT,
  codeFontFamily: CODE_FONT,
  textFill: "var(--mm-text)",
  node: {
    padding: [
      2,
      4,
      2,
      4
    ],
    textAlign: (ctx) => alignFor(ctx.direction),
    render(_node, box, ctx) {
      if (!ctx.hasChildren) return [];
      const at = sidePoint(box.width, box.height, ctx.direction, GAP);
      return [{
        kind: "rect",
        x: at.x - DOT_RADIUS,
        y: at.y - DOT_RADIUS,
        w: DOT_RADIUS * 2,
        h: DOT_RADIUS * 2,
        r: DOT_RADIUS,
        fill: ctx.folded ? "var(--mm-edge)" : "var(--mm-bg)",
        stroke: "var(--mm-edge)",
        strokeWidth: 1.5
      }];
    },
    anchor(rect, side) {
      const at = sidePoint(rect.width, rect.height, side, GAP);
      return {
        x: rect.x + at.x,
        y: rect.y + at.y,
        side
      };
    }
  },
  edge: { render: (from, to) => [{
    kind: "path",
    d: sCurve(from, to),
    stroke: "var(--mm-edge)",
    strokeWidth: 1
  }] }
};
var builtinLayouts = Object.freeze({
  [treeLayout.name]: treeLayout,
  [twoSidedLayout.name]: twoSidedLayout,
  [orgChartLayout.name]: orgChartLayout
});
var builtinThemes = Object.freeze({
  [classicTheme.name]: classicTheme,
  [cardsTheme.name]: cardsTheme,
  [minimalTheme.name]: minimalTheme
});
function pick(kind, name, registry2, warnings) {
  if (name == null) return void 0;
  if (Object.hasOwn(registry2, name)) return registry2[name];
  const names = Object.keys(registry2).map((key) => `\`${key}\``);
  warnings.push(`Unknown ${kind} \`${name}\`; available: ${names.join(", ")}`);
}
function configureTheme(theme, input) {
  if (!theme.options) return {
    theme,
    rest: input,
    warnings: []
  };
  const { options, rest, warnings } = validateOptions(input, theme.options);
  return {
    theme: Object.keys(options).length && theme.configure ? theme.configure(options) : theme,
    rest,
    warnings
  };
}
var RENDER_KEYS = [
  "wrapWidth",
  "levelGap",
  "siblingGap"
];
function resolveRenderOptions(base, input, { layouts = builtinLayouts, themes = builtinThemes } = {}) {
  const core = readJSONOptions(input);
  const result = { ...base };
  for (const key of RENDER_KEYS) if (core.options[key] != null) result[key] = core.options[key];
  const pickWarnings = [];
  const layout = pick("layout", core.options.layout, layouts, pickWarnings);
  if (layout) result.layout = layout;
  const themed = configureTheme(pick("theme", core.options.theme, themes, pickWarnings) ?? base.theme ?? classicTheme, core.rest);
  if (themed.theme !== (base.theme ?? classicTheme)) result.theme = themed.theme;
  return {
    options: result,
    json: core.options,
    warnings: [
      ...core.warnings,
      ...pickWarnings,
      ...themed.warnings,
      ...unknownOptionWarnings(themed.rest)
    ]
  };
}
function registry(plugins) {
  const styles = /* @__PURE__ */ new Map();
  const atoms = /* @__PURE__ */ new Map();
  for (const plugin of plugins) {
    for (const [type, fn] of Object.entries(plugin.styles ?? {})) styles.set(type, fn);
    for (const [type, fn] of Object.entries(plugin.atoms ?? {})) atoms.set(type, fn);
  }
  return {
    styles,
    atoms
  };
}
function transformContent(plugins, ctx) {
  let content = ctx.node.content;
  for (const plugin of plugins) if (plugin.transform) content = plugin.transform(content, ctx.node);
  return content;
}
function flatten(content, base, reg, ctx) {
  const items = [];
  const text = (value, style2, spans) => {
    if (value) items.push({
      kind: "text",
      text: value.replace(/\s*\n\s*/g, " "),
      style: style2,
      spans,
      width: 0
    });
  };
  const visit = (nodes, style2, spans) => {
    for (const node of nodes) {
      const atom = reg.atoms.get(node.type);
      if (atom) {
        const size = atom.measure(node, style2, ctx);
        items.push({
          kind: "atom",
          inline: node,
          renderer: atom,
          size,
          style: style2,
          spans,
          width: size.width
        });
        continue;
      }
      if (node.type === "break") {
        items.push({
          kind: "newline",
          style: style2,
          spans,
          width: 0
        });
        continue;
      }
      const styler = reg.styles.get(node.type);
      if (styler) {
        const result = styler(node, style2, ctx);
        const inner = {
          font: {
            ...style2.font,
            ...result.font
          },
          fill: result.fill ?? style2.fill
        };
        const span = result.decoration && {
          decoration: result.decoration,
          style: inner
        };
        const innerSpans = span ? [...spans, span] : spans;
        const padding = result.decoration?.padding ?? 0;
        if (padding) items.push({
          kind: "pad",
          style: inner,
          spans: innerSpans,
          width: padding
        });
        if ("value" in node) text(node.value, inner, innerSpans);
        else if ("children" in node) visit(node.children, inner, innerSpans);
        if (padding) items.push({
          kind: "pad",
          style: inner,
          spans: innerSpans,
          width: padding
        });
      } else if (node.type === "image") text(node.alt ?? "", style2, spans);
      else if ("value" in node) text(node.value, style2, spans);
      else if ("children" in node) visit(node.children, style2, spans);
    }
  };
  visit(content, base, []);
  return items;
}
var segmenter = new Intl.Segmenter(void 0, { granularity: "word" });
var graphemes = new Intl.Segmenter(void 0, { granularity: "grapheme" });
var CJK = /[⺀-鿿가-힣豈-﫿＀-￯]/u;
var NO_BREAK_BEFORE = /^[\p{Pe}\p{Pf}\p{Po}、。，！？]/u;
function toUnits(items, ctx) {
  const units = [];
  let current;
  let prevSpace = true;
  let prevText = "";
  const start2 = (space) => {
    current = {
      items: [],
      width: 0,
      space,
      newline: false
    };
    units.push(current);
    return current;
  };
  for (const item of items) {
    if (item.kind === "newline") {
      units.push({
        items: [],
        width: 0,
        space: false,
        newline: true
      });
      current = void 0;
      prevSpace = true;
      continue;
    }
    if (item.kind === "atom") {
      start2(false).items.push(item);
      current.width = item.width;
      current = void 0;
      prevSpace = true;
      continue;
    }
    if (item.kind === "pad") {
      const unit = !current || current.space || prevSpace ? start2(false) : current;
      unit.items.push(item);
      unit.width += item.width;
      prevSpace = false;
      continue;
    }
    for (const { segment } of segmenter.segment(item.text)) {
      const space = /^\s+$/.test(segment);
      const breakable = space || prevSpace || (CJK.test(segment[0]) || CJK.test(prevText.at(-1) ?? "")) && !NO_BREAK_BEFORE.test(segment);
      const value = space ? " " : segment;
      const unit = !current || breakable || current.space ? start2(space) : current;
      const width = ctx.measurer.measure(value, item.style.font);
      const last = unit.items.at(-1);
      if (last?.kind === "text" && last.style === item.style && last.spans === item.spans) {
        last.text += value;
        last.width += width;
      } else unit.items.push({
        ...item,
        text: value,
        width
      });
      unit.width += width;
      prevSpace = space;
      prevText = segment;
    }
  }
  return units;
}
function splitUnit(unit, ctx) {
  const result = [];
  for (const item of unit.items) {
    if (item.kind !== "text") {
      result.push({
        items: [item],
        width: item.width,
        space: false,
        newline: false
      });
      continue;
    }
    for (const { segment } of graphemes.segment(item.text)) {
      const width = ctx.measurer.measure(segment, item.style.font);
      result.push({
        items: [{
          ...item,
          text: segment,
          width
        }],
        width,
        space: false,
        newline: false
      });
    }
  }
  return result;
}
function breakLines(units, wrapWidth, ctx) {
  const lines = [[]];
  let lineWidth2 = 0;
  const push = (unit) => {
    const line = lines.at(-1);
    if (unit.newline) {
      lines.push([]);
      lineWidth2 = 0;
      return;
    }
    if (unit.space && !line.length) return;
    if (wrapWidth > 0 && !unit.space && line.length && lineWidth2 + unit.width > wrapWidth) {
      while (line.at(-1)?.space) lineWidth2 -= line.pop().width;
      lines.push([]);
      lineWidth2 = 0;
      if (unit.width > wrapWidth) return void splitUnit(unit, ctx).forEach(push);
    } else if (wrapWidth > 0 && !line.length && unit.width > wrapWidth) {
      const parts = splitUnit(unit, ctx);
      if (parts.length > 1) return void parts.forEach(push);
    }
    lines.at(-1).push(unit);
    lineWidth2 += unit.width;
  };
  units.forEach(push);
  for (const line of lines) while (line.at(-1)?.space) line.pop();
  return lines;
}
function layoutText(content, options) {
  const { style: style2, plugins, ctx } = options;
  const lines = breakLines(toUnits(flatten(content, style2, registry(plugins), ctx), ctx), options.wrapWidth ?? 0, ctx);
  const { font } = style2;
  const textAscent = (font.lineHeight + font.size * 0.7) / 2;
  const backgrounds = [];
  const overlays = [];
  const atoms = [];
  const links = [];
  const runs = [];
  const lineWidths = lines.map((line) => line.reduce((sum, unit) => sum + unit.items.reduce((w, item) => w + item.width, 0), 0));
  const width = Math.max(0, ...lineWidths);
  const alignFactor = {
    start: 0,
    center: 0.5,
    end: 1
  }[options.align ?? "start"];
  let top = 0;
  for (const [index, line] of lines.entries()) {
    const placed = [];
    let x = (width - lineWidths[index]) * alignFactor;
    for (const item of line.flatMap((unit) => unit.items)) {
      placed.push({
        item,
        x
      });
      x += item.width;
    }
    let ascent = textAscent;
    let descent = font.lineHeight - textAscent;
    for (const { item } of placed) {
      if (item.kind !== "atom") continue;
      ascent = Math.max(ascent, item.size.baseline);
      descent = Math.max(descent, item.size.height - item.size.baseline);
    }
    const baseline = top + ascent;
    const lineHeight = ascent + descent;
    for (const { item, x: itemX } of placed) if (item.kind === "text") {
      const last = runs.at(-1);
      if (last && last.y === baseline && last.font === item.style.font && last.fill === item.style.fill && last.x + (last.width ?? 0) === itemX) {
        last.text += item.text;
        last.width = (last.width ?? 0) + item.width;
      } else {
        const run = {
          text: item.text,
          x: itemX,
          y: baseline,
          font: item.style.font,
          fill: item.style.fill,
          width: item.width
        };
        runs.push(run);
      }
    } else if (item.kind === "atom") {
      const box = {
        x: itemX,
        y: baseline - item.size.baseline,
        width: item.size.width,
        height: item.size.height
      };
      atoms.push(...item.renderer.render(item.inline, box, item.style, ctx));
    }
    const extents = /* @__PURE__ */ new Map();
    for (const { item, x: itemX } of placed) for (const span of item.spans) {
      const extent = extents.get(span);
      if (extent) extent[1] = itemX + item.width;
      else extents.set(span, [itemX, itemX + item.width]);
    }
    for (const [span, [x0, x1]] of extents) {
      const { decoration: d, style: s } = span;
      if (d.background) backgrounds.push({
        kind: "rect",
        x: x0,
        y: baseline - s.font.size * 0.95,
        w: x1 - x0,
        h: s.font.size * 1.3,
        r: d.radius,
        fill: d.background
      });
      if (d.strike) {
        const y = baseline - s.font.size * 0.3;
        overlays.push({
          kind: "path",
          d: `M${x0},${y}H${x1}`,
          stroke: d.strike,
          strokeWidth: Math.max(1, s.font.size / 14)
        });
      }
      if (d.href) links.push({
        kind: "link",
        href: d.href,
        rect: {
          x: x0,
          y: top,
          width: x1 - x0,
          height: lineHeight
        }
      });
    }
    top += lineHeight;
  }
  return {
    primitives: [
      ...backgrounds,
      ...runs.length ? [{
        kind: "text",
        x: 0,
        y: 0,
        runs
      }] : [],
      ...overlays,
      ...atoms,
      ...links
    ],
    runs,
    width,
    height: top,
    lines: lines.length
  };
}
function nodePaths(root2) {
  const paths = /* @__PURE__ */ new Map();
  const visit = (node, parent) => {
    const path = [...parent, node.id];
    paths.set(node.id, path);
    for (const child of node.children) visit(child, path);
  };
  visit(root2, []);
  return paths;
}
function labelLayout(node, theme, options, align, defer) {
  const plugins = options.plugins ?? defaultContentPlugins;
  const ctx = {
    theme,
    measurer: options.measurer,
    node,
    wrapWidth: options.wrapWidth,
    defer
  };
  return layoutText(transformContent(plugins, ctx), {
    style: {
      font: theme.font,
      fill: theme.textFill
    },
    wrapWidth: options.wrapWidth,
    plugins,
    ctx,
    align
  });
}
function measureTree(root2, options, defer) {
  const theme = options.theme ?? classicTheme;
  const [top, right, bottom, left] = theme.node.padding;
  const result = /* @__PURE__ */ new Map();
  const paths = nodePaths(root2);
  for (const node of visibleNodes(root2, options.folded)) {
    const path = paths.get(node.id);
    const depth = path.length - 1;
    const text = labelLayout(node, theme, options, void 0, defer);
    const ctx = {
      depth,
      path,
      hasChildren: node.children.length > 0,
      folded: !!options.folded?.has(node.id)
    };
    const box = theme.node.measure ? theme.node.measure(text, node, ctx) : {
      width: text.width + left + right,
      height: Math.max(text.height + top + bottom, theme.node.minHeight ?? 0)
    };
    result.set(node.id, {
      text,
      box
    });
  }
  return result;
}
function renderTree(root2, options) {
  const theme = options.theme ?? classicTheme;
  const tasks = [];
  const measured = measureTree(root2, options, (task) => tasks.push(task));
  const paths = nodePaths(root2);
  const contexts = /* @__PURE__ */ new Map();
  const contextOf = (item) => {
    let ctx = contexts.get(item.node.id);
    if (!ctx) {
      ctx = {
        depth: item.depth,
        path: paths.get(item.node.id),
        hasChildren: item.node.children.length > 0,
        folded: item.folded,
        direction: item.direction
      };
      contexts.set(item.node.id, ctx);
    }
    return ctx;
  };
  const layout = (options.layout ?? treeLayout).layout(root2, {
    sizes: new Map([...measured].map(([id2, { box }]) => [id2, box])),
    folded: options.folded,
    levelGap: options.levelGap,
    siblingGap: options.siblingGap
  });
  const state = { nodes: layout.nodes.map((item) => {
    const ctx = contextOf(item);
    let { text } = measured.get(item.node.id);
    const align = theme.node.textAlign?.(ctx) ?? "start";
    if (align !== "start" && text.lines > 1) text = labelLayout(item.node, theme, options, align);
    return {
      node: item.node,
      parentId: item.parent?.node.id,
      rect: item.rect,
      ctx,
      text,
      presence: 1
    };
  }) };
  const primitives = drawState(state, theme);
  const bounds = unionRects([layout.bounds, primitiveBounds(primitives)]);
  const pending = tasks.length ? Promise.allSettled(tasks).then(() => void 0) : void 0;
  return {
    theme,
    layout,
    primitives,
    bounds,
    contexts,
    state,
    ...pending && { pending }
  };
}
function drawState(state, theme) {
  const byId = new Map(state.nodes.map((item) => [item.node.id, item]));
  const looks = /* @__PURE__ */ new Map();
  const lookOf = (item) => {
    if (item.presence >= 1) return {};
    let look = looks.get(item.node.id);
    if (!look) {
      const box = {
        width: item.rect.width,
        height: item.rect.height
      };
      look = theme.node.presence?.(item.presence, box, item.ctx) ?? { opacity: item.presence };
      looks.set(item.node.id, look);
    }
    return look;
  };
  const edges = [];
  for (const target of state.nodes) {
    const source = target.parentId ? byId.get(target.parentId) : void 0;
    if (!source) continue;
    const from = theme.node.anchor(source.rect, target.ctx.direction, source.ctx);
    const to = theme.node.anchor(target.rect, oppositeSide(target.ctx.direction), target.ctx);
    edges.push({
      kind: "group",
      key: `edge:${target.node.id}`,
      nodeId: target.node.id,
      bounds: edgeBounds(from, to),
      ...opacityOf(lookOf(target)),
      children: theme.edge.render(from, to, {
        source: source.node,
        target: target.node,
        node: target.ctx
      })
    });
  }
  const [top, , , left] = theme.node.padding;
  const nodes = state.nodes.map((item) => ({
    kind: "group",
    key: `node:${item.node.id}`,
    nodeId: item.node.id,
    bounds: expandRect(item.rect, BOUNDS_MARGIN),
    transform: lookOf(item).transform ? multiply(translate(item.rect.x, item.rect.y), lookOf(item).transform) : translate(item.rect.x, item.rect.y),
    ...opacityOf(lookOf(item)),
    children: [...theme.node.render(item.node, {
      width: item.rect.width,
      height: item.rect.height
    }, item.ctx), {
      kind: "group",
      transform: translate(left, top),
      children: item.text.primitives
    }]
  }));
  return [...edges, ...nodes];
}
var BOUNDS_MARGIN = 24;
var edgeBounds = (a, b) => expandRect({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y)
}, BOUNDS_MARGIN);
var opacityOf = ({ opacity }) => opacity != null && opacity < 1 ? { opacity: Math.max(0, opacity) } : {};
function pathPoints(d) {
  const points = [];
  let [x, y] = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MLHVC])([^MLHVC]*)/g)) {
    const values = args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
    if (cmd === "H") for (const v of values) points.push([x = v, y]);
    else if (cmd === "V") for (const v of values) points.push([x, y = v]);
    else for (let i = 0; i + 1 < values.length; i += 2) points.push([x = values[i], y = values[i + 1]]);
  }
  return points;
}
function primitiveBounds(primitives) {
  const rects = [];
  const addPoint = ([a, b, c, d, e, f], x, y, size) => {
    const s = size * Math.max(Math.hypot(a, b), Math.hypot(c, d));
    rects.push({
      x: a * x + c * y + e - s,
      y: b * x + d * y + f - s,
      width: 2 * s,
      height: 2 * s
    });
  };
  const addBox = (matrix, { x, y, width, height }, size) => {
    addPoint(matrix, x, y, size);
    addPoint(matrix, x + width, y, size);
    addPoint(matrix, x, y + height, size);
    addPoint(matrix, x + width, y + height, size);
  };
  const visit = (items, outer) => {
    for (const p of items) if (p.kind === "group") {
      const matrix = p.transform ? multiply(outer, p.transform) : outer;
      if (p.clip) addBox(matrix, p.clip, 0);
      else visit(p.children, matrix);
    } else if (p.kind === "rect" || p.kind === "image") {
      const box = {
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h
      };
      addBox(outer, box, p.kind === "rect" ? strokeOf(p) : 0);
    } else if (p.kind === "path") {
      const s = strokeOf(p);
      for (const [x, y] of pathPoints(p.d)) addPoint(outer, x, y, s);
    }
  };
  visit(primitives, translate(0, 0));
  return unionRects(rects);
}
function strokeOf(p) {
  return p.stroke ? (p.strokeWidth ?? 1) / 2 : 0;
}
var ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}
var num = (value) => String(Math.round(value * 100) / 100);
function attrs(values) {
  let result = "";
  for (const [name, value] of Object.entries(values)) {
    if (value == null || value === "") continue;
    result += ` ${name}="${escapeXml(typeof value === "number" ? num(value) : value)}"`;
  }
  return result;
}
function style(values) {
  const parts = Object.entries(values).filter(([, value]) => value != null).map(([name, value]) => `${name}:${typeof value === "number" ? num(value) : value}`);
  return parts.length ? parts.join(";") : void 0;
}
function paint(p) {
  return style({
    fill: p.fill ?? "none",
    stroke: p.stroke,
    "stroke-width": p.stroke ? p.strokeWidth : void 0
  });
}
function runToSVG(run) {
  const { font } = run;
  return `<tspan${attrs({
    x: run.x,
    y: run.y,
    style: style({
      "font-family": font.family,
      "font-size": `${num(font.size)}px`,
      "font-weight": font.weight,
      "font-style": font.style === "italic" ? "italic" : void 0,
      fill: run.fill
    })
  })}>${escapeXml(run.text)}</tspan>`;
}
var markupCache = {
  plain: /* @__PURE__ */ new WeakMap(),
  interactive: /* @__PURE__ */ new WeakMap()
};
function primitivesToSVG(primitives, options = {}) {
  const cache = options.interactive ? markupCache.interactive : markupCache.plain;
  let out = cache.get(primitives);
  if (out == null) {
    out = serialize(primitives, options);
    cache.set(primitives, out);
  }
  return out;
}
function serialize(primitives, options) {
  let out = "";
  for (const p of primitives) {
    if (p.backends && !p.backends.includes("svg")) continue;
    switch (p.kind) {
      case "group": {
        const content = primitivesToSVG(p.children, options);
        out += `<g${attrs({
          transform: p.transform && `matrix(${p.transform.map(num).join(" ")})`,
          opacity: p.opacity,
          "data-node-id": p.nodeId
        })}>${p.clip ? clipped(content, p.clip) : content}</g>`;
        break;
      }
      case "rect":
        out += `<rect${attrs({
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          rx: p.r,
          style: paint(p)
        })}/>`;
        break;
      case "path":
        out += `<path${attrs({
          d: p.d,
          style: paint(p)
        })}/>`;
        break;
      case "text":
        out += `<text${attrs({
          transform: `translate(${num(p.x)} ${num(p.y)})`,
          "xml:space": "preserve"
        })}>${p.runs.map(runToSVG).join("")}</text>`;
        break;
      case "image":
        out += `<image${attrs({
          x: p.x,
          y: p.y,
          width: p.w,
          height: p.h,
          href: p.src
        })}/>`;
        break;
      case "link":
        out += `<a${attrs({
          href: p.href,
          target: "_blank"
        })}><rect${attrs({
          x: p.rect.x,
          y: p.rect.y,
          width: p.rect.width,
          height: p.rect.height,
          style: "fill:transparent"
        })}/></a>`;
        break;
      case "custom":
        out += p.svg?.() ?? "";
        break;
      case "hit":
        if (options.interactive) out += `<rect${attrs({
          x: p.rect.x,
          y: p.rect.y,
          width: p.rect.width,
          height: p.rect.height,
          "data-action": p.action,
          style: "fill:transparent;cursor:pointer"
        })}/>`;
    }
  }
  return out;
}
function clipped(content, { x, y, width, height }) {
  return `<svg${attrs({
    x,
    y,
    width,
    height,
    viewBox: [
      x,
      y,
      width,
      height
    ].map(num).join(" ")
  })}>${content}</svg>`;
}
function tokensToCSS(theme) {
  const tokens = isTheme(theme) ? theme.tokens : theme;
  return Object.entries(tokens).filter(([name, value]) => /^[\w-]+$/.test(name) && isSafeCSSValue(value)).map(([name, value]) => `--${name}:${value};`).join("");
}
var isTheme = (value) => typeof value.tokens === "object";
function themeCSS(theme, colorScheme = "light", selector2 = ".markmap") {
  const light = `${selector2}{${tokensToCSS(theme.tokens)}}`;
  if (!theme.darkTokens || colorScheme === "light") return light;
  const dark = `${selector2}{${tokensToCSS(theme.darkTokens)}}`;
  return colorScheme === "dark" ? light + dark : `${light}@media (prefers-color-scheme: dark){${dark}}`;
}
var easeCubicInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
var lerp = (a, b, t) => a + (b - a) * t;
var lerpRect = (a, b, t) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t)
});
function nearestAncestor(item, byId) {
  const { path } = item.ctx;
  for (let i = path.length - 2; i >= 0; i--) {
    const found = byId.get(path[i]);
    if (found) return found;
  }
}
function interpolateFrames(from, to, t, ctx) {
  const fromById = new Map(from.nodes.map((item) => [item.node.id, item]));
  const toById = new Map(to.nodes.map((item) => [item.node.id, item]));
  const collapsedInto = (item, ancestor) => {
    const side = item.ctx.direction;
    const point = ctx.anchor(ancestor, side);
    const offset = ctx.anchor({
      ...item,
      rect: {
        ...item.rect,
        x: 0,
        y: 0
      }
    }, oppositeSide(side));
    return {
      ...item.rect,
      x: point.x - offset.x,
      y: point.y - offset.y
    };
  };
  const nodes = to.nodes.map((item) => {
    const old = fromById.get(item.node.id);
    if (old) return {
      ...item,
      rect: lerpRect(old.rect, item.rect, t),
      presence: lerp(old.presence, item.presence, t)
    };
    const ancestor = nearestAncestor(item, fromById);
    const start2 = ancestor ? collapsedInto(item, ancestor) : item.rect;
    return {
      ...item,
      rect: lerpRect(start2, item.rect, t),
      presence: item.presence * t
    };
  });
  for (const item of from.nodes) {
    if (toById.has(item.node.id)) continue;
    const ancestor = nearestAncestor(item, toById);
    const end = ancestor ? collapsedInto(item, ancestor) : item.rect;
    nodes.push({
      ...item,
      rect: lerpRect(item.rect, end, t),
      presence: item.presence * (1 - t)
    });
  }
  return { nodes };
}
function interpolateStates(from, to, t, theme, layout) {
  return (layout?.interpolate ?? interpolateFrames)(from, to, t, { anchor: (item, side) => theme.node.anchor(item.rect, side, item.ctx) });
}

// extensions/scripts/mindmap-vendor/node_modules/d3-selection/dist/d3-selection.mjs
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function namespace(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces.hasOwnProperty(prefix) ? { space: namespaces[prefix], local: name } : name;
}
function creatorInherit(name) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator(name) {
  var fullname = namespace(name);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}
function none() {
}
function selector(selector2) {
  return selector2 == null ? none : function() {
    return this.querySelector(selector2);
  };
}
function selection_select(select2) {
  if (typeof select2 !== "function") select2 = selector(select2);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select2.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}
function array(x) {
  return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
}
function empty() {
  return [];
}
function selectorAll(selector2) {
  return selector2 == null ? empty : function() {
    return this.querySelectorAll(selector2);
  };
}
function arrayAll(select2) {
  return function() {
    return array(select2.apply(this, arguments));
  };
}
function selection_selectAll(select2) {
  if (typeof select2 === "function") select2 = arrayAll(select2);
  else select2 = selectorAll(select2);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select2.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}
function matcher(selector2) {
  return function() {
    return this.matches(selector2);
  };
}
function childMatcher(selector2) {
  return function(node) {
    return node.matches(selector2);
  };
}
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selection_selectChild(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selection_selectChildren(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}
function selection_filter(match) {
  if (typeof match !== "function") match = matcher(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}
function sparse(update) {
  return new Array(update.length);
}
function selection_enter() {
  return new Selection(this._enter || this._groups.map(sparse), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector2) {
    return this._parent.querySelector(selector2);
  },
  querySelectorAll: function(selector2) {
    return this._parent.querySelectorAll(selector2);
  }
};
function constant(x) {
  return function() {
    return x;
  };
}
function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0, node, groupLength = group.length, dataLength = data.length;
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}
function bindKey(parent, group, enter, update, exit, data, key) {
  var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
      exit[i] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function selection_data(value, key) {
  if (!arguments.length) return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
  if (typeof value !== "function") value = constant(value);
  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}
function selection_exit() {
  return new Selection(this._exit || this._groups.map(sparse), this._parents);
}
function selection_join(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove();
  else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}
function selection_merge(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Selection(merges, this._parents);
}
function selection_order() {
  for (var groups = this._groups, j = -1, m = groups.length; ++j < m; ) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0; ) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}
function selection_sort(compare) {
  if (!compare) compare = ascending;
  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }
  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}
function selection_call() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}
function selection_nodes() {
  return Array.from(this);
}
function selection_node() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }
  return null;
}
function selection_size() {
  let size = 0;
  for (const node of this) ++size;
  return size;
}
function selection_empty() {
  return !this.node();
}
function selection_each(callback) {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }
  return this;
}
function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}
function selection_attr(name, value) {
  var fullname = namespace(name);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}
function defaultView(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}
function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}
function styleFunction(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}
function selection_style(name, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
  return node.style.getPropertyValue(name) || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
}
function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}
function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}
function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}
function selection_property(name, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}
function classArray(string2) {
  return string2.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};
function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}
function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}
function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}
function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}
function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}
function selection_classed(name, value) {
  var names = classArray(name + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}
function selection_text(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}
function selection_html(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}
function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}
function selection_raise() {
  return this.each(raise);
}
function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function selection_lower() {
  return this.each(lower);
}
function selection_append(name) {
  var create2 = typeof name === "function" ? name : creator(name);
  return this.select(function() {
    return this.appendChild(create2.apply(this, arguments));
  });
}
function constantNull() {
  return null;
}
function selection_insert(name, before) {
  var create2 = typeof name === "function" ? name : creator(name), select2 = before == null ? constantNull : typeof before === "function" ? before : selector(before);
  return this.select(function() {
    return this.insertBefore(create2.apply(this, arguments), select2.apply(this, arguments) || null);
  });
}
function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}
function selection_remove() {
  return this.each(remove);
}
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_clone(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}
function selection_datum(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return { type: t, name };
  });
}
function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = { type: typename.type, name: typename.name, value, listener, options };
    if (!on) this.__on = [o];
    else on.push(o);
  };
}
function selection_on(typename, value, options) {
  var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;
  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }
  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}
function dispatchEvent(node, type, params) {
  var window2 = defaultView(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}
function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}
function selection_dispatch(type, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type, params));
}
function* selection_iterator() {
  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) yield node;
    }
  }
}
var root = [null];
function Selection(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: selection_select,
  selectAll: selection_selectAll,
  selectChild: selection_selectChild,
  selectChildren: selection_selectChildren,
  filter: selection_filter,
  data: selection_data,
  enter: selection_enter,
  exit: selection_exit,
  join: selection_join,
  merge: selection_merge,
  selection: selection_selection,
  order: selection_order,
  sort: selection_sort,
  call: selection_call,
  nodes: selection_nodes,
  node: selection_node,
  size: selection_size,
  empty: selection_empty,
  each: selection_each,
  attr: selection_attr,
  style: selection_style,
  property: selection_property,
  classed: selection_classed,
  text: selection_text,
  html: selection_html,
  raise: selection_raise,
  lower: selection_lower,
  append: selection_append,
  insert: selection_insert,
  remove: selection_remove,
  clone: selection_clone,
  datum: selection_datum,
  on: selection_on,
  dispatch: selection_dispatch,
  [Symbol.iterator]: selection_iterator
};
function select(selector2) {
  return typeof selector2 === "string" ? new Selection([[document.querySelector(selector2)]], [document.documentElement]) : new Selection([[selector2]], root);
}
var nextId = 0;
function local() {
  return new Local();
}
function Local() {
  this._ = "@" + (++nextId).toString(36);
}
Local.prototype = local.prototype = {
  constructor: Local,
  get: function(node) {
    var id2 = this._;
    while (!(id2 in node)) if (!(node = node.parentNode)) return;
    return node[id2];
  },
  set: function(node, value) {
    return node[this._] = value;
  },
  remove: function(node) {
    return this._ in node && delete node[this._];
  },
  toString: function() {
    return this._;
  }
};
function sourceEvent(event) {
  let sourceEvent2;
  while (sourceEvent2 = event.sourceEvent) event = sourceEvent2;
  return event;
}
function pointer(event, node) {
  event = sourceEvent(event);
  if (node === void 0) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// extensions/scripts/mindmap-vendor/node_modules/d3-dispatch/dist/d3-dispatch.mjs
var noop = { value: () => {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames2(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames2(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}
function set(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({ name, value: callback });
  return type;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-drag/dist/d3-drag.mjs
var nonpassivecapture = { capture: true, passive: false };
function noevent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}
function nodrag(view) {
  var root2 = view.document.documentElement, selection2 = select(view).on("dragstart.drag", noevent, nonpassivecapture);
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", noevent, nonpassivecapture);
  } else {
    root2.__noselect = root2.style.MozUserSelect;
    root2.style.MozUserSelect = "none";
  }
}
function yesdrag(view, noclick) {
  var root2 = view.document.documentElement, selection2 = select(view).on("dragstart.drag", null);
  if (noclick) {
    selection2.on("click.drag", noevent, nonpassivecapture);
    setTimeout(function() {
      selection2.on("click.drag", null);
    }, 0);
  }
  if ("onselectstart" in root2) {
    selection2.on("selectstart.drag", null);
  } else {
    root2.style.MozUserSelect = root2.__noselect;
    delete root2.__noselect;
  }
}
function DragEvent(type, {
  sourceEvent: sourceEvent2,
  subject,
  target,
  identifier,
  active,
  x,
  y,
  dx,
  dy,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent2, enumerable: true, configurable: true },
    subject: { value: subject, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    identifier: { value: identifier, enumerable: true, configurable: true },
    active: { value: active, enumerable: true, configurable: true },
    x: { value: x, enumerable: true, configurable: true },
    y: { value: y, enumerable: true, configurable: true },
    dx: { value: dx, enumerable: true, configurable: true },
    dy: { value: dy, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}
DragEvent.prototype.on = function() {
  var value = this._.on.apply(this._, arguments);
  return value === this._ ? this : value;
};

// extensions/scripts/mindmap-vendor/node_modules/d3-color/dist/d3-color.mjs
function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format) ? rgbn(named[format]) : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
  return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}
function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}
define(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}
function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, min = Math.min(r, g, b), max = Math.max(r, g, b), h = NaN, s = max - min, l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}
var radians = Math.PI / 180;
var degrees = 180 / Math.PI;
var K = 18;
var Xn = 0.96422;
var Yn = 1;
var Zn = 0.82521;
var t0 = 4 / 29;
var t1 = 6 / 29;
var t2 = 3 * t1 * t1;
var t3 = t1 * t1 * t1;
function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) return hcl2lab(o);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = rgb2lrgb(o.r), g = rgb2lrgb(o.g), b = rgb2lrgb(o.b), y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
  if (r === g && g === b) x = z = y;
  else {
    x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
    z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
  }
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}
function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}
function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}
define(Lab, lab, extend(Color, {
  brighter(k) {
    return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker(k) {
    return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb() {
    var y = (this.l + 16) / 116, x = isNaN(this.a) ? y : y + this.a / 500, z = isNaN(this.b) ? y : y - this.b / 200;
    x = Xn * lab2xyz(x);
    y = Yn * lab2xyz(y);
    z = Zn * lab2xyz(z);
    return new Rgb(
      lrgb2rgb(3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
      lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.033454 * z),
      lrgb2rgb(0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
      this.opacity
    );
  }
}));
function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
}
function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}
function lrgb2rgb(x) {
  return 255 * (x <= 31308e-7 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}
function rgb2lrgb(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);
  var h = Math.atan2(o.b, o.a) * degrees;
  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}
function hcl(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}
function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}
function hcl2lab(o) {
  if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
  var h = o.h * radians;
  return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
}
define(Hcl, hcl, extend(Color, {
  brighter(k) {
    return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
  },
  darker(k) {
    return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
  },
  rgb() {
    return hcl2lab(this).rgb();
  }
}));
var A = -0.14861;
var B = 1.78277;
var C = -0.29227;
var D = -0.90649;
var E = 1.97294;
var ED = E * D;
var EB = E * B;
var BC_DA = B * C - D * A;
function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB), bl = b - l, k = (E * (g - l) - C * bl) / D, s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), h = s ? Math.atan2(k, bl) * degrees - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}
function cubehelix(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}
function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define(Cubehelix, cubehelix, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * radians, l = +this.l, a = isNaN(this.s) ? 0 : this.s * l * (1 - l), cosh2 = Math.cos(h), sinh2 = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh2 + B * sinh2)),
      255 * (l + a * (C * cosh2 + D * sinh2)),
      255 * (l + a * (E * cosh2)),
      this.opacity
    );
  }
}));

// extensions/scripts/mindmap-vendor/node_modules/d3-interpolate/dist/d3-interpolate.mjs
function basis(t12, v0, v1, v2, v3) {
  var t22 = t12 * t12, t32 = t22 * t12;
  return ((1 - 3 * t12 + 3 * t22 - t32) * v0 + (4 - 6 * t22 + 3 * t32) * v1 + (1 + 3 * t12 + 3 * t22 - 3 * t32) * v2 + t32 * v3) / 6;
}
function basis$1(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}
function basisClosed(values) {
  var n = values.length;
  return function(t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}
var constant2 = (x) => () => x;
function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}
function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}
function hue$1(a, b) {
  var d = b - a;
  return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant2(isNaN(a) ? b : a);
}
function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant2(isNaN(a) ? b : a);
  };
}
function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant2(isNaN(a) ? b : a);
}
var rgb2 = (function rgbGamma(y) {
  var color2 = gamma(y);
  function rgb3(start2, end) {
    var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.r = r(t);
      start2.g = g(t);
      start2.b = b(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  }
  rgb3.gamma = rgbGamma;
  return rgb3;
})(1);
function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
    for (i = 0; i < n; ++i) {
      color2 = rgb(colors[i]);
      r[i] = color2.r || 0;
      g[i] = color2.g || 0;
      b[i] = color2.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color2.opacity = 1;
    return function(t) {
      color2.r = r(t);
      color2.g = g(t);
      color2.b = b(t);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis$1);
var rgbBasisClosed = rgbSpline(basisClosed);
function number(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero(b) {
  return function() {
    return b;
  };
}
function one(b) {
  return function(t) {
    return b(t) + "";
  };
}
function string(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
  a = a + "", b = b + "";
  while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s[i]) s[i] += bm;
      else s[++i] = bm;
    } else {
      s[++i] = null;
      q.push({ i, x: number(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs;
    else s[++i] = bs;
  }
  return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
    for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
    return s.join("");
  });
}
var degrees2 = 180 / Math.PI;
var identity = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees2,
    skewX: Math.atan(skewX) * degrees2,
    scaleX,
    scaleY
  };
}
var svgNode;
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity : decompose(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
  if (value == null) return identity;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
  value = value.matrix;
  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
}
function interpolateTransform(parse, pxComma, pxParen, degParen) {
  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }
  function translate2(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({ i: i - 4, x: number(xa, xb) }, { i: i - 2, x: number(ya, yb) });
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360;
      else if (b - a > 180) a += 360;
      q.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number(a, b) });
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }
  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number(a, b) });
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({ i: i - 4, x: number(xa, xb) }, { i: i - 2, x: number(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a, b) {
    var s = [], q = [];
    a = parse(a), b = parse(b);
    translate2(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null;
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");
var epsilon2 = 1e-12;
function cosh(x) {
  return ((x = Math.exp(x)) + 1 / x) / 2;
}
function sinh(x) {
  return ((x = Math.exp(x)) - 1 / x) / 2;
}
function tanh(x) {
  return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}
var zoom = (function zoomRho(rho, rho2, rho4) {
  function zoom3(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      };
    } else {
      var d1 = Math.sqrt(d2), b02 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b12 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b02 * b02 + 1) - b02), r1 = Math.log(Math.sqrt(b12 * b12 + 1) - b12);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S, coshr0 = cosh(r0), u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      };
    }
    i.duration = Math.abs(S) * 1e3 * rho / Math.SQRT2;
    return i;
  }
  zoom3.rho = function(_) {
    var _1 = Math.max(1e-3, +_), _2 = _1 * _1, _4 = _2 * _2;
    return zoomRho(_1, _2, _4);
  };
  return zoom3;
})(Math.SQRT2, 2, 4);
function hsl2(hue) {
  return function(start2, end) {
    var h = hue((start2 = hsl(start2)).h, (end = hsl(end)).h), s = nogamma(start2.s, end.s), l = nogamma(start2.l, end.l), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.h = h(t);
      start2.s = s(t);
      start2.l = l(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  };
}
var hsl_default = hsl2(hue$1);
var hslLong = hsl2(nogamma);
function hcl2(hue) {
  return function(start2, end) {
    var h = hue((start2 = hcl(start2)).h, (end = hcl(end)).h), c = nogamma(start2.c, end.c), l = nogamma(start2.l, end.l), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.h = h(t);
      start2.c = c(t);
      start2.l = l(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  };
}
var hcl_default = hcl2(hue$1);
var hclLong = hcl2(nogamma);
function cubehelix2(hue) {
  return (function cubehelixGamma(y) {
    y = +y;
    function cubehelix3(start2, end) {
      var h = hue((start2 = cubehelix(start2)).h, (end = cubehelix(end)).h), s = nogamma(start2.s, end.s), l = nogamma(start2.l, end.l), opacity = nogamma(start2.opacity, end.opacity);
      return function(t) {
        start2.h = h(t);
        start2.s = s(t);
        start2.l = l(Math.pow(t, y));
        start2.opacity = opacity(t);
        return start2 + "";
      };
    }
    cubehelix3.gamma = cubehelixGamma;
    return cubehelix3;
  })(1);
}
var cubehelix_default = cubehelix2(hue$1);
var cubehelixLong = cubehelix2(nogamma);

// extensions/scripts/mindmap-vendor/node_modules/d3-timer/dist/d3-timer.mjs
var frame = 0;
var timeout$1 = 0;
var interval$1 = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
  setTimeout(f, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time) {
  var t = new Timer();
  t.restart(callback, delay, time);
  return t;
}
function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
    t = t._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout$1 = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t02, t12 = taskHead, t22, time = Infinity;
  while (t12) {
    if (t12._call) {
      if (time > t12._time) time = t12._time;
      t02 = t12, t12 = t12._next;
    } else {
      t22 = t12._next, t12._next = null;
      t12 = t02 ? t02._next = t22 : taskHead = t22;
    }
  }
  taskTail = t02;
  sleep(time);
}
function sleep(time) {
  if (frame) return;
  if (timeout$1) timeout$1 = clearTimeout(timeout$1);
  var delay = time - clockNow;
  if (delay > 24) {
    if (time < Infinity) timeout$1 = setTimeout(wake, Math.ceil(time - clock.now() - clockSkew) + 1);
    if (interval$1) interval$1 = clearInterval(interval$1);
  } else {
    if (!interval$1) clockLast = clock.now(), interval$1 = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}
function timeout(callback, delay, time) {
  var t = new Timer();
  delay = delay == null ? 0 : +delay;
  t.restart((elapsed) => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

// extensions/scripts/mindmap-vendor/node_modules/d3-ease/dist/d3-ease.mjs
function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}
var exponent = 3;
var polyIn = (function custom(e) {
  e = +e;
  function polyIn2(t) {
    return Math.pow(t, e);
  }
  polyIn2.exponent = custom;
  return polyIn2;
})(exponent);
var polyOut = (function custom2(e) {
  e = +e;
  function polyOut2(t) {
    return 1 - Math.pow(1 - t, e);
  }
  polyOut2.exponent = custom2;
  return polyOut2;
})(exponent);
var polyInOut = (function custom3(e) {
  e = +e;
  function polyInOut2(t) {
    return ((t *= 2) <= 1 ? Math.pow(t, e) : 2 - Math.pow(2 - t, e)) / 2;
  }
  polyInOut2.exponent = custom3;
  return polyInOut2;
})(exponent);
var pi = Math.PI;
var halfPi = pi / 2;
function tpmt(x) {
  return (Math.pow(2, -10 * x) - 9765625e-10) * 1.0009775171065494;
}
var b1 = 4 / 11;
var b2 = 6 / 11;
var b3 = 8 / 11;
var b4 = 3 / 4;
var b5 = 9 / 11;
var b6 = 10 / 11;
var b7 = 15 / 16;
var b8 = 21 / 22;
var b9 = 63 / 64;
var b0 = 1 / b1 / b1;
var overshoot = 1.70158;
var backIn = (function custom4(s) {
  s = +s;
  function backIn2(t) {
    return (t = +t) * t * (s * (t - 1) + t);
  }
  backIn2.overshoot = custom4;
  return backIn2;
})(overshoot);
var backOut = (function custom5(s) {
  s = +s;
  function backOut2(t) {
    return --t * t * ((t + 1) * s + t) + 1;
  }
  backOut2.overshoot = custom5;
  return backOut2;
})(overshoot);
var backInOut = (function custom6(s) {
  s = +s;
  function backInOut2(t) {
    return ((t *= 2) < 1 ? t * t * ((s + 1) * t - s) : (t -= 2) * t * ((s + 1) * t + s) + 2) / 2;
  }
  backInOut2.overshoot = custom6;
  return backInOut2;
})(overshoot);
var tau = 2 * Math.PI;
var amplitude = 1;
var period = 0.3;
var elasticIn = (function custom7(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau);
  function elasticIn2(t) {
    return a * tpmt(- --t) * Math.sin((s - t) / p);
  }
  elasticIn2.amplitude = function(a2) {
    return custom7(a2, p * tau);
  };
  elasticIn2.period = function(p2) {
    return custom7(a, p2);
  };
  return elasticIn2;
})(amplitude, period);
var elasticOut = (function custom8(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau);
  function elasticOut2(t) {
    return 1 - a * tpmt(t = +t) * Math.sin((t + s) / p);
  }
  elasticOut2.amplitude = function(a2) {
    return custom8(a2, p * tau);
  };
  elasticOut2.period = function(p2) {
    return custom8(a, p2);
  };
  return elasticOut2;
})(amplitude, period);
var elasticInOut = (function custom9(a, p) {
  var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau);
  function elasticInOut2(t) {
    return ((t = t * 2 - 1) < 0 ? a * tpmt(-t) * Math.sin((s - t) / p) : 2 - a * tpmt(t) * Math.sin((s + t) / p)) / 2;
  }
  elasticInOut2.amplitude = function(a2) {
    return custom9(a2, p * tau);
  };
  elasticInOut2.period = function(p2) {
    return custom9(a, p2);
  };
  return elasticInOut2;
})(amplitude, period);

// extensions/scripts/mindmap-vendor/node_modules/d3-transition/dist/d3-transition.mjs
var emptyOn = dispatch("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule(node, name, id2, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id2 in schedules) return;
  create(node, id2, {
    name,
    index,
    // For context during callback.
    group,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule2 = get2(node, id2);
  if (schedule2.state > CREATED) throw new Error("too late; already scheduled");
  return schedule2;
}
function set2(node, id2) {
  var schedule2 = get2(node, id2);
  if (schedule2.state > STARTED) throw new Error("too late; already running");
  return schedule2;
}
function get2(node, id2) {
  var schedule2 = node.__transition;
  if (!schedule2 || !(schedule2 = schedule2[id2])) throw new Error("transition not found");
  return schedule2;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule2, 0, self.time);
  function schedule2(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed) start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i, j, n, o;
    if (self.state !== SCHEDULED) return stop();
    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;
      if (o.state === STARTED) return timeout(start2);
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      } else if (+i < id2) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }
    timeout(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return;
    self.state = STARTED;
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }
  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
    while (++i < n) {
      tween[i].call(node, t);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i in schedules) return;
    delete node.__transition;
  }
}
function interrupt(node, name) {
  var schedules = node.__transition, schedule2, active, empty2 = true, i;
  if (!schedules) return;
  name = name == null ? null : name + "";
  for (i in schedules) {
    if ((schedule2 = schedules[i]).name !== name) {
      empty2 = false;
      continue;
    }
    active = schedule2.state > STARTING && schedule2.state < ENDING;
    schedule2.state = ENDED;
    schedule2.timer.stop();
    schedule2.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule2.index, schedule2.group);
    delete schedules[i];
  }
  if (empty2) delete node.__transition;
}
function selection_interrupt(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}
function tweenRemove(id2, name) {
  var tween0, tween1;
  return function() {
    var schedule2 = set2(this, id2), tween = schedule2.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }
    schedule2.tween = tween1;
  };
}
function tweenFunction(id2, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error();
  return function() {
    var schedule2 = set2(this, id2), tween = schedule2.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = { name, value }, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }
    schedule2.tween = tween1;
  };
}
function transition_tween(name, value) {
  var id2 = this._id;
  name += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name, value));
}
function tweenValue(transition2, name, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule2 = set2(this, id2);
    (schedule2.value || (schedule2.value = {}))[name] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name];
  };
}
function interpolate(a, b) {
  var c;
  return (typeof b === "number" ? number : b instanceof color ? rgb2 : (c = color(b)) ? (b = c, rgb2) : string)(a, b);
}
function attrRemove2(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name, interpolate2, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate2(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate2, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate2(string00 = string0, value1);
  };
}
function attrFunction2(name, interpolate2, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate2(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate2, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate2(string00 = string0, value1));
  };
}
function transition_attr(name, value) {
  var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
  return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value));
}
function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i.call(this, t));
  };
}
function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}
function attrTweenNS(fullname, value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function attrTween(name, value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && attrInterpolate(name, i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function transition_attrTween(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  var fullname = namespace(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function transition_delay(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}
function durationFunction(id2, value) {
  return function() {
    set2(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set2(this, id2).duration = value;
  };
}
function transition_duration(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}
function easeConstant(id2, value) {
  if (typeof value !== "function") throw new Error();
  return function() {
    set2(this, id2).ease = value;
  };
}
function transition_ease(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}
function easeVarying(id2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error();
    set2(this, id2).ease = v;
  };
}
function transition_easeVarying(value) {
  if (typeof value !== "function") throw new Error();
  return this.each(easeVarying(this._id, value));
}
function transition_filter(match) {
  if (typeof match !== "function") match = matcher(match);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}
function transition_merge(transition2) {
  if (transition2._id !== this._id) throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}
function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}
function onFunction(id2, name, listener) {
  var on0, on1, sit = start(name) ? init : set2;
  return function() {
    var schedule2 = sit(this, id2), on = schedule2.on;
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
    schedule2.on = on1;
  };
}
function transition_on(name, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
}
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id2) return;
    if (parent) parent.removeChild(this);
  };
}
function transition_remove() {
  return this.on("end.remove", removeFunction(this._id));
}
function transition_select(select2) {
  var name = this._name, id2 = this._id;
  if (typeof select2 !== "function") select2 = selector(select2);
  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select2.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule(subgroup[i], name, id2, i, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name, id2);
}
function transition_selectAll(select2) {
  var name = this._name, id2 = this._id;
  if (typeof select2 !== "function") select2 = selectorAll(select2);
  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children2 = select2.call(node, node.__data__, i, group), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
          if (child = children2[k]) {
            schedule(child, name, id2, k, children2, inherit2);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name, id2);
}
var Selection2 = selection.prototype.constructor;
function transition_selection() {
  return new Selection2(this._groups, this._parents);
}
function styleNull(name, interpolate2) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate2(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant2(name, interpolate2, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate2(string00 = string0, value1);
  };
}
function styleFunction2(name, interpolate2, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate2(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
  return function() {
    var schedule2 = set2(this, id2), on = schedule2.on, listener = schedule2.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
    schedule2.on = on1;
  };
}
function transition_style(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
  return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove2(name)) : typeof value === "function" ? this.styleTween(name, styleFunction2(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i, value), priority).on("end.style." + name, null);
}
function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i.call(this, t), priority);
  };
}
function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}
function transition_styleTween(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function transition_text(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}
function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}
function textTween(value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && textInterpolate(i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function transition_textTween(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, textTween(value));
}
function transition_transition() {
  var name = this._name, id0 = this._id, id1 = newId();
  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit2 = get2(node, id0);
        schedule(node, name, id1, i, group, {
          time: inherit2.time + inherit2.delay + inherit2.duration,
          delay: 0,
          duration: inherit2.duration,
          ease: inherit2.ease
        });
      }
    }
  }
  return new Transition(groups, this._parents, name, id1);
}
function transition_end() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0) resolve();
    } };
    that.each(function() {
      var schedule2 = set2(this, id2), on = schedule2.on;
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule2.on = on1;
    });
    if (size === 0) resolve();
  });
}
var id = 0;
function Transition(groups, parents, name, id2) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id2;
}
function transition(name) {
  return selection().transition(name);
}
function newId() {
  return ++id;
}
var selection_prototype = selection.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  textTween: transition_textTween,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease,
  easeVarying: transition_easeVarying,
  end: transition_end,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function selection_transition(name) {
  var id2, timing;
  if (name instanceof Transition) {
    id2 = name._id, name = name._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }
  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule(node, name, id2, i, group, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups, this._parents, name, id2);
}
selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

// extensions/scripts/mindmap-vendor/node_modules/d3-zoom/dist/d3-zoom.mjs
var constant3 = (x) => () => x;
function ZoomEvent(type, {
  sourceEvent: sourceEvent2,
  target,
  transform: transform2,
  dispatch: dispatch2
}) {
  Object.defineProperties(this, {
    type: { value: type, enumerable: true, configurable: true },
    sourceEvent: { value: sourceEvent2, enumerable: true, configurable: true },
    target: { value: target, enumerable: true, configurable: true },
    transform: { value: transform2, enumerable: true, configurable: true },
    _: { value: dispatch2 }
  });
}
function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x, y) {
    return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  },
  apply: function(point) {
    return [point[0] * this.k + this.x, point[1] * this.k + this.y];
  },
  applyX: function(x) {
    return x * this.k + this.x;
  },
  applyY: function(y) {
    return y * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x) {
    return (x - this.x) / this.k;
  },
  invertY: function(y) {
    return (y - this.y) / this.k;
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity2 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity2;
  return node.__zoom;
}
function nopropagation(event) {
  event.stopImmediatePropagation();
}
function noevent2(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}
function defaultFilter(event) {
  return (!event.ctrlKey || event.type === "wheel") && !event.button;
}
function defaultExtent() {
  var e = this;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    if (e.hasAttribute("viewBox")) {
      e = e.viewBox.baseVal;
      return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
    }
    return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
  }
  return [[0, 0], [e.clientWidth, e.clientHeight]];
}
function defaultTransform() {
  return this.__zoom || identity2;
}
function defaultWheelDelta(event) {
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 2e-3) * (event.ctrlKey ? 10 : 1);
}
function defaultTouchable() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function defaultConstrain(transform2, extent, translateExtent) {
  var dx0 = transform2.invertX(extent[0][0]) - translateExtent[0][0], dx1 = transform2.invertX(extent[1][0]) - translateExtent[1][0], dy0 = transform2.invertY(extent[0][1]) - translateExtent[0][1], dy1 = transform2.invertY(extent[1][1]) - translateExtent[1][1];
  return transform2.translate(
    dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
    dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
  );
}
function zoom2() {
  var filter2 = defaultFilter, extent = defaultExtent, constrain = defaultConstrain, wheelDelta = defaultWheelDelta, touchable = defaultTouchable, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate2 = zoom, listeners = dispatch("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
  function zoom3(selection2) {
    selection2.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  zoom3.transform = function(collection, transform2, point, event) {
    var selection2 = collection.selection ? collection.selection() : collection;
    selection2.property("__zoom", defaultTransform);
    if (collection !== selection2) {
      schedule2(collection, transform2, point, event);
    } else {
      selection2.interrupt().each(function() {
        gesture(this, arguments).event(event).start().zoom(null, typeof transform2 === "function" ? transform2.apply(this, arguments) : transform2).end();
      });
    }
  };
  zoom3.scaleBy = function(selection2, k, p, event) {
    zoom3.scaleTo(selection2, function() {
      var k0 = this.__zoom.k, k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0 * k1;
    }, p, event);
  };
  zoom3.scaleTo = function(selection2, k, p, event) {
    zoom3.transform(selection2, function() {
      var e = extent.apply(this, arguments), t02 = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t02.invert(p0), k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate2(scale(t02, k1), p0, p1), e, translateExtent);
    }, p, event);
  };
  zoom3.translateBy = function(selection2, x, y, event) {
    zoom3.transform(selection2, function() {
      return constrain(this.__zoom.translate(
        typeof x === "function" ? x.apply(this, arguments) : x,
        typeof y === "function" ? y.apply(this, arguments) : y
      ), extent.apply(this, arguments), translateExtent);
    }, null, event);
  };
  zoom3.translateTo = function(selection2, x, y, p, event) {
    zoom3.transform(selection2, function() {
      var e = extent.apply(this, arguments), t = this.__zoom, p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
      return constrain(identity2.translate(p0[0], p0[1]).scale(t.k).translate(
        typeof x === "function" ? -x.apply(this, arguments) : -x,
        typeof y === "function" ? -y.apply(this, arguments) : -y
      ), e, translateExtent);
    }, p, event);
  };
  function scale(transform2, k) {
    k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k));
    return k === transform2.k ? transform2 : new Transform(k, transform2.x, transform2.y);
  }
  function translate2(transform2, p0, p1) {
    var x = p0[0] - p1[0] * transform2.k, y = p0[1] - p1[1] * transform2.k;
    return x === transform2.x && y === transform2.y ? transform2 : new Transform(transform2.k, x, y);
  }
  function centroid(extent2) {
    return [(+extent2[0][0] + +extent2[1][0]) / 2, (+extent2[0][1] + +extent2[1][1]) / 2];
  }
  function schedule2(transition2, transform2, point, event) {
    transition2.on("start.zoom", function() {
      gesture(this, arguments).event(event).start();
    }).on("interrupt.zoom end.zoom", function() {
      gesture(this, arguments).event(event).end();
    }).tween("zoom", function() {
      var that = this, args = arguments, g = gesture(that, args).event(event), e = extent.apply(that, args), p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a = that.__zoom, b = typeof transform2 === "function" ? transform2.apply(that, args) : transform2, i = interpolate2(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
      return function(t) {
        if (t === 1) t = b;
        else {
          var l = i(t), k = w / l[2];
          t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k);
        }
        g.zoom(null, t);
      };
    });
  }
  function gesture(that, args, clean) {
    return !clean && that.__zooming || new Gesture(that, args);
  }
  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.active = 0;
    this.sourceEvent = null;
    this.extent = extent.apply(that, args);
    this.taps = 0;
  }
  Gesture.prototype = {
    event: function(event) {
      if (event) this.sourceEvent = event;
      return this;
    },
    start: function() {
      if (++this.active === 1) {
        this.that.__zooming = this;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform2) {
      if (this.mouse && key !== "mouse") this.mouse[1] = transform2.invert(this.mouse[0]);
      if (this.touch0 && key !== "touch") this.touch0[1] = transform2.invert(this.touch0[0]);
      if (this.touch1 && key !== "touch") this.touch1[1] = transform2.invert(this.touch1[0]);
      this.that.__zoom = transform2;
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        delete this.that.__zooming;
        this.emit("end");
      }
      return this;
    },
    emit: function(type) {
      var d = select(this.that).datum();
      listeners.call(
        type,
        this.that,
        new ZoomEvent(type, {
          sourceEvent: this.sourceEvent,
          target: zoom3,
          transform: this.that.__zoom,
          dispatch: listeners
        }),
        d
      );
    }
  };
  function wheeled(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var g = gesture(this, args).event(event), t = this.__zoom, k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))), p = pointer(event);
    if (g.wheel) {
      if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) {
        g.mouse[1] = t.invert(g.mouse[0] = p);
      }
      clearTimeout(g.wheel);
    } else if (t.k === k) return;
    else {
      g.mouse = [p, t.invert(p)];
      interrupt(this);
      g.start();
    }
    noevent2(event);
    g.wheel = setTimeout(wheelidled, wheelDelay);
    g.zoom("mouse", constrain(translate2(scale(t, k), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }
  function mousedowned(event, ...args) {
    if (touchending || !filter2.apply(this, arguments)) return;
    var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer(event, currentTarget), x0 = event.clientX, y0 = event.clientY;
    nodrag(event.view);
    nopropagation(event);
    g.mouse = [p, this.__zoom.invert(p)];
    interrupt(this);
    g.start();
    function mousemoved(event2) {
      noevent2(event2);
      if (!g.moved) {
        var dx = event2.clientX - x0, dy = event2.clientY - y0;
        g.moved = dx * dx + dy * dy > clickDistance2;
      }
      g.event(event2).zoom("mouse", constrain(translate2(g.that.__zoom, g.mouse[0] = pointer(event2, currentTarget), g.mouse[1]), g.extent, translateExtent));
    }
    function mouseupped(event2) {
      v.on("mousemove.zoom mouseup.zoom", null);
      yesdrag(event2.view, g.moved);
      noevent2(event2);
      g.event(event2).end();
    }
  }
  function dblclicked(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var t02 = this.__zoom, p0 = pointer(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t02.invert(p0), k1 = t02.k * (event.shiftKey ? 0.5 : 2), t12 = constrain(translate2(scale(t02, k1), p0, p1), extent.apply(this, args), translateExtent);
    noevent2(event);
    if (duration > 0) select(this).transition().duration(duration).call(schedule2, t12, p0, event);
    else select(this).call(zoom3.transform, t12, p0, event);
  }
  function touchstarted(event, ...args) {
    if (!filter2.apply(this, arguments)) return;
    var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
    nopropagation(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);
      p = [p, this.__zoom.invert(p), t.identifier];
      if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
      else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
    }
    if (touchstarting) touchstarting = clearTimeout(touchstarting);
    if (started) {
      if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
        touchstarting = null;
      }, touchDelay);
      interrupt(this);
      g.start();
    }
  }
  function touchmoved(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
    noevent2(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);
      if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
      else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
    }
    t = g.that.__zoom;
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      t = scale(t, Math.sqrt(dp / dl));
      p = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
    } else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
    else return;
    g.zoom("touch", constrain(translate2(t, p, l), g.extent, translateExtent));
  }
  function touchended(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
    nopropagation(event);
    if (touchending) clearTimeout(touchending);
    touchending = setTimeout(function() {
      touchending = null;
    }, touchDelay);
    for (i = 0; i < n; ++i) {
      t = touches[i];
      if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
      else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
    }
    if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
    if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
    else {
      g.end();
      if (g.taps === 2) {
        t = pointer(t, this);
        if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
          var p = select(this).on("dblclick.zoom");
          if (p) p.apply(this, arguments);
        }
      }
    }
  }
  zoom3.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant3(+_), zoom3) : wheelDelta;
  };
  zoom3.filter = function(_) {
    return arguments.length ? (filter2 = typeof _ === "function" ? _ : constant3(!!_), zoom3) : filter2;
  };
  zoom3.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant3(!!_), zoom3) : touchable;
  };
  zoom3.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant3([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom3) : extent;
  };
  zoom3.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom3) : [scaleExtent[0], scaleExtent[1]];
  };
  zoom3.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom3) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };
  zoom3.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom3) : constrain;
  };
  zoom3.duration = function(_) {
    return arguments.length ? (duration = +_, zoom3) : duration;
  };
  zoom3.interpolate = function(_) {
    return arguments.length ? (interpolate2 = _, zoom3) : interpolate2;
  };
  zoom3.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom3 : value;
  };
  zoom3.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom3) : Math.sqrt(clickDistance2);
  };
  zoom3.tapDistance = function(_) {
    return arguments.length ? (tapDistance = +_, zoom3) : tapDistance;
  };
  return zoom3;
}

// extensions/scripts/mindmap-vendor/node_modules/@markmap/view/dist/index.js
var IDENTITY = [
  1,
  0,
  0,
  1,
  0,
  0
];
var HitIndex = class {
  entries = [];
  index;
  radius;
  constructor(primitives, options = {}) {
    const include = options.include ?? (() => true);
    const radius = this.radius = options.toggleRadius ?? 10;
    const boxes = [];
    const add = (target, box, center) => {
      this.entries.push({
        target,
        center
      });
      boxes.push(box);
    };
    const visit = (list, matrix, nodeId) => {
      for (const p of list) if (p.kind === "group") {
        const id2 = p.nodeId ?? nodeId;
        if (id2 && !include(id2)) continue;
        visit(p.children, p.transform ? multiply(matrix, p.transform) : matrix, id2);
      } else if (p.kind === "hit" && nodeId) add({
        kind: "action",
        nodeId,
        action: p.action
      }, transformRect(matrix, p.rect));
      else if (p.kind === "link") add({
        kind: "link",
        nodeId,
        href: p.href
      }, transformRect(matrix, p.rect));
    };
    visit(primitives, IDENTITY);
    for (const { x, y, nodeId } of options.toggles ?? []) {
      if (!include(nodeId)) continue;
      add({
        kind: "toggle",
        nodeId
      }, {
        x: x - radius,
        y: y - radius,
        width: radius * 2,
        height: radius * 2
      }, {
        x,
        y
      });
    }
    if (!boxes.length) return;
    this.index = new Flatbush(boxes.length);
    for (const box of boxes) this.index.add(box.x, box.y, box.x + box.width, box.y + box.height);
    this.index.finish();
  }
  /**
  * The target at a point in layout coordinates. Actions and links win over fold
  * toggles, and the one drawn last (on top) wins among them; among toggles, the nearest.
  */
  hit(x, y) {
    if (!this.index) return void 0;
    let top = -1;
    let toggle;
    for (const i of this.index.search(x, y, x, y)) {
      const { center } = this.entries[i];
      if (!center) {
        top = Math.max(top, i);
        continue;
      }
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance <= this.radius && (!toggle || distance < toggle.distance)) toggle = {
        index: i,
        distance
      };
    }
    const found = top >= 0 ? top : toggle?.index;
    return found == null ? void 0 : this.entries[found].target;
  }
};
function transformRect([a, b, c, d, e, f], rect) {
  const xs = [];
  const ys = [];
  for (const [x2, y2] of [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height]
  ]) {
    xs.push(a * x2 + c * y2 + e);
    ys.push(b * x2 + d * y2 + f);
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y
  };
}
var STYLE_ID = "markmap-popover-style";
var CSS = `
.markmap-popover {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  max-width: min(420px, calc(100vw - 16px));
  max-height: min(50vh, 480px);
  overflow: auto;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: var(--mm-bg, #fff);
  color: var(--mm-text, #333);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
/* Focused programmatically so Escape and screen readers land here; no ring needed. */
.markmap-popover:focus { outline: none; }
.markmap-popover > :first-child { margin-top: 0; }
.markmap-popover > :last-child { margin-bottom: 0; }
.markmap-popover p, .markmap-popover pre, .markmap-popover blockquote,
.markmap-popover table, .markmap-popover ul, .markmap-popover ol { margin: 0.5em 0; }
.markmap-popover a { color: var(--mm-link, #0097e6); }
.markmap-popover code {
  padding: 0.1em 0.3em;
  border-radius: 3px;
  background: var(--mm-code-bg, #f0f0f0);
  color: var(--mm-code-text, #555);
  font: 0.9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.markmap-popover pre { padding: 8px; overflow: auto; border-radius: 4px; background: var(--mm-code-bg, #f0f0f0); }
.markmap-popover pre code { padding: 0; background: none; }
.markmap-popover blockquote { padding-left: 0.8em; border-left: 3px solid rgba(0, 0, 0, 0.15); color: inherit; opacity: 0.85; }
.markmap-popover table { border-collapse: collapse; }
.markmap-popover th, .markmap-popover td { padding: 2px 8px; border: 1px solid rgba(0, 0, 0, 0.15); }
.markmap-popover mark { background: var(--mm-mark-bg, #ffeaa7); color: inherit; }
.markmap-popover img { max-width: 100%; }
.markmap-popover .hljs-keyword, .markmap-popover .hljs-type, .markmap-popover .hljs-meta .hljs-keyword,
.markmap-popover .hljs-selector-tag, .markmap-popover .hljs-doctag { color: var(--mm-syntax-keyword, #cf222e); }
.markmap-popover .hljs-string, .markmap-popover .hljs-regexp, .markmap-popover .hljs-char,
.markmap-popover .hljs-meta .hljs-string { color: var(--mm-syntax-string, #0a3069); }
.markmap-popover .hljs-comment, .markmap-popover .hljs-quote { color: var(--mm-syntax-comment, #6e7781); font-style: italic; }
.markmap-popover .hljs-number, .markmap-popover .hljs-literal, .markmap-popover .hljs-symbol,
.markmap-popover .hljs-variable.constant_, .markmap-popover .hljs-built_in { color: var(--mm-syntax-number, #0550ae); }
.markmap-popover .hljs-title, .markmap-popover .hljs-section { color: var(--mm-syntax-title, #8250df); }
.markmap-popover .hljs-attr, .markmap-popover .hljs-attribute, .markmap-popover .hljs-property,
.markmap-popover .hljs-name, .markmap-popover .hljs-selector-class { color: var(--mm-syntax-attr, #116329); }
`;
function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style2 = doc.createElement("style");
  style2.id = STYLE_ID;
  style2.textContent = CSS;
  doc.head.append(style2);
}
var GAP2 = 6;
var MARGIN = 8;
var Popover = class {
  el;
  constructor(doc, html, tokens) {
    ensureStyle(doc);
    this.el = doc.createElement("div");
    this.el.className = "markmap-popover";
    this.el.setAttribute("role", "dialog");
    this.el.tabIndex = -1;
    for (const [name, value] of Object.entries(tokens)) this.el.style.setProperty(`--${name}`, value);
    this.el.innerHTML = html;
    doc.body.append(this.el);
  }
  /** Place below `anchor` (a rect in viewport coordinates), or above when there is no room. */
  position(anchor) {
    const view = this.el.ownerDocument.defaultView;
    const vw = view?.innerWidth ?? 0;
    const vh = view?.innerHeight ?? 0;
    const { width, height } = this.el.getBoundingClientRect();
    const below = anchor.y + anchor.height + GAP2;
    const above = anchor.y - GAP2 - height;
    const top = below + height <= vh - MARGIN || above < MARGIN ? below : above;
    const left = Math.min(Math.max(MARGIN, anchor.x), Math.max(MARGIN, vw - width - MARGIN));
    this.el.style.top = `${Math.round(top)}px`;
    this.el.style.left = `${Math.round(left)}px`;
  }
  contains(node) {
    return !!node && this.el.contains(node);
  }
  destroy() {
    this.el.remove();
  }
};
var SVG_NS = "http://www.w3.org/2000/svg";
var SvgDomBackend = class {
  element;
  nativeLinks = true;
  themeSelector;
  /** Group that holds the drawing and carries the zoom transform. */
  root;
  style;
  items = /* @__PURE__ */ new Map();
  constructor(svg, { themeSelector } = {}) {
    this.element = svg;
    this.themeSelector = themeSelector;
    const doc = svg.ownerDocument;
    this.style = doc.createElementNS(SVG_NS, "style");
    this.root = doc.createElementNS(SVG_NS, "g");
    svg.append(this.style, this.root);
  }
  setCSS(css) {
    this.style.textContent = css;
  }
  setTransform({ k, x, y }) {
    this.root.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
  }
  /** Element drawn for a keyed group, if any. */
  get(key) {
    return this.items.get(key)?.el;
  }
  draw(primitives) {
    const seen = /* @__PURE__ */ new Set();
    let prev = null;
    primitives.forEach((p, index) => {
      if (p.backends && !p.backends.includes("svg")) return;
      const isGroup = p.kind === "group";
      const key = isGroup && p.key ? p.key : `#${index}`;
      seen.add(key);
      let item = this.items.get(key);
      if (!item) {
        item = {
          el: this.root.ownerDocument.createElementNS(SVG_NS, "g"),
          markup: ""
        };
        this.items.set(key, item);
      }
      const { el } = item;
      setAttr(el, "transform", isGroup && p.transform ? `matrix(${p.transform.join(" ")})` : null);
      setAttr(el, "opacity", isGroup && p.opacity != null ? String(p.opacity) : null);
      setAttr(el, "data-node-id", isGroup ? p.nodeId ?? null : null);
      setAttr(el, "data-key", key);
      const content = !isGroup ? [p] : p.clip ? [{
        ...p,
        transform: void 0,
        opacity: void 0
      }] : p.children;
      const markup = primitivesToSVG(content, { interactive: true });
      if (markup !== item.markup) {
        if (!patchPath(el, item.markup, markup)) el.innerHTML = markup;
        item.markup = markup;
      }
      const expected = prev ? prev.nextSibling : this.root.firstChild;
      if (expected !== el) this.root.insertBefore(el, expected);
      prev = el;
    });
    for (const [key, item] of this.items) if (!seen.has(key)) {
      item.el.remove();
      this.items.delete(key);
    }
  }
  destroy() {
    this.style.remove();
    this.root.remove();
    this.items.clear();
  }
};
function setAttr(el, name, value) {
  if (value == null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
var SINGLE_PATH = /^<path d="([^"]*)"([^>]*)\/>$/;
function patchPath(el, before, after) {
  const a = SINGLE_PATH.exec(before);
  const b = SINGLE_PATH.exec(after);
  const path = el.firstElementChild;
  if (!a || !b || a[2] !== b[2] || b[1].includes("&")) return false;
  if (!path || path !== el.lastElementChild) return false;
  path.setAttribute("d", b[1]);
  return true;
}
var animationFrames = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle)
};
var Tween = class {
  scheduler;
  handle;
  constructor(scheduler = animationFrames) {
    this.scheduler = scheduler;
  }
  get running() {
    return this.handle != null;
  }
  /**
  * Call `frame` with progress from 0 to 1 on every animation frame for `duration` ms.
  * The last call is always exactly 1. A duration of 0 calls `frame(1)` right away.
  */
  start(duration, frame2) {
    this.stop();
    if (duration <= 0) {
      frame2(1);
      return;
    }
    const start2 = this.scheduler.now();
    const tick = () => {
      const t = Math.min(1, (this.scheduler.now() - start2) / duration);
      this.handle = t < 1 ? this.scheduler.request(tick) : void 0;
      frame2(t);
    };
    this.handle = this.scheduler.request(tick);
  }
  stop() {
    if (this.handle == null) return;
    this.scheduler.cancel(this.handle);
    this.handle = void 0;
  }
};
var DEFAULTS = {
  zoom: true,
  pan: true,
  fitPadding: 20,
  fitMaxScale: 2,
  minScale: 0.1,
  maxScale: 8,
  duration: 500
};
function resolveViewOptions(base, input, resolve) {
  const { options, json, warnings } = resolveRenderOptions(base, input, resolve);
  for (const key of [
    "zoom",
    "pan",
    "fitPadding",
    "fitMaxScale",
    "minScale",
    "maxScale",
    "foldLevel",
    "duration",
    "colorScheme"
  ]) if (json[key] != null) options[key] = json[key];
  return {
    options,
    warnings
  };
}
var ZOOM_STEP = 1.25;
function walk(node, visit, depth = 0) {
  visit(node, depth);
  for (const child of node.children) walk(child, visit, depth + 1);
}
var TOGGLE_RADIUS2 = 10;
var uniqueClass = () => `markmap-${Math.random().toString(36).slice(2, 10)}`;
function pathTo(node, id2) {
  if (node.id === id2) return [node];
  for (const child of node.children) {
    const path = pathTo(child, id2);
    if (path) return [node, ...path];
  }
}
var isBackend = (value) => typeof value.draw === "function";
var Markmap = class Markmap2 {
  backend;
  scopeClass = uniqueClass();
  viewOptions = DEFAULTS;
  zoomBehavior = zoom2();
  selection;
  measurer;
  root;
  folded = /* @__PURE__ */ new Set();
  known = /* @__PURE__ */ new Set();
  current;
  pendingFit;
  popover;
  /** Bumped on every open/close, so a slow lazy import cannot open a stale popover. */
  popoverRequest = 0;
  /** What is on screen: the final state, or a frame of an animation towards it. */
  frame;
  /** Primitives drawn for `frame`. */
  primitives = [];
  /** Hit targets of `frame`, built on the first lookup after it is drawn. */
  hits;
  stateTween = new Tween();
  zoomTween = new Tween();
  /** Whether the first fit has happened; it is never animated. */
  placed = false;
  /** Scale of the last fit. */
  fitScale;
  /** Where the running zoom animation ends. */
  zoomTarget;
  /**
  * A node held at a fixed point in the element (its top-left corner) while the tree moves
  * around it, as when folding. Applied on every frame, so it works however the
  * frames move the node, and released when the animation ends or the user moves the view.
  */
  pin;
  /**
  * Show a map in an `<svg>` element, or through another backend (such as canvas from
  * `@markmap/canvas`).
  */
  constructor(target, options = {}) {
    this.backend = isBackend(target) ? target : new SvgDomBackend(target);
    const { element } = this.backend;
    element.classList.add("markmap", this.scopeClass);
    this.measurer = options.measurer ?? createCanvasMeasurer();
    this.applyOptions(options);
    this.selection = select(element);
    this.zoomBehavior.filter((event) => {
      if (event.type === "wheel") return !!this.options.zoom;
      if (event.type === "dblclick") return false;
      const { button = 0, ctrlKey = false } = event;
      return !!this.options.pan && !ctrlKey && !button;
    }).on("zoom", (event) => {
      if (event.sourceEvent) {
        this.zoomTween.stop();
        this.pin = void 0;
      }
      this.backend.setTransform(event.transform);
      this.positionPopover();
      this.emit("zoom", event.transform);
    });
    this.selection.call(this.zoomBehavior);
    element.addEventListener("click", this.handleClick);
    element.addEventListener("pointermove", this.handleHover);
  }
  /** Keep the last fit within the limits, or zooming from it would jump. */
  updateScaleLimits() {
    const { minScale = 0, maxScale = Infinity } = this.viewOptions;
    const fit2 = this.fitScale ?? minScale;
    this.zoomBehavior.scaleExtent([Math.min(minScale, fit2), Math.max(maxScale, fit2)]);
  }
  /** The smallest and largest scale the view can zoom to. */
  get scaleLimits() {
    const [min, max] = this.zoomBehavior.scaleExtent();
    return [min, max];
  }
  /**
  * Class that carries the map's theme tokens: add it to controls beside the map so they
  * can use `--mm-*` too.
  */
  get themeClass() {
    return this.scopeClass;
  }
  /** The tree on show, with folded nodes. */
  get tree() {
    return this.root;
  }
  /** The element the map is shown in. */
  get element() {
    return this.backend.element;
  }
  get options() {
    return this.viewOptions;
  }
  /** Replace all options (defaults fill the gaps) and redraw. */
  setOptions(options) {
    this.applyOptions(options);
    this.render();
  }
  applyOptions(options) {
    this.viewOptions = {
      ...DEFAULTS,
      ...options
    };
    if (options.measurer) this.measurer = options.measurer;
    const selector2 = this.backend.themeSelector ?? `.${this.scopeClass}`;
    this.backend.setCSS(themeCSS(this.theme, this.viewOptions.colorScheme, selector2));
    this.updateScaleLimits();
  }
  static create(target, root2, options) {
    const mm = new Markmap2(target, options);
    if (root2) {
      mm.setTree(root2);
      mm.fit();
    }
    return mm;
  }
  get theme() {
    return this.options.theme ?? classicTheme;
  }
  /** Ids of folded nodes. */
  get foldedIds() {
    return this.folded;
  }
  /** The final (not mid-animation) result of the last render. */
  get result() {
    return this.current;
  }
  /**
  * Show a new tree, optionally replacing all options at the same time. Fold state is
  * kept for ids that still exist, so live editing does not reset what the user folded.
  * New nodes start folded if `data.fold` or an ancestor's `data.foldAll` is set, or
  * they are below `foldLevel`.
  */
  setTree(root2, options) {
    if (options) this.applyOptions(options);
    this.root = root2;
    const ids = /* @__PURE__ */ new Set();
    const level = this.options.foldLevel;
    const visit = (node, depth, foldAll) => {
      ids.add(node.id);
      const all = foldAll || !!node.data.foldAll;
      if (!this.known.has(node.id) && node.children.length) {
        if (all || node.data.fold || level != null && depth >= level) this.folded.add(node.id);
      }
      for (const child of node.children) visit(child, depth + 1, all);
    };
    const before = new Set(this.folded);
    visit(root2, 0, false);
    for (const id2 of this.folded) if (!ids.has(id2)) this.folded.delete(id2);
    this.known = ids;
    this.render();
    if (!sameSet(before, this.folded)) this.emit("fold", this.folded);
  }
  /** Re-measure, lay out and draw the current tree, animated unless `animate` is `false`. */
  render({ animate = true } = {}) {
    if (!this.root) return void 0;
    this.current = renderTree(this.root, {
      ...this.viewOptions,
      measurer: this.measurer,
      folded: this.folded
    });
    const target = this.current.state;
    const from = this.frame;
    const duration = animate ? this.duration : 0;
    if (from && duration > 0) {
      const theme = this.theme;
      const layout = this.options.layout;
      this.stateTween.start(duration, (t) => {
        this.drawFrame(t < 1 ? interpolateStates(from, target, easeCubicInOut(t), theme, layout) : target);
        if (t >= 1) this.pin = void 0;
      });
    } else {
      this.stateTween.stop();
      this.drawFrame(target);
      this.pin = void 0;
    }
    if (this.popover) {
      if (this.current.layout.byId.get(this.popover.id)?.node.notes.length) this.positionPopover();
      else this.closeNotes();
    }
    this.emit("render", this.current);
    const { pending } = this.current;
    if (pending) {
      const result = this.current;
      pending.then(() => {
        if (this.current === result) this.render();
      });
    }
    return this.current;
  }
  drawFrame(state) {
    this.frame = state;
    this.primitives = drawState(state, this.theme);
    this.backend.draw(this.primitives);
    this.applyPin();
    this.positionPopover();
  }
  /** Pan so the pinned node's frame position lands on its pinned point. */
  applyPin() {
    const rect = this.pin && this.frameNode(this.pin.id)?.rect;
    if (!this.pin || !rect) return;
    const { k, x, y } = this.transform;
    const dx = this.pin.x - (x + rect.x * k);
    const dy = this.pin.y - (y + rect.y * k);
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
    this.zoomBehavior.transform(this.selection, identity2.translate(x + dx, y + dy).scale(k));
  }
  /** Animation length in ms, `0` when animations are off. */
  get duration() {
    if (this.element.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
    return this.options.duration ?? 0;
  }
  /** Where a node is drawn right now, possibly mid-animation. */
  frameNode(id2) {
    return this.frame?.nodes.find((item) => item.node.id === id2);
  }
  /** Fold or unfold a node, keeping it in place on screen. */
  setFolded(id2, folded) {
    if (folded === this.folded.has(id2)) return;
    this.updateFolded(id2, () => {
      if (folded) this.folded.add(id2);
      else this.folded.delete(id2);
    });
  }
  /**
  * Replace the set of folded nodes, as when restoring a saved state: one redraw, keeping
  * the root still. Ids that no longer exist, and nodes with no children, are ignored.
  */
  setFoldedIds(ids, { animate = true } = {}) {
    if (!this.root) return;
    const wanted = new Set(ids);
    const update = () => {
      this.folded.clear();
      walk(this.root, (node) => {
        if (wanted.has(node.id) && node.children.length) this.folded.add(node.id);
      });
    };
    this.updateFolded(this.root.id, update, animate);
  }
  /**
  * Unfold a node's ancestors and center on it, as for a link to a node. Keeps the current
  * zoom unless `scale` is given. Returns whether the node exists; a view with no size
  * yet unfolds but cannot center.
  */
  focusNode(id2, options = {}) {
    const path = this.root && pathTo(this.root, id2);
    if (!path) return false;
    const { animate = true } = options;
    const hidden = path.slice(0, -1).filter((node) => this.folded.has(node.id));
    if (hidden.length) {
      for (const node of hidden) this.folded.delete(node.id);
      this.render({ animate });
      this.emit("fold", this.folded);
    }
    const rect = this.current?.layout.byId.get(id2)?.rect;
    const { width, height } = this.element.getBoundingClientRect();
    if (rect && width && height) {
      const [min, max] = this.zoomBehavior.scaleExtent();
      const k = Math.min(max, Math.max(min, options.scale ?? this.transform.k));
      const x = width / 2 - (rect.x + rect.width / 2) * k;
      const y = height / 2 - (rect.y + rect.height / 2) * k;
      this.zoomTo(identity2.translate(x, y).scale(k), animate);
    }
    return true;
  }
  /** Unfold a node and everything below it. Defaults to the whole tree. */
  expandAll(id2) {
    const node = this.subtree(id2);
    if (!node) return;
    this.updateFolded(node.id, () => {
      walk(node, (child) => this.folded.delete(child.id));
    });
  }
  /**
  * Fold a node and every node below it that has children, so unfolding later reveals
  * one level at a time. Defaults to the whole tree, leaving only the root.
  */
  foldAll(id2) {
    const node = this.subtree(id2);
    if (!node) return;
    this.updateFolded(node.id, () => {
      walk(node, (child) => {
        if (child.children.length) this.folded.add(child.id);
      });
    });
  }
  /**
  * Show the tree down to `level`: nodes at that depth and deeper are folded, the rest
  * unfolded. The root is depth 0, so `1` shows only the root's children. Same meaning
  * as the `foldLevel` option; `expandAll()` shows everything.
  */
  foldToLevel(level) {
    if (!this.root) return;
    this.updateFolded(this.root.id, () => {
      walk(this.root, (node, depth) => {
        if (depth >= level && node.children.length) this.folded.add(node.id);
        else this.folded.delete(node.id);
      });
    });
  }
  subtree(id2) {
    if (!this.root) return void 0;
    return id2 == null ? this.root : findNode(this.root, id2);
  }
  /**
  * Change fold state and redraw once, animated, keeping `pinId` still on screen. If that
  * node is not drawn (inside a folded branch), the root stays still instead.
  */
  updateFolded(pinId, change, animate = true) {
    const before = new Set(this.folded);
    change();
    if (sameSet(before, this.folded)) return;
    const pinned = this.frameNode(pinId) ?? (this.root && this.frameNode(this.root.id));
    if (pinned) {
      const [x, y] = this.transform.apply([pinned.rect.x, pinned.rect.y]);
      this.zoomTween.stop();
      this.pin = {
        id: pinned.node.id,
        x,
        y
      };
    }
    this.render({ animate });
    this.emit("fold", this.folded);
  }
  listeners = /* @__PURE__ */ new Map();
  /** Listen to an event. Returns a function that stops listening. */
  on(type, listener) {
    let set3 = this.listeners.get(type);
    if (!set3) this.listeners.set(type, set3 = /* @__PURE__ */ new Set());
    set3.add(listener);
    return () => set3.delete(listener);
  }
  emit(type, value) {
    for (const listener of this.listeners.get(type) ?? []) listener(value);
  }
  /**
  * Zoom by `factor` around the center of the element, animated. Repeated calls during an
  * animation add up. The scale stays within the zoom behavior's scale extent.
  */
  zoomBy(factor) {
    const { width, height } = this.element.getBoundingClientRect();
    const base = this.zoomTween.running && this.zoomTarget || this.transform;
    const [min, max] = this.zoomBehavior.scaleExtent();
    const k = Math.min(max, Math.max(min, base.k * factor));
    const cx = width / 2;
    const cy = height / 2;
    const x = (cx - base.x) / base.k;
    const y = (cy - base.y) / base.k;
    this.zoomTo(identity2.translate(cx - x * k, cy - y * k).scale(k));
  }
  zoomIn() {
    this.zoomBy(ZOOM_STEP);
  }
  zoomOut() {
    this.zoomBy(1 / ZOOM_STEP);
  }
  /** Move the view to `target`, animated unless animations are off. */
  zoomTo(target, animate = true) {
    this.pin = void 0;
    this.zoomTarget = target;
    const from = this.transform;
    const { width, height } = this.element.getBoundingClientRect();
    const apply = (transform2) => this.zoomBehavior.transform(this.selection, transform2);
    const duration = animate ? this.duration : 0;
    this.zoomTween.start(duration, (t) => apply(t < 1 ? interpolateZoom(from, target, easeCubicInOut(t), width / 2, height / 2) : target));
  }
  toggle(id2) {
    this.setFolded(id2, !this.folded.has(id2));
  }
  /**
  * Scale and center the drawing to fill the element. If it has no size yet (hidden,
  * or not laid out), the fit happens as soon as it gets one.
  */
  fit() {
    if (!this.current) return;
    const { width, height } = this.element.getBoundingClientRect();
    if (!width || !height) {
      this.fitWhenSized();
      return;
    }
    this.pendingFit?.disconnect();
    this.pendingFit = void 0;
    const box = this.current.bounds;
    const padding = this.options.fitPadding ?? 0;
    const scale = Math.min((width - padding * 2) / box.width, (height - padding * 2) / box.height, this.options.fitMaxScale ?? 2);
    this.fitScale = scale;
    this.updateScaleLimits();
    const transform2 = identity2.translate(width / 2, height / 2).scale(scale).translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
    this.zoomTo(transform2, this.placed);
    this.placed = true;
  }
  fitWhenSized() {
    if (this.pendingFit || typeof ResizeObserver === "undefined") return;
    this.pendingFit = new ResizeObserver(() => {
      const { width, height } = this.element.getBoundingClientRect();
      if (width && height) this.fit();
    });
    this.pendingFit.observe(this.element);
  }
  /** Current zoom transform. */
  get transform() {
    return transform(this.element);
  }
  /**
  * What a point in layout coordinates acts on, where things are drawn right now (also
  * mid-animation). Nodes on their way out cannot be clicked.
  */
  hitAt(x, y) {
    const { frame: frame2, result } = this;
    if (!frame2 || !result) return void 0;
    if (this.hits?.frame !== frame2) {
      const toggles = frame2.nodes.filter((item) => item.ctx.hasChildren).map((item) => ({
        nodeId: item.node.id,
        ...this.theme.node.anchor(item.rect, item.ctx.direction, item.ctx)
      }));
      const index = new HitIndex(this.primitives, {
        toggles,
        toggleRadius: TOGGLE_RADIUS2,
        include: (id2) => result.layout.byId.has(id2)
      });
      this.hits = {
        frame: frame2,
        index
      };
    }
    return this.hits.index.hit(x, y);
  }
  /** Layout coordinates of a pointer event. */
  layoutPoint(event) {
    const box = this.element.getBoundingClientRect();
    return this.transform.invert([event.clientX - box.x, event.clientY - box.y]);
  }
  /** Id of the node whose notes are open, if any. */
  get openNoteId() {
    return this.popover?.id;
  }
  /** Show a node's notes in a popover next to it. */
  async openNotes(id2) {
    const item = this.current?.layout.byId.get(id2);
    if (!item?.node.notes.length) return;
    this.closeNotes();
    const request = this.popoverRequest;
    const { notesToHtml } = await import("./chunks/notes-html-DIYxB3aO-GMCPTGNZ.js");
    const html = await notesToHtml(item.node.notes, {
      plugins: this.options.plugins ?? defaultContentPlugins,
      highlight: this.options.highlight
    });
    if (request !== this.popoverRequest) return;
    const popover = new Popover(this.element.ownerDocument, html, this.currentTokens());
    popover.el.setAttribute("aria-label", "Notes");
    this.popover = {
      id: id2,
      popover
    };
    this.positionPopover();
    const doc = this.element.ownerDocument;
    doc.addEventListener("click", this.handleOutside, true);
    doc.addEventListener("keydown", this.handleKey);
    doc.defaultView?.addEventListener("scroll", this.handleScroll, true);
    popover.el.focus({ preventScroll: true });
  }
  closeNotes() {
    this.popoverRequest += 1;
    if (!this.popover) return;
    this.popover.popover.destroy();
    this.popover = void 0;
    const doc = this.element.ownerDocument;
    doc.removeEventListener("click", this.handleOutside, true);
    doc.removeEventListener("keydown", this.handleKey);
    doc.defaultView?.removeEventListener("scroll", this.handleScroll, true);
  }
  /**
  * Token values as the element resolves them right now, so the popover matches the color
  * scheme in effect and any CSS overrides on the page.
  */
  currentTokens() {
    const { tokens, darkTokens = {} } = this.theme;
    const style2 = this.element.ownerDocument.defaultView?.getComputedStyle(this.element);
    const result = {};
    for (const name of /* @__PURE__ */ new Set([...Object.keys(tokens), ...Object.keys(darkTokens)])) result[name] = style2?.getPropertyValue(`--${name}`).trim() || tokens[name] || "";
    return result;
  }
  /** A node's box in viewport coordinates, where it is drawn right now. */
  screenRect(id2) {
    const rect = this.frameNode(id2)?.rect;
    if (!rect) return void 0;
    const svgRect = this.element.getBoundingClientRect();
    const t = this.transform;
    return {
      x: svgRect.x + t.applyX(rect.x),
      y: svgRect.y + t.applyY(rect.y),
      width: rect.width * t.k,
      height: rect.height * t.k
    };
  }
  positionPopover() {
    if (!this.popover) return;
    const rect = this.screenRect(this.popover.id);
    if (rect) this.popover.popover.position(rect);
  }
  handleOutside = (event) => {
    const target = event.composedPath()[0];
    if (this.popover?.popover.contains(target)) return;
    if (target && this.element.contains(target) && event instanceof MouseEvent) {
      const hit = this.hitAt(...this.layoutPoint(event));
      if (hit?.kind === "action" && hit.action === "notes") return;
    }
    this.closeNotes();
  };
  handleKey = (event) => {
    if (event.key === "Escape") this.closeNotes();
  };
  handleScroll = (event) => {
    if (!this.popover?.popover.contains(event.target)) this.closeNotes();
  };
  destroy() {
    this.root = void 0;
    this.listeners.clear();
    this.stateTween.stop();
    this.zoomTween.stop();
    this.closeNotes();
    this.element.removeEventListener("click", this.handleClick);
    this.element.removeEventListener("pointermove", this.handleHover);
    this.setCursor("");
    this.pendingFit?.disconnect();
    this.selection.on(".zoom", null);
    this.backend.destroy();
    this.element.classList.remove("markmap", this.scopeClass);
  }
  /** Show that a target is clickable, whatever the backend draws it with. */
  handleHover = (event) => {
    const pointer2 = event;
    if (pointer2.buttons) return;
    this.setCursor(this.hitAt(...this.layoutPoint(pointer2)) ? "pointer" : "");
  };
  setCursor(cursor) {
    this.element.style.cursor = cursor;
  }
  handleClick = (event) => {
    if (event.defaultPrevented) return;
    const target = this.hitAt(...this.layoutPoint(event));
    if (target?.kind === "action" && target.action === "notes") {
      if (target.nodeId === this.popover?.id) this.closeNotes();
      else this.openNotes(target.nodeId);
    } else if (target?.kind === "link") {
      if (!this.backend.nativeLinks) this.element.ownerDocument.defaultView?.open(target.href, "_blank", "noopener,noreferrer");
    } else if (target?.kind === "toggle") this.toggle(target.nodeId);
  };
};
function interpolateZoom(a, b, t, cx, cy) {
  const k = a.k * (b.k / a.k) ** t;
  const x = (cx - a.x) / a.k * (1 - t) + (cx - b.x) / b.k * t;
  const y = (cy - a.y) / a.k * (1 - t) + (cy - b.y) / b.k * t;
  return identity2.translate(cx - x * k, cy - y * k).scale(k);
}
function sameSet(a, b) {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

// extensions/scripts/mindmap-vendor/entry.js
function restoreTransform(map, transform2) {
  select(map.element).call(zoom2().transform, transform2);
  map.backend.setTransform(transform2);
}
export {
  Markmap,
  resolveViewOptions,
  restoreTransform
};
