
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Configuration ---
const CONFIG = {
    M: 1.0,
    l: 1.0,
    r_min_factor: 1.0,     // Start EXACTLY at horizon
    r_max_factor: 4.0,     // Go further out
    grid_r: 40,
    grid_phi: 80,          // More resolution
    mode: 'embedding'      // 'embedding' or 'poincare'
};


// --- Global State ---
const state = {
    t: 0.0,
    boost: 0.0,  // Lorentz Boost parameter (lambda)
    rotSpatial: 0.0, // Spatial rotation (X¹, X²)
    phi_limit: 1.5
};

// --- Math Functions ---

// 1. Embedding in R^{2,2} - Direct coordinates from (r, φ, t)
// Metric: -(X^{-1})² - (X⁰)² + (X¹)² + (X²)² = -l²
// 
// From article:
// X^{-1} = sqrt(r²/M) * cosh(√M φ)
// X^2 = sqrt(r²/M) * sinh(√M φ)
// X^0 = sqrt(r²/M - l²) * sinh(√M t/l)
// X^1 = sqrt(r²/M - l²) * cosh(√M t/l)
function getEmbeddingCoords(r, phi, t) {
    const M = CONFIG.M;
    const l = CONFIG.l;
    const sqrtM = Math.sqrt(M);

    // Spatial coordinates from (r, φ)
    const term_space = r / sqrtM;
    const arg_phi = sqrtM * phi;

    const X_minus1 = term_space * Math.cosh(arg_phi);
    const X_2 = term_space * Math.sinh(arg_phi);

    // Temporal coordinates from (r, t)
    const inside_sqrt = Math.max(0, (r * r) / M - l * l);
    const term_time = Math.sqrt(inside_sqrt);
    const arg_t = (sqrtM * t) / l;

    const X_0 = term_time * Math.sinh(arg_t);
    const X_1 = term_time * Math.cosh(arg_t);

    return {
        X_minus1: X_minus1,
        X0: X_0,
        X1: X_1,
        X2: X_2
    };
}

// 2. Lorentz Boost in (X⁰, X¹) plane
// Preserves -(X⁰)² + (X¹)²
function rotateBoost(coords, lambda) {
    const ch = Math.cosh(lambda);
    const sh = Math.sinh(lambda);

    // Boost mixes time (X0) and space (X1)
    const X0_new = coords.X0 * ch + coords.X1 * sh;
    const X1_new = coords.X0 * sh + coords.X1 * ch;

    return {
        X_minus1: coords.X_minus1,
        X0: X0_new,
        X1: X1_new,
        X2: coords.X2
    };
}

// 3. Spatial rotation in (X¹, X²) plane
function rotateSpatial(coords, theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    const X1_new = coords.X1 * c - coords.X2 * s;
    const X2_new = coords.X1 * s + coords.X2 * c;

    return {
        X_minus1: coords.X_minus1,
        X0: coords.X0,
        X1: X1_new,
        X2: X2_new
    };
}


// 3. Poincaré Disk Mapping
// We map the radial coordinate r to a disk radius R_disk.
// New Mapping: R_disk = tanh(r / l)
// This strictly maps [0, inf) to [0, 1).
// The horizon is at r_h. So the "hole" radius will be tanh(r_h / l).
// Since r_h = l * sqrt(M), this means Hole Radius = tanh(sqrt(M)).
// This ensures the visual size changes with Mass parameter M.
function getPoincareCoords(r, phi) {
    const l = CONFIG.l;

    // Physical mapping
    // Scale r by l to be dimensionless
    const R_disk = Math.tanh(r / (2 * l)); // Factor of 2 to make it less crowded near edge

    // Z-coordinate: Flat disk (no artificial waves)
    const z = 0;

    const x = R_disk * Math.cos(phi);
    const y = R_disk * Math.sin(phi);

    return { x, y, z };
}

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000); // Increased far clipping plane
camera.position.set(8, 8, 6); // Increased from (3, 3, 2) for better overview
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: false });
if (!renderer.capabilities.isWebGL2 && !renderer.capabilities.isWebGL1) {
    throw new Error("Your browser does not support WebGL, which is required for this visualization.");
}
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    alert('WebGL Context Lost. Please reload the page.');
}, false);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0x606060);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 5, 10);
scene.add(dirLight);

