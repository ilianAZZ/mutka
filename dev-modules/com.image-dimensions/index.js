// COMMUNITY MODULE — "image dimensions" column, runs ISOLATED in a Web Worker.
//
// Reads just enough of each image's header bytes to report its pixel size, like
// Finder's "Dimensions" column. Demonstrates the fs.readBytes capability:
//
// • cellMatch → only image rows get a value; for everything else the provider is
//               never called, so a non-image file is never decoded.
// • fs:read   → host.fs.readBytes(path) returns a Uint8Array, gated by permission.
//
// The parser only inspects the first bytes (PNG/GIF have size in the header; JPEG
// is scanned marker-by-marker to the first SOF), so it's cheap even on big files.
export default {
  id: "com.image-dimensions",
  name: "Image Dimensions",
  version: "1.0.0",
  description: "Add a column reporting each image's pixel size, read from its header bytes.",
  icon: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E%3Crect%20width%3D'24'%20height%3D'24'%20rx%3D'6'%20fill%3D'%232bb673'%2F%3E%3Crect%20x%3D'5'%20y%3D'6'%20width%3D'14'%20height%3D'12'%20rx%3D'1.6'%20stroke%3D'%23fff'%20stroke-width%3D'1.5'%20fill%3D'none'%2F%3E%3Ccircle%20cx%3D'9'%20cy%3D'10'%20r%3D'1.3'%20fill%3D'%23fff'%2F%3E%3Cpath%20d%3D'M6%2016l3.5-3.5L12%2015l2.5-2.5L18%2016'%20stroke%3D'%23fff'%20stroke-width%3D'1.4'%20fill%3D'none'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%2F%3E%3C%2Fsvg%3E",
  author: { name: "Ilian", github: "ilianAZZ" },
  tags: ["images","media","column"],
  permissions: ["fs:read"],
  columns: [
    {
      id: "img.dim",
      label: "Dimensions",
      width: 110,
      align: "end",
      cellMatch: { extensions: ["png", "gif", "jpg", "jpeg"] },
    },
  ],
  setup(host) {
    host.onColumn("img.dim", async (item) => {
      const bytes = await host.fs.readBytes(item.path);
      const size = parseImageSize(bytes, item.extension);
      return size ? { text: `${size.w} × ${size.h}` } : null;
    });
  },
};

function parseImageSize(b, ext) {
  // PNG: 8-byte signature, then IHDR with width/height as big-endian u32 at 16/20.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { w: u32(b, 16), h: u32(b, 20) };
  }
  // GIF: "GIF", then logical screen width/height as little-endian u16 at 6/8.
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  }
  // JPEG: walk the marker segments until a Start-Of-Frame (0xC0..0xCF, sans C4/C8/CC).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]); // skip this segment by its length
    }
  }
  void ext;
  return null;
}

function u32(b, o) {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}
