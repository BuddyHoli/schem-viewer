// src/main.js
import "./polyfills.js"; // Buffer-Polyfill
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { parseSchematic } from "./schem-parser.js";

const fileInput = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");
const layerRange = document.getElementById("layerRange");
const layerLabel = document.getElementById("layerLabel");
const layerCanvas = document.getElementById("layerCanvas");
const exportLayerBtn = document.getElementById("exportLayerBtn");
const toggleAir = document.getElementById("toggleAir");

let scene, camera, renderer, controls;
let currentModel = null;
let schematicData = null;
let cubeSize = 1;
let instancedMeshes = [];

initThree();

fileInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  console.log("Selected file:", f.name, f.size, f.type);
  const name = f.name.toLowerCase();
  try {
    if (name.endsWith(".obj")) {
      await loadOBJFile(f);
    } else if (name.endsWith(".schem") || name.endsWith(".nbt")) {
      await loadSchemFile(f);
    } else {
      alert("Unbekanntes Dateiformat. Unterstützt: .schem, .nbt, .obj");
    }
  } catch (err) {
    console.error("Fehler beim Laden der Datei:", err);
    alert("Fehler beim Laden: " + (err && err.message ? err.message : err));
  }
});

layerRange.addEventListener("input", () => {
  const y = Number(layerRange.value);
  layerLabel.textContent = y;
  renderLayerCanvas(y);
});

exportLayerBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `layer-${layerRange.value}.png`;
  link.href = layerCanvas.toDataURL("image/png");
  link.click();
});

toggleAir.addEventListener("change", () => {
  if (schematicData) renderSchematic(schematicData);
});

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
  camera.position.set(30, 30, 30);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(50, 100, 50);
  scene.add(dir);

  window.addEventListener("resize", onResize);
  animate();
}