// --- Mesh Generation ---
// Using a dense grid
const geometry = new THREE.PlaneGeometry(1, 1, CONFIG.grid_r, CONFIG.grid_phi);
const material = new THREE.MeshPhongMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
    shininess: 60,
    flatShading: false
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Wireframe
const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.1 });
const wireMesh = new THREE.Mesh(geometry, wireMat);
scene.add(wireMesh);

// Horizon Indicator (Special Mesh)
const horizonGeo = new THREE.TorusGeometry(1, 0.02, 16, 100);
const horizonMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
scene.add(horizonMesh);


// --- Helpers ---
const axesHelper = new THREE.AxesHelper(5); // Increased from 1.5 to 5
scene.add(axesHelper);

// Axis Labels
function createLabel(text, position, color, size = 0.3) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = '20px Arial'; // Smaller font
    ctx.fillText(text, 10, 22);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(size, size * 0.5, 1);
    return sprite;
}

const label_Xm1 = createLabel('X⁻¹', new THREE.Vector3(5.5, 0, 0), '#ff0000', 0.5);
const label_X1 = createLabel('X¹', new THREE.Vector3(0, 5.5, 0), '#00ff00', 0.5);
const label_X2 = createLabel('X²', new THREE.Vector3(0, 0, 5.5), '#0088ff', 0.5);

//Numerical Ticks (smaller)
const tick1X = createLabel('1', new THREE.Vector3(1, 0, -0.2), '#888', 0.25);
const tick1Y = createLabel('1', new THREE.Vector3(0, 1, -0.2), '#888', 0.25);
const tick2X = createLabel('2', new THREE.Vector3(2, 0, -0.2), '#888', 0.25);
const tick2Y = createLabel('2', new THREE.Vector3(0, 2, -0.2), '#888', 0.25);
const tick0 = createLabel('0', new THREE.Vector3(-0.2, -0.2, -0.2), '#888', 0.25);

scene.add(label_Xm1);
scene.add(label_X1);
scene.add(label_X2);
scene.add(tick1X);
scene.add(tick1Y);
scene.add(tick2X);
scene.add(tick2Y);
scene.add(tick0);

// Poincaré disk grid (polar grid)
const diskGridHelper = new THREE.PolarGridHelper(1, 8, 8, 64, 0x444444, 0x222222);
diskGridHelper.visible = false;
scene.add(diskGridHelper);

// Precompute logical coordinates
const vertexCount = geometry.attributes.position.count;
const logicCoords = new Float32Array(vertexCount * 2); // r, phi

