import * as THREE from './three.module.js'
import { GUI } from './dat.gui.module.js'
import Engine from './engine.js';

window.addEventListener('load', init, false);

let engine = Engine;
let scene, camera, renderer;
let material, circle, meshes;
let left, right, bottom, top, zoomX, zoomY;
let initialOrientation;
let windowMovementInterval = -1;
let paused = false;
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
    attachToDocument();
    setNumParticles(fluidParams['NumParticles']);
    addGUI();
    doLoop();
}

function reinit() {
    initialOrientation = screen.orientation.angle;
    computeWindowArea();
    engine.init(screen.width, screen.height, left, right, bottom, top);
    setNumParticles(fluidParams['NumParticles']);
    doLoop();
}

function createScene() {
    initialOrientation = screen.orientation.angle;
    computeWindowArea();
    engine.init(screen.width, screen.height, left, right, bottom, top);

    let width = right-left;
    let height = top-bottom;
    let nearPlane = 0;
    let farPlane = 1;
    camera = new THREE.OrthographicCamera( left, right, top, bottom, nearPlane, farPlane);
    camera.position.z = 1

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(width * zoomX, height * zoomY);

    material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    circle = new THREE.CircleBufferGeometry(5, 8);

    scene = new THREE.Scene();
    renderer.render(scene, camera);
}

function attachToDocument() {
    document.body.appendChild( renderer.domElement );

    window.addEventListener('resize', handleWindowResize, false);
    window.addEventListener('mouseout', handleMouseOut, false);
    window.addEventListener('visibilitychange', handleVisibilityChange, false);
    renderer.domElement.addEventListener('mousemove', handleMouseMove, false);
    renderer.domElement.addEventListener('touchmove', handleTouchMove, false);
    renderer.domElement.addEventListener('touchend', handleTouchEnd, false);
    renderer.domElement.addEventListener('touchcancel', handleTouchEnd, false);
}

function handleVisibilityChange(e) {
    if (paused && !document.hidden) {
        engine.unpause();
    }
    paused = document.hidden;
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

    let width = right-left;
    let height = top-bottom;
    let aspectRatio = width/height;

    let angleDiff = screen.orientation.angle - initialOrientation;
    if (Math.abs(angleDiff) > 1) {
        reinit();
        // TODO when ScreenOrientation.lock() API is more mature, lock it
    } else {
        engine.resize(left, right, bottom, top);
        renderer.setSize(width * zoomX, height * zoomY);
        camera.rotation.z = 0;
        camera.position.x = 0;
        camera.position.y = 0;
    }
    
    renderer.setSize(width * zoomX, height * zoomY);
    camera.aspect = aspectRatio;
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.updateProjectionMatrix();
}

function computeWindowArea() {
    // the width and height pad/bars estimate can be calculated less than zero on mobile due to zooming
    let widthPadEstimate = Math.max(window.outerWidth - window.innerWidth, 0);
    left = window.screenX + widthPadEstimate/2;
    right = window.screenX + window.outerWidth - widthPadEstimate/2;
    // note positive screen y is measured top-down, positive fluid sim y is measured bottom-up
    // assume address bar, toolbars, favs, menus, are all at the top
    let topBarsHeightEstimate = Math.max(window.outerHeight - window.innerHeight, 0);
    bottom = screen.height - window.screenY - window.outerHeight;
    top = screen.height - window.screenY - topBarsHeightEstimate;

    // on mobile, innerWidth/Height can be larger than outerWidth/Height, requiring some renderer zooming
    zoomX = window.innerWidth > window.outerWidth ? window.innerWidth / window.outerWidth : 1;
    zoomY = window.innerHeight > window.outerHeight ? window.innerHeight / window.outerHeight : 1;
    let isProbablyMobileDevice = window.innerWidth > window.outerWidth || window.innerHeight > window.outerHeight;
    if (isProbablyMobileDevice) {
        // also on mobile, just use the entire screen due to keyboards and url input boxes taking up lots'a'space
        left = 0;
        right = screen.width;
        bottom = 0;
        top = screen.height;
    }
}

function handleMouseMove(e) {
    if (windowMovementInterval != -1) {
        clearInterval(windowMovementInterval);
        windowMovementInterval = -1;
    }
    engine.forceVelocity(e.clientX+left, e.clientY/*+bottom*/, e.movementX, e.movementY);
}

let lastX = undefined;
let lastY = undefined;

function handleTouchMove(e) {
    if (windowMovementInterval != -1) {
        clearInterval(windowMovementInterval);
        windowMovementInterval = -1;
    }
    if (e.touches.length > 0) {
        let touch = e.changedTouches[0];
        let tx = touch.clientX/zoomX;
        let ty = touch.clientY/zoomY;
        if (lastX != undefined && lastY != undefined) {
            let dx = tx - lastX;
            let dy = ty - lastY;
            engine.forceVelocity(tx+left, ty/*+bottom*/, dx, dy);
        }
        lastX = tx;
        lastY = ty;
    }
    // TODO incorporate window.devicePixelRatio?
}

function handleTouchEnd(e) {
    lastX = undefined;
    lastY = undefined;
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