function onResize() {
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

/* -------------------------------
   OBJ loader (improved)
   ------------------------------- */
async function loadOBJFile(file) {
  clearScene();
  schematicData = null;

  const text = await file.text();
  if (!text || text.trim().length === 0) {
    console.warn("OBJ file is empty or contains no text.");
    alert("OBJ ist leer oder ungültig.");
    return;
  }

  try {
    const loader = new OBJLoader();
    const obj = loader.parse(text);

    let hasGeometry = false;
    obj.traverse((child) => {
      if (child.isMesh) hasGeometry = true;
    });
    if (!hasGeometry) {
      console.warn("OBJ enthält keine Meshes (keine sichtbare Geometrie gefunden).");
    }

    obj.traverse((child) => {
      if (child.isMesh) {
        if (!child.material) {
          child.material = new THREE.MeshLambertMaterial({ color: 0x999999 });
        } else {
          child.material.needsUpdate = true;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(obj);
    currentModel = obj;
    fitCameraToObject(obj);
    console.log("OBJ geladen und zur Szene hinzugefügt.", { obj });
  } catch (err) {
    console.error("Fehler beim Parsen/Rendern der OBJ:", err);
    alert("Fehler beim Parsen der OBJ: " + err.message);
  }
}

/* -------------------------------
   Schematic loader (improved)
   ------------------------------- */
async function loadSchemFile(file) {
  clearScene();
  schematicData = null;
  const buffer = await file.arrayBuffer();
  try {
    console.log("Parsing schematic...");
    const parsed = await parseSchematic(buffer);
    console.log("Schematic parsed:", parsed);
    schematicData = parsed;
    renderSchematic(parsed);
    setupLayerControls(parsed);
  } catch (err) {
    console.error("Fehler beim Parsen der Schematic:", err);
    alert("Fehler beim Parsen der Schematic: " + (err && err.message ? err.message : err));
  }
}

function clearScene() {
  if (currentModel) {
    try { scene.remove(currentModel); } catch (e) {}
    currentModel = null;
  }
  for (const m of instancedMeshes) {
    try { scene.remove(m); } catch (e) {}
  }
  instancedMeshes = [];
}

function renderSchematic(schem) {
  clearScene();
  const { width, height, length, blocks, palette, getIndex } = schem;
  console.log("renderSchematic dims:", width, height, length);

  if (!width || !height || !length || !blocks) {
    console.warn("Ungültige Schematic-Daten, Abbruch des Renderns.", schem);
    alert("Ungültige Schematic-Daten (leere Dimensionen).");
    return;
  }

  function colorForId(id) {
    if (palette && palette[id]) {
      const name = palette[id];
      return colorForName(name);
    }
    const map = {
      0: 0x000000,
      1: 0x8a8a8a,
      2: 0x66aa44,
      3: 0x8b5a2b,
      4: 0x6f6f6f,
      17: 0x8b5a2b,
      20: 0xaad0ff,
      35: 0xff7f50
    };
    return map[id] ?? 0x999999;
  }
  function colorForName(name) {
    if (!name) return 0x999999;
    const low = String(name).toLowerCase();
    if (low.includes("air")) return 0x000000;
    if (low.includes("stone")) return 0x8a8a8a;
    if (low.includes("dirt")) return 0x8b5a2b;
    if (low.includes("grass")) return 0x66aa44;
    if (low.includes("planks")) return 0xd2a679;
    if (low.includes("log")) return 0x6f4a2f;
    if (low.includes("glass")) return 0xaad0ff;
    if (low.includes("wool")) return 0xff7f50;
    if (low.includes("gold")) return 0xffd700;
    if (low.includes("diamond")) return 0x6ee7ff;
    return 0x999999;
  }

  const colorBuckets = new Map();
  let blockCount = 0;

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const idx = getIndex(x, y, z);
        const bid = blocks[idx];
        if (bid === undefined) continue;
        let isAir = false;
        if (palette && palette[bid]) {
          const nm = palette[bid] || "";
          if (String(nm).toLowerCase().includes("air")) isAir = true;
        } else if (bid === 0) isAir = true;
        if (isAir && !toggleAir.checked) continue;

        const color = colorForId(bid);
        if (!colorBuckets.has(color)) colorBuckets.set(color, []);
        const px = x - width / 2 + 0.5;
        const py = y - height / 2 + 0.5;
        const pz = z - length / 2 + 0.5;
        const m = new THREE.Matrix4().makeTranslation(px * cubeSize, py * cubeSize, pz * cubeSize);
        colorBuckets.get(color).push(m);
        blockCount++;
      }
    }
  }

  console.log("Blocks to render:", blockCount, "color groups:", colorBuckets.size);

  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  for (const [color, matrices] of colorBuckets) {
    const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    instancedMeshes.push(inst);
  }

  const maxDim = Math.max(width, height, length);
  camera.position.set(maxDim * 1.2, maxDim * 1.2, maxDim * 1.2);
  controls.target.set(0, 0, 0);
  controls.update();

  renderLayerCanvas(0);
}

function setupLayerControls(schem) {
  layerRange.min = 0;
  layerRange.max = schem.height - 1;
  layerRange.value = 0;
  layerLabel.textContent = "0";
  renderLayerCanvas(0);
}

function renderLayerCanvas(y) {
  if (!schematicData) {
    const ctx = layerCanvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);
    return;
  }
  const { width, height, length, blocks, palette, getIndex } = schematicData;
  const ctx = layerCanvas.getContext("2d");
  const cellW = layerCanvas.width / width;
  const cellH = layerCanvas.height / length;
  ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
  for (let z = 0; z < length; z++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y, z);
      const bid = blocks[idx];
      let isAir = false;
      let color = "#cccccc";
      if (palette && palette[bid]) {
        const name = palette[bid];
        if (typeof name === "string" && name.toLowerCase().includes("air")) isAir = true;
        color = colorFromName(name);
      } else {
        if (bid === 0) isAir = true;
        color = colorFromNumeric(bid);
      }
      if (isAir && !toggleAir.checked) {
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = color;
      }
      ctx.fillRect(Math.floor(x * cellW), Math.floor(z * cellH), Math.ceil(cellW), Math.ceil(cellH));
    }
  }

  function colorFromName(name) {
    if (!name) return "#999999";
    const low = name.toLowerCase();
    if (low.includes("air")) return "#ffffff";
    if (low.includes("stone")) return "#8a8a8a";
    if (low.includes("dirt")) return "#8b5a2b";
    if (low.includes("grass")) return "#66aa44";
    if (low.includes("planks")) return "#d2a679";
    if (low.includes("glass")) return "#aaddff";
    if (low.includes("wool")) return "#ff7f50";
    if (low.includes("gold")) return "#ffd700";
    if (low.includes("diamond")) return "#6ee7ff";
    return "#999999";
  }
  function colorFromNumeric(id) {
    const map = {
      0: "#ffffff",
      1: "#8a8a8a",
      2: "#66aa44",
      3: "#8b5a2b",
      4: "#6f6f6f",
      35: "#ff7f50"
    };
    return map[id] ?? "#999999";
  }
}

function fitCameraToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) {
    camera.position.set(center.x + 10, center.y + 10, center.z + 10);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
    return;
  }
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.2;
  camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}