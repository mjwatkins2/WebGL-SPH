(function() {

    window.addEventListener('load', init, false);

    var engine = Engine;
    var width, height, scene, camera, renderer, cube, material, circle, geometry;

    var meshes;

    function init() {
        createScene();
        //addParticles(5000);
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

        scene = new THREE.Scene();

        material = new THREE.LineBasicMaterial( { color: 0x00ff00 } );
        circle = new THREE.CircleBufferGeometry(5, 8);

        geometry = new THREE.BoxGeometry( 100, 100, 1 );
        cube = new THREE.Mesh( geometry, material );
        //scene.add( cube );
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
        // cube.scale.x = cube.scale.y * aspectRatio;
        renderer.render(scene, camera); // TODO move to animation loop?
    }

    //var particles;

    function addParticles(n) {
        meshes = new Array(n);
        engine.addParticles(n);

        for (var i = 0; i < n; i++) {
            var m = new THREE.Mesh(circle, material);
            meshes[i] = m;
            scene.add(m);
        }

        /*particles = new Array(n);
        for (var i = 0; i < n; i++)
            particles[i] = new Particle();*/
    }

    /*function Particle() {
        this.Vx = Math.random()-0.5; // current velocity
        this.Vy = Math.random()-0.5;
        this.rho = 0; // density
        this.P = 0; // pressure
        this.Fx = 0; 
        this.Fy = 0;
        this.forcedVelocity = false;
        this.mesh = new THREE.Mesh(circle, material);
        this.mesh.position.x = Math.random()*width-width/2;
        this.mesh.position.y = Math.random()*height-height/2;
        scene.add(this.mesh);

        this.update = function(dt) {
            this.mesh.position.x += this.Vx * dt;
            this.mesh.position.y += this.Vy * dt
        }
    }*/

    function doLoop() {
        engine.doPhysics();
        var dT = 1;
        for (var i = 0; i < meshes.length; i++)
            engine.update(i, meshes[i].position)
            //particles[i].update(dT);
        renderer.render(scene, camera);
        requestAnimationFrame(doLoop);
    }

})();