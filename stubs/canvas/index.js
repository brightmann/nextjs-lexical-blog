// Minimal stub of the optional native 'canvas' package.
//
// jsdom does `require("canvas")` in a try/catch (top-level jsdom) or behind a
// `typeof Canvas.createCanvas === "function"` check (older nested copies) and
// only uses it for server-side image decoding. This stub satisfies both shapes
// so bundlers (esbuild) can resolve the import and jsdom keeps working without
// the heavy native dependency. Image loading becomes a harmless no-op.
class Image {
  constructor() {
    this.src = "";
    this.onload = null;
    this.onerror = null;
    this.width = 0;
    this.height = 0;
  }
}

function createCanvas() {
  throw new Error("canvas stub: canvas is not available in this environment");
}

function loadImage() {
  return Promise.reject(
    new Error("canvas stub: canvas is not available in this environment"),
  );
}

module.exports = { Image, createCanvas, loadImage };
