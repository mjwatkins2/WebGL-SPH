let Engine = (function() {

    function Particle() {
        this.x = Math.random()*xmax-xmax/2;
        this.y = Math.random()*ymax-ymax/2;
        this.Vx = Math.random()-0.5; // current velocity
        this.Vy = Math.random()-0.5;
        this.rho = 0; // density
        this.P = 0; // pressure
        this.Fx = 0; 
        this.Fy = 0;
        this.forcedVelocity = false;
    
        this.update = function(dt) {
            this.x += this.Vx * dt;
            this.y += this.Vy * dt
        }

        this.reset = function(Ax, Ay) {
            this.Fx = 0;
            this.Fy = 0;
            this.rho = m * Wpoly6(0);
        }
    }

    function Grid() {

        function Cell() {
            this.particles = new Array(MAX_PARTICLES_IN_CELL);
            this.halfNeighbors = new Array(0);
            this.numParticles = 0;
        }

        const MAX_PARTICLES_IN_CELL = 50;
        this.cells = [];
        this.nx = 0; // # of cells in x direction
        this.ny = 0; // # of cells in y direction
        this.w = 0; // domain width
        this.y = 0; // domain height

        this.init = function(nx, ny, w, h) {
            this.nx = nx;
            this.ny = ny;
            this.w = w;
            this.h = h;
            let numCells = nx*ny;
            this.cells = new Array(numCells);
            for (let i = 0; i < numCells; i++)
                this.cells[i] = new Cell();
            for (let i = 0; i < nx; i++) {
                for (let j = 0; j < ny; j++) {
                    let c = this.cells[i+j*nx]
                    this.computeNeighbors(i, j, c);
                    /*for ( let n of c.halfNeighbors) {
                        if (n == null) {
                            let a = 1;
                        }
                    }*/
                }
            }
        }

        this.computeNeighbors = function(i, j, c) {
            let idx = i + j*this.nx;
            if (i != this.nx - 1) {
                c.halfNeighbors.push(this.cells[idx + 1]);
            }
            if (j != this.ny - 1) {
                for (let i2 = Math.max(0, i-1); i2 <= Math.min(this.nx-1, i+1); i2++) {
                    c.halfNeighbors.push(this.cells[idx + this.nx + i2 - i]);
                }
            }
        }

        this.reset = function() {
            for (let c of this.cells)
                c.numParticles = 0;
        }

        this.addParticleToCell = function(p) {
            let i = parseInt(this.nx * p.x / this.w);
            let j = parseInt(this.ny * p.y / this.h);
            let c = this.cells[i + j*this.nx];
            if (c.numParticles < MAX_PARTICLES_IN_CELL) {
                c.particles[c.numParticles++] = p;
            }
        }
    }

    let particles;
    let grid;

    let h = 1;     // smoothing length
    let h2 = Math.pow(h, 2);
    let h5 = Math.pow(h, 5);
    let h6 = Math.pow(h, 6);
    let h9 = Math.pow(h, 9);
    let Wpoly6_coeff = 315.0 / (64 * Math.PI * h9);
    let Wspiky_grad_coeff = -45.0 / (Math.PI * h6);
    let Wvisc_lapl_coeff = 45.0 / (Math.PI * h5);
    let m = 1.0;	    // Particle mass
    let k = 120;				// Gas constant
    let rho0 = 0;			// Rest density
    let mu = 3;				// Viscosity
    let gx = 0;				// Gravity-x
    let gy = -32.2 * 50 / 100;				// Gravity-y
    let xmax, ymax;
    let domainScale = 30;
    let gridCellSize = h;
    let lastTime = performance.now();
    /*let Grid grid;
    private bool forceVelocityOn = false;
    private Cell forceVelocityCell;
    private double forceVx;
    private double forceVy;
    private Random rand = new Random();
    private int numCircleDrawPoints = 8;
    private double drawScale;
    private double[] drawCos = new double[16];
    private double[] drawSin = new double[16];
    private double[] SlowColor = new double[3];
    private double[] FastColor = new double[3];
    FluidSimSettings.DrawMethod DrawMethod;
    Timer t = new Timer();
    bool drip = false;
    Boat boat;*/

    // assumption: r2 is less than h2
    function Wpoly6(r2) {
        let temp = h2 - r2;
        return Wpoly6_coeff * temp * temp * temp;
    }

    // assumption: r is less than h
    function Wspiky_grad2(r) {
        let temp = h - r;
        return Wspiky_grad_coeff * temp * temp / r;
    }

    // assumption: r is less than h
    function Wvisc_lapl(r) {
        return Wvisc_lapl_coeff * (1 - r / h);
    }

    function dist2(p1, p2) {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        return dx * dx + dy * dy;
    }

    function AddDensity(p1, p2) {
        let r2 = dist2(p1, p2);
        if (r2 < h2) {
            let temp = m * Wpoly6(r2);
            p1.rho += temp;
            p2.rho += temp;
        }
    }

    function CalcDensity() {
        for (const cell of grid.cells) {
            for (let i = 0; i < cell.numParticles; i++) {
                const p1 = cell.particles[i];
                //p1.rho = 0;
                // interactions between particles in this cell
                for (let j = i + 1; j < cell.numParticles; j++) {
                    const p2 = cell.particles[j];
                    AddDensity(p1, p2);
                }
                // interactions between particles in neighbor cells
                for (let neighbor of cell.halfNeighbors) {
                    for (let j = 0; j < neighbor.numParticles; j++) {
                        const p2 = neighbor.particles[j];
                        AddDensity(p1, p2);
                    }
                }
                p1.P = k * (p1.rho - rho0);
            }
        }
    }

    function AddForces(p1, p2) {
        let r2 = dist2(p1, p2);
        if (r2 < h2) {
            let r = Math.sqrt(r2) + 1e-6; // add a tiny bit to avoid divide by zero
            // Eqn. 2.23 pressure-force
            let temp1 = m * (p2.P + p1.P) / (2 * p2.rho) * Wspiky_grad2(r);
            let Fx = temp1 * (p2.x - p1.x);
            let Fy = temp1 * (p2.y - p1.y);
            // Eqn. 2.26 viscosity-force
            let temp2 = mu * m * Wvisc_lapl(r) / p2.rho;
            Fx += temp2 * (p2.Vx - p1.Vx);
            Fy += temp2 * (p2.Vy - p1.Vy);
            p1.Fx += Fx;
            p1.Fy += Fy;
            p2.Fx -= Fx;
            p2.Fy -= Fy;
        }
    }

    function CalcForces() {
        for (const cell of grid.cells) {
            for (let i = 0; i < cell.numParticles; i++) {
                const p1 = cell.particles[i];
                // interactions between particles in this cell
                for (let j = i + 1; j < cell.numParticles; j++) {
                    const p2 = cell.particles[j];
                    AddForces(p1, p2);
                }
                // interactions between particles in neighbor cells
                for (let neighbor of cell.halfNeighbors) {
                    for (let j = 0; j < neighbor.numParticles; j++) {
                        const p2 = neighbor.particles[j];
                        AddForces(p1, p2);
                    }
                }
            }
        }
    }

    function UpdatePosition(dT) {
        for (let p of particles) {
            let Ax = p.Fx / p.rho + gx;
            let Ay = p.Fy / p.rho + gy;

            p.Vx += Ax * dT;
            p.Vy += Ay * dT;

            p.x += p.Vx * dT;
            p.y += p.Vy * dT;

            if (p.x < 0) {
                p.x = 0 + 1e-6;
                p.Vx *= -0.5;
            }
            else if (p.x > xmax) {
                p.x = xmax - 1e-6;
                p.Vx *= -0.5;
            }
            if (p.y < 0) {
                p.y = 0 + 1e-6;
                p.Vy *= -0.5;
            } else if (p.y > ymax) {
                p.y = ymax - 1e-6;
                p.Vy *= -0.5;
            }

            grid.addParticleToCell(p);
            
            p.reset(Ax, Ay);
        }
    }

    return {

        init: function(width, height) {
            xmax = width / domainScale;
            ymax = height / domainScale;

            let numGridCellsX = Math.floor(xmax / gridCellSize);
            let numGridCellsY = Math.floor(ymax / gridCellSize);
            grid = new Grid();
            grid.init(numGridCellsX, numGridCellsY, xmax, ymax);
        },

        addParticles: function(n) {
            particles = new Array(n);
            for (let i = 0; i < n; i++) {
                particles[i] = new Particle();
                particles[i].rho = m * Wpoly6(0);
            }
        },
        
        doPhysics : function() {
            CalcDensity();
            CalcForces();
            grid.reset();
            let now = performance.now();
            UpdatePosition((now - lastTime) * 0.001);
            lastTime = now;
        },

        update: function(i, position) {
            let p = particles[i];
            //p.update(1);
            position.x = p.x * domainScale;
            position.y = p.y * domainScale;
        }
    }
})();