// Initialize Mesh Data
// Initialize Mesh Data
function initGrid() {
    const widthVerts = CONFIG.grid_r + 1;
    const heightVerts = CONFIG.grid_phi + 1;
    const r_h = CONFIG.l * Math.sqrt(CONFIG.M);
    const r_start = r_h * CONFIG.r_min_factor;
    // Use state.r_max if available, otherwise fallback to CONFIG (though we will sync them)
    // Actually, let's use CONFIG.r_max_factor as the source of truth which is updated by UI
    const r_end = r_h * CONFIG.r_max_factor;

    const colors = [];
    const colorObj = new THREE.Color();

    for (let i = 0; i < vertexCount; i++) {
        // Grid indices
        const ix = i % widthVerts; // r index
        const iy = Math.floor(i / widthVerts); // phi index

        const u = ix / CONFIG.grid_r;
        const v = iy / CONFIG.grid_phi;

        const r = r_start + u * (r_end - r_start);

        // Phi range depends on mode
        // For Poincare: 0 to 2pi (Full donut)
        // For Embedding: Limited range (Strip)
        // We will update phi dynamically or store "normalized" phi
        const phi_normalized = v; // 0 to 1

        logicCoords[2 * i] = r;
        logicCoords[2 * i + 1] = phi_normalized;

        // Static Color (Radius based) - Highlighting Horizon
        // Horizon (u=0) = Red (Hue 0.0) -> Hot
        // Outer (u=1) = Blue (Hue 0.6) -> Cold
        const t_c = u;
        colorObj.setHSL(0.0 + 0.6 * t_c, 1.0, 0.5); // Red (0.0) -> Blue (0.6)
        colors.push(colorObj.r, colorObj.g, colorObj.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true; // Ensure colors update when grid changes
}

function updateMesh() {
    const positions = geometry.attributes.position.array;
    const r_h = CONFIG.l * Math.sqrt(CONFIG.M);

    // Determine Phi range
    let phi_min, phi_max;
    if (CONFIG.mode === 'poincare') {
        phi_min = 0;
        phi_max = 2 * Math.PI;
        horizonMesh.visible = true;
    } else {
        phi_min = -state.phi_limit;
        phi_max = state.phi_limit;
        horizonMesh.visible = false; // Horizon line doesn't make sense in open strip 4D view easily
    }

    for (let i = 0; i < vertexCount; i++) {
        const r = logicCoords[2 * i];
        const phi_norm = logicCoords[2 * i + 1];
        const phi = phi_min + phi_norm * (phi_max - phi_min);

        if (CONFIG.mode === 'embedding') {
            // 4D Embedding View: 
            // 1. Generate base coords
            const base = getEmbeddingCoords(r, phi, state.t);
            // 2. Apply Lorentz Boost in (X0, X1)
            const boosted = rotateBoost(base, state.boost);
            // 3. Apply Spatial Rotation in (X1, X2)
            const rot = rotateSpatial(boosted, state.rotSpatial);

            // Map to 3D visualization axes: (X⁻¹, X¹, X²)
            positions[3 * i] = rot.X_minus1;  // x-axis
            positions[3 * i + 1] = rot.X1;    // y-axis
            positions[3 * i + 2] = rot.X2;    // z-axis

        } else {
            // Poincare View
            const res = getPoincareCoords(r, phi);
            positions[3 * i] = res.x;
            positions[3 * i + 1] = res.y;
            positions[3 * i + 2] = res.z; // Flat disk, no artifacts
        }
    }

    // Update Horizon Indicator for Poincare Mode
    if (CONFIG.mode === 'poincare') {
        // Horizon radius in physical units: r_h = l * sqrt(M)
        // Poincaré disk radius: R_disk = tanh(r_h / (2*l)) = tanh(sqrt(M)/2)
        // This correctly depends on M but is independent of l (as it should be for normalized coords)
        const r_h_disk = Math.tanh(Math.sqrt(CONFIG.M) / 2);
        horizonMesh.rotation.set(0, 0, 0);
        horizonMesh.scale.set(r_h_disk, r_h_disk, 1);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

// --- Interaction ---
const ui_mode = document.getElementById('viz-mode');
const ui_time = document.getElementById('time');
const ui_boost = document.getElementById('param-boost');
const ui_rotSpatial = document.getElementById('rotSpatial');

const ui_param_M = document.getElementById('param-M');
const ui_param_l = document.getElementById('param-l');
const ui_phi_limit = document.getElementById('param-phi-limit');
const ui_r_max_factor = document.getElementById('param-r-max');

const ui_time_min = document.getElementById('time-min');
const ui_time_max = document.getElementById('time-max');

const val_time = document.getElementById('time-val');
const val_boost = document.getElementById('param-boost-val');
const val_rotSpatial = document.getElementById('rotSpatial-val');

function updateState() {
    state.t = parseFloat(ui_time.value);
    state.boost = parseFloat(ui_boost.value);
    state.rotSpatial = parseFloat(ui_rotSpatial.value);
    CONFIG.mode = ui_mode.value;

    // Update labels
    val_time.innerText = state.t.toFixed(2);
    val_boost.innerText = state.boost.toFixed(2);
    val_rotSpatial.innerText = state.rotSpatial.toFixed(2);
}

// UI Elements
const ui_param_M = document.getElementById('param-M');
const ui_param_l = document.getElementById('param-l');
const ui_param_tau = document.getElementById('param-tau'); // New Inverse Temp Slider
const ui_phi_limit = document.getElementById('param-phi-limit');
const ui_r_max_factor = document.getElementById('param-r-max');

// Parameter values display
const val_M = document.getElementById('val-M');
const val_l = document.getElementById('val-l');
const val_tau = document.getElementById('val-tau'); // New Inverse Temp Display
const val_phi = document.getElementById('val-phi');
const val_r_max = document.getElementById('val-r-max');

let isUpdating = false; // Flag to prevent infinite loop in coupled updates

function updateParams(source) {
    if (isUpdating) return;
    isUpdating = true;

    let new_M = parseFloat(ui_param_M.value);
    let new_l = parseFloat(ui_param_l.value);
    let new_tau = parseFloat(ui_param_tau.value);
    const new_phi = parseFloat(ui_phi_limit.value);
    const new_r_max = parseFloat(ui_r_max_factor.value);

    // Coupling Logic: tau = l / sqrt(M)  =>  M = (l / tau)^2
    if (source === 'tau') {
        // User changed tau -> calculate M
        // Avoid division by zero
        if (new_tau < 0.01) new_tau = 0.01;
        new_M = Math.pow(new_l / new_tau, 2);

        // Update M slider UI
        ui_param_M.value = new_M;
    } else if (source === 'M' || source === 'l') {
        // User changed M or l -> calculate tau
        if (new_M < 0.001) new_M = 0.001; // Avoid sqrt(negative) or zero
        new_tau = new_l / Math.sqrt(new_M);

        // Update tau slider UI
        ui_param_tau.value = new_tau;
    }

    // Update value labels
    val_M.innerText = new_M.toFixed(2);
    val_l.innerText = new_l.toFixed(2);
    val_tau.innerText = new_tau.toFixed(2);
    val_phi.innerText = new_phi.toFixed(1);
    val_r_max.innerText = new_r_max.toFixed(1);

    // Check if grid regeneration needed
    if (Math.abs(new_M - CONFIG.M) > 0.001 || Math.abs(new_l - CONFIG.l) > 0.001 || new_phi !== state.phi_limit || new_r_max !== CONFIG.r_max_factor) {
        CONFIG.M = new_M;
        CONFIG.l = new_l;
        CONFIG.r_max_factor = new_r_max;
        state.phi_limit = new_phi;
        initGrid();
    }

    isUpdating = false;
}

function updateRanges() {
    ui_time.min = ui_time_min.value;
    ui_time.max = ui_time_max.value;
}

// Event Listeners
[ui_time, ui_boost, ui_rotSpatial].forEach(el => el.addEventListener('input', updateState));

updateParams();
updateMesh();
}));

// Range Inputs
[ui_time_min, ui_time_max].forEach(el => el.addEventListener('change', updateRanges));

// UI Toggle Logic (Mobile)
const ui_container = document.getElementById('ui-container');
const ui_toggle = document.getElementById('ui-toggle');

ui_toggle.addEventListener('click', () => {
    ui_container.classList.toggle('hidden-mobile');
});

// Initial State: Hide panel on small screens
if (window.innerWidth <= 768) {
    ui_container.classList.add('hidden-mobile');
}

// Mode Switch
ui_mode.addEventListener('change', () => {
    updateState();
    if (CONFIG.mode === 'poincare') {
        controls.reset();
        camera.position.set(0, 0, 3.5); // Increased for better view
        camera.lookAt(0, 0, 0);
        axesHelper.visible = false;
        diskGridHelper.visible = true;
        // Hide 3D axis labels in Poincaré mode
        label_Xm1.visible = false;
        label_X1.visible = false;
        label_X2.visible = false;
        tick1X.visible = false;
        tick1Y.visible = false;
        tick2X.visible = false;
        tick2Y.visible = false;
        tick0.visible = false;
    } else {
        controls.reset();
        camera.position.set(8, 8, 6); // Updated to match initial position
        axesHelper.visible = true;
        diskGridHelper.visible = false;
        // Show 3D axis labels in Embedding mode
        label_Xm1.visible = true;
        label_X1.visible = true;
        label_X2.visible = true;
        tick1X.visible = true;
        tick1Y.visible = true;
        tick2X.visible = true;
        tick2Y.visible = true;
        tick0.visible = true;
    }
    updateMesh();
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Loop
initGrid(); // Initial generation
updateState(); // Initial state sync

function animate() {
    requestAnimationFrame(animate);
    updateMesh(); // Dynamic update every frame
    controls.update();
    renderer.render(scene, camera);
}
animate();
