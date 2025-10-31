// src/schem-parser.js
import { parse } from "prismarine-nbt";

/**
 * parseSchematic(arrayBuffer) -> Promise<{width, height, length, blocks, palette, getIndex}>
 *
 * "Best-effort" Parser für klassische .schem und Palette-basierte moderne Schematics.
 * Liefert flat blocks array und palette map (id -> blockName) falls vorhanden.
 */
export async function parseSchematic(arrayBuffer) {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const result = await parse(buffer);
    console.log("prismarine-nbt.parse result:", result);

    // tolerant extraction of root
    const root = result && (result.parsed || result.value) ? (result.parsed || result.value) : result;
    const nbtRoot = root && root.value ? root.value : root;

    let schematic = nbtRoot;
    if (nbtRoot && nbtRoot.Schematic) schematic = nbtRoot.Schematic.value || nbtRoot.Schematic;

    const getTag = (obj, name) => {
      if (!obj) return undefined;
      if (obj[name] && obj[name].value !== undefined) return obj[name].value;
      if (obj[name] && Array.isArray(obj[name])) return obj[name];
      if (obj[name] !== undefined && typeof obj[name] !== "object") return obj[name];
      return undefined;
    };

    let Width = getTag(schematic, "Width") || getTag(schematic, "width") || getTag(nbtRoot, "Width");
    let Height = getTag(schematic, "Height") || getTag(schematic, "height") || getTag(nbtRoot, "Height");
    let Length = getTag(schematic, "Length") || getTag(schematic, "length") || getTag(nbtRoot, "Length");

    Width = Number(Width || 0);
    Height = Number(Height || 0);
    Length = Number(Length || 0);

    // Classic fields
    const BlocksTag = schematic.Blocks || schematic.blocks;
    const DataTag = schematic.Data || schematic.data;
    const Blocks = BlocksTag && BlocksTag.value ? BlocksTag.value : (Array.isArray(BlocksTag) ? BlocksTag : undefined);

    // Palette / BlockData
    const PaletteTag = schematic.Palette || schematic.palette;
    const BlockDataTag = schematic.BlockData || schematic.blockData;
    const BlockStatesTag = schematic.BlockStates || schematic.blockStates;

    let blocksFlat;
    let paletteMap = null;

    if (Blocks && Width && Height && Length) {
      const arr = Uint8Array.from(Blocks);
      blocksFlat = new Uint16Array(arr.length);
      for (let i = 0; i < arr.length; i++) blocksFlat[i] = arr[i];
      paletteMap = {};
    } else if (PaletteTag && (BlockDataTag || BlockStatesTag) && Width && Height && Length) {
      // build palette map id -> name
      paletteMap = {};
      const paletteObj = PaletteTag.value || PaletteTag;
      if (paletteObj && typeof paletteObj === "object") {
        // keys usually block names, values can be int or object
        let idxFallback = 0;
        for (const [k, v] of Object.entries(paletteObj)) {
          let id = undefined;
          if (v && v.value !== undefined) id = v.value;
          else if (typeof v === "number") id = v;
          else id = idxFallback++;
          paletteMap[id] = k;
        }
      }
      const total = Width * Height * Length;
      if (BlockDataTag && Array.isArray(BlockDataTag) && BlockDataTag.length === total) {
        blocksFlat = new Uint32Array(BlockDataTag);
      } else if (BlockStatesTag) {
        try {
          const raw = Array.from(BlockStatesTag.value || BlockStatesTag);
          blocksFlat = new Uint32Array(total);
          const paletteSize = Object.keys(paletteMap).length || 1;
          const bitWidth = Math.max(1, Math.ceil(Math.log2(paletteSize)));
          let outIndex = 0;
          for (let i = 0; i < raw.length && outIndex < total; i++) {
            let word = raw[i];
            if (word && word.value !== undefined) word = word.value;
            let big = BigInt(Number(word));
            for (let shift = 0; shift < 64 && outIndex < total; shift += bitWidth) {
              const mask = (BigInt(1) << BigInt(bitWidth)) - BigInt(1);
              const val = Number((big >> BigInt(shift)) & mask);
              blocksFlat[outIndex++] = val;
            }
          }
          while (outIndex < total) blocksFlat[outIndex++] = 0;
        } catch (e) {
          console.warn("BlockStates decode failed, filling with zeros", e);
          blocksFlat = new Uint32Array(Width * Height * Length);
        }
      } else {
        blocksFlat = new Uint32Array(Width * Height * Length);
      }
    } else {
      throw new Error("Unbekanntes oder nicht unterstütztes Schematic-Format (keine Blocks/Palette gefunden).");
    }

    const getIndex = (x, y, z) => x + z * Width + y * Width * Length;

    return {
      width: Width,
      height: Height,
      length: Length,
      blocks: blocksFlat,
      palette: paletteMap,
      getIndex
    };
  } catch (err) {
    console.error("parseSchematic error:", err);
    throw err;
  }
}