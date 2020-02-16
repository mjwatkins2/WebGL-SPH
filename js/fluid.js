import * as THREE from './three.module.js'
import { GUI } from './dat.gui.module.js'
import Engine from './engine.js';

window.addEventListener('load', init, false);

let engine = Engine;
let scene, camera, renderer;
let material, circle, meshes;
let left, right, bottom, top;
let windowMovementInterval = -1;
let gui = new GUI();
let fluidParams = {
    NumParticles: 1000,
    ParticleMass: 1.0,
    GasConstant: 120.0,
    RestDensity: 0.5,
    Viscosity: 3,
    GravityX: 0,
    GravityY: -20,
    Color: '#00ff00',
    SetDefaults: function() { /* dummy */ } 
}

function init() {
    createScene();
    setNumParticles(fluidParams['NumParticles']);
    addGUI();
    doLoop();
}

function createScene() {
    computeWindowArea();
    engine.init(screen.width, screen.height, left, right, bottom, top);

    let width = right-left;
    let height = top-bottom;
    let aspectRatio = width/height;
    let nearPlane = 0;
    let farPlane = 1;
    camera = new THREE.OrthographicCamera( left, right, top, bottom, nearPlane, farPlane);
    camera.position.z = 1

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    circle = new THREE.CircleBufferGeometry(5, 8);

    scene = new THREE.Scene();
    renderer.render(scene, camera);

    document.body.appendChild( renderer.domElement );

    window.addEventListener('resize', handleWindowResize, false);
    window.addEventListener('mouseout', handleMouseOut, false);
    window.addEventListener('visibilitychange', handleVisibilityChange, false);
}

function handleVisibilityChange(e) {
    console.log('handleVisibilityChange: ' + document.hidden);
}

function handleMouseOut(e){
    // if the mouse leaves the window, watch for window movement on screen and adjust the simulation domain appropriately
    if (windowMovementInterval == -1 && e.toElement == null && e.relatedTarget == null) { // really outside the window
        windowMovementInterval = setInterval(function() {
            let prevL = left;
            let prevR = right;
            let prevB = bottom;
            let prevT = top;
            computeWindowArea();
            if (left != prevL || right != prevR || bottom != prevB || top != prevT) {
                handleWindowResize();
            }
        }, 10);
    }
}

function handleWindowResize() {
    computeWindowArea();
    engine.resize(left, right, bottom, top);
    let width = right-left;
    let height = top-bottom;
    let aspectRatio = width/height;
    renderer.setSize(width, height);

    camera.aspect = aspectRatio;
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.updateProjectionMatrix();
}

function computeWindowArea() {
    left = window.screenX;
    right = window.screenX + window.outerWidth;
    // positive screen y is measured top-down, positive fluid sim y is measured bottom-up
    let topBarsHeightEstimate = window.outerHeight - window.innerHeight; // assume address bar, toolbars, favs, menus, are all at the top
    bottom = screen.height - window.screenY - window.outerHeight;
    top = screen.height - window.screenY - topBarsHeightEstimate;
}

function handleMouseMove(e) {
    if (windowMovementInterval != -1) {
        clearInterval(windowMovementInterval);
        windowMovementInterval = -1;
    }
    engine.forceVelocity(e.clientX+left, e.clientY/*+bottom*/, e.movementX, e.movementY);
    // TODO incorporate window.devicePixelRatio
}

function setNumParticles(n) {
    let i0 = 0;
    if (meshes == undefined) {
        meshes = new Array(n);
    }
    else {
        if (n < meshes.length) {
            for (var i = n; i < meshes.length; i++) {
                scene.remove(meshes[i]);
            }
            meshes.length = n;
        }
        i0 = meshes.length;
    }

    engine.setNumParticles(n);

    for (var i = i0; i < n; i++) {
        var m = new THREE.Mesh(circle, material);
        meshes[i] = m;
        scene.add(m);
    }
}

function addGUI() {
    gui.add(fluidParams, 'NumParticles', 0, 5000).step(10).onFinishChange(function(n) {
        setNumParticles(n);
    });
    gui.add(fluidParams, 'ParticleMass', 1, 1000).onChange(updateFluidProperties);
    gui.add(fluidParams, 'GasConstant', 1, 1000).onChange(updateFluidProperties);
    gui.add(fluidParams, 'RestDensity', 0, 10).onChange(updateFluidProperties);
    gui.add(fluidParams, 'Viscosity', 0, 10).onChange(updateFluidProperties);;
    gui.add(fluidParams, 'GravityX', -100, 100).step(10).onChange(updateGravity);
    gui.add(fluidParams, 'GravityY', -100, 100).step(10).onChange(updateGravity);
    gui.addColor(fluidParams, 'Color').onChange(function(c) {
        material.color.set(c);
    });
    gui.add(fluidParams, 'SetDefaults').onChange(function() {
        for (var i in gui.__controllers) {
            let controller = gui.__controllers[i];
            if (controller.property != 'SetDefaults') {
                controller.setValue(controller.initialValue);
            }
        }
        setNumParticles(fluidParams['NumParticles']);
    });
}

function updateGravity() {
    engine.setGravity(fluidParams['GravityX'], fluidParams['GravityY']);
}

function updateFluidProperties() {
    let mass = fluidParams['ParticleMass'];
    let gasConstant = fluidParams['GasConstant'];
    let restDensity = fluidParams['RestDensity'];
    let viscosity = fluidParams['Viscosity']
    engine.setFluidProperties(mass, gasConstant, restDensity, viscosity);
}

function doLoop() {
    engine.doPhysics();
    for (var i = 0; i < meshes.length; i++)
        engine.getParticlePosition(i, meshes[i].position)
    renderer.render(scene, camera);
    requestAnimationFrame(doLoop);
}
