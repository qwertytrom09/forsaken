import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';

const canvas = document.getElementById('scene');
const status = document.getElementById('status');
const loadingDiv = document.getElementById('loading');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(2.5, 1.8, 3.5);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.0, 0);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.9));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(5, 10, 7.5);
dirLight.castShadow = true;
scene.add(dirLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x202226 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Environment map
new RGBELoader()
  .setPath('assets/')
  .load('studio.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
  });

// Postprocessing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
  0.4, 0.4, 0.85
);
composer.addPass(bloomPass);

// FBX loader
const loader = new FBXLoader();
let mixer = null;
let actions = {};
let currentAction = null;

loader.load(
  '/idle.fbx',
  (object) => {
    loadingDiv.style.display = 'none';
    status.textContent = 'Model loaded';

    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    // Scale and center
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 1.5 / Math.max(size.x, size.y, size.z);
    object.scale.setScalar(scale);
    scene.add(object);

    // Animations
    if (object.animations.length > 0) {
      mixer = new THREE.AnimationMixer(object);
      object.animations.forEach((clip) => {
        actions[clip.name] = mixer.clipAction(clip);
      });
      currentAction = actions[Object.keys(actions)[0]];
      currentAction.play();
    }

    controls.target.copy(object.position);
    controls.update();
  },
  (xhr) => {
    const percent = (xhr.loaded / xhr.total) * 100;
    document.getElementById('progress').textContent = percent.toFixed(0) + '%';
  },
  (err) => {
    status.textContent = 'Error loading FBX';
    console.error(err);
  }
);

// GUI controls
const gui = new GUI({ container: document.getElementById('gui') });
const settings = {
  autoRotate: false,
  exposure: 1.0,
  bloomStrength: 0.4,
  bloomThreshold: 0.85,
  bloomRadius: 0.4,
};
gui.add(settings, 'autoRotate').name('Auto Rotate');
gui.add(settings, 'exposure', 0.1, 2).onChange((v) => renderer.toneMappingExposure = v);
gui.add(settings, 'bloomStrength', 0, 2).onChange((v) => bloomPass.strength = v);
gui.add(settings, 'bloomThreshold', 0, 1).onChange((v) => bloomPass.threshold = v);
gui.add(settings, 'bloomRadius', 0, 2).onChange((v) => bloomPass.radius = v);

// Camera presets
const cameraPresets = {
  Front: () => camera.position.set(0, 1.5, 3),
  Side: () => camera.position.set(3, 1.5, 0),
  Top: () => camera.position.set(0, 5, 0),
};
gui.add(cameraPresets, 'Front');
gui.add(cameraPresets, 'Side');
gui.add(cameraPresets, 'Top');

// Animation selector
if (Object.keys(actions).length > 1) {
  gui.add({ animation: Object.keys(actions)[0] }, 'animation', Object.keys(actions))
    .name('Animation')
    .onChange((name) => {
      if (actions[name]) {
        if (currentAction) currentAction.stop();
        currentAction = actions[name];
        currentAction.reset().play();
      }
    });
}

// Resize
function resizeRendererToDisplaySize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    composer.setSize(width, height);
  }
}

// Loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  controls.autoRotate = settings.autoRotate;
  controls.update();

  resizeRendererToDisplaySize();
  composer.render();
});
