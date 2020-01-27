(function() {

    window.addEventListener('load', init, false);

    var engine = Engine;
    var width, height, scene, camera, renderer;
    var material, circle, meshes;

    function init() {
        createScene();
        addParticles(5000);
        doLoop();
    }

    function createScene() {
        width = window.innerWidth;
        height = window.innerHeight;
        aspectRatio = width/height;
        nearPlane = 0;
        farPlane = 1;

        camera = new THREE.OrthographicCamera( 0, width, height, 0, nearPlane, farPlane);
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

        engine.init(width, height);
    }

    function handleWindowResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        aspectRatio = width/height;
        renderer.setSize(width, height);
        camera.aspect = aspectRatio;
        camera.left = 0;
        camera.right = width;
        camera.top = height;
        camera.bottom = 0;
        camera.updateProjectionMatrix();
        //renderer.render(scene, camera); // TODO remove?
    }

    function handleMouseMove(e) {
        engine.forceVelocity(e.clientX, e.clientY, e.movementX, e.movementY);
        // TODO incorporate window.devicePixelRatio
    }

    function addParticles(n) {
        meshes = new Array(n);
        engine.addParticles(n);

        for (var i = 0; i < n; i++) {
            var m = new THREE.Mesh(circle, material);
            meshes[i] = m;
            scene.add(m);
        }
    }

    function doLoop() {
        engine.doPhysics();
        for (var i = 0; i < meshes.length; i++)
            engine.getParticlePosition(i, meshes[i].position)
        renderer.render(scene, camera);
        requestAnimationFrame(doLoop);
    }

})();