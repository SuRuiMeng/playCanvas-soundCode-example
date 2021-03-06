// Mr F
Object.assign(pc, function () {
    var particleVerts = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
    ];

    var _createTexture = function (device, width, height, pixelData, format, mult8Bit, filter) {
        if (!format) format = pc.PIXELFORMAT_RGBA32F;

        var mipFilter = pc.FILTER_NEAREST;
        if (filter && format === pc.PIXELFORMAT_R8_G8_B8_A8)
            mipFilter = pc.FILTER_LINEAR;

        var texture = new pc.Texture(device, {
            width: width,
            height: height,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: mipFilter,
            magFilter: mipFilter,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
        texture.name = "PSTexture";

        var pixels = texture.lock();

        if (format === pc.PIXELFORMAT_R8_G8_B8_A8) {
            var temp = new Uint8Array(pixelData.length);
            for (var i = 0; i < pixelData.length; i++) {
                temp[i] = pixelData[i] * mult8Bit * 255;
            }
            pixelData = temp;
        }

        pixels.set(pixelData);

        texture.unlock();

        return texture;
    };

    function frac(f) {
        return f - Math.floor(f);
    }

    function encodeFloatRGBA( v ) {
        var encX = frac(v);
        var encY = frac(255.0 * v);
        var encZ = frac(65025.0 * v);
        var encW = frac(160581375.0 * v);

        encX -= encY / 255.0;
        encY -= encZ / 255.0;
        encZ -= encW / 255.0;
        encW -= encW / 255.0;

        return [encX, encY, encZ, encW];
    }

    function encodeFloatRG( v ) {
        var encX = frac(v);
        var encY = frac(255.0 * v);

        encX -= encY / 255.0;
        encY -= encY / 255.0;

        return [encX, encY];
    }

    function saturate(x) {
        return Math.max(Math.min(x, 1), 0);
    }

    function glMod(x, y) {
        return x - y * Math.floor(x / y);
    }

    var default0Curve = new pc.Curve([0, 0, 1, 0]);
    var default1Curve = new pc.Curve([0, 1, 1, 1]);
    var default0Curve3 = new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
    var default1Curve3 = new pc.CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);

    var particleTexHeight = 2;
    var particleTexChannels = 4;

    var velocityVec = new pc.Vec3();
    var localVelocityVec = new pc.Vec3();
    var velocityVec2 = new pc.Vec3();
    var localVelocityVec2 = new pc.Vec3();
    var radialVelocityVec = new pc.Vec3();
    var rndFactor3Vec = new pc.Vec3();
    var particlePosPrev = new pc.Vec3();
    var particlePos = new pc.Vec3();
    var particleFinalPos = new pc.Vec3();
    var moveDirVec = new pc.Vec3();
    var rotMat = new pc.Mat4();
    var rotMatInv = new pc.Mat4();
    var spawnMatrix3 = new pc.Mat3();
    var extentsInnerRatioUniform = new Float32Array(3);
    var emitterMatrix3 = new pc.Mat3();
    var emitterMatrix3Inv = new pc.Mat3();
    var uniformScale = 1;
    var nonUniformScale;
    var spawnMatrix = new pc.Mat4();
    var randomPos = new pc.Vec3();
    var randomPosTformed = new pc.Vec3();
    var tmpVec3 = new pc.Vec3();
    var bMin = new pc.Vec3();
    var bMax = new pc.Vec3();

    var setPropertyTarget;
    var setPropertyOptions;

    function setProperty(pName, defaultVal) {
        if (setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
            setPropertyTarget[pName] = setPropertyOptions[pName];
        } else {
            setPropertyTarget[pName] = defaultVal;
        }
    }

    function pack3NFloats(a, b, c) {
        var packed = ((a * 255) << 16) | ((b * 255) << 8) | (c * 255);
        return (packed) / (1 << 24);
    }

    function packTextureXYZ_NXYZ(qXYZ, qXYZ2) {
        var num = qXYZ.length / 3;
        var colors = new Array(num * 4);
        for (var i = 0; i < num; i++) {
            colors[i * 4] = qXYZ[i * 3];
            colors[i * 4 + 1] = qXYZ[i * 3 + 1];
            colors[i * 4 + 2] = qXYZ[i * 3 + 2];

            colors[i * 4 + 3] = pack3NFloats(qXYZ2[i * 3], qXYZ2[i * 3 + 1], qXYZ2[i * 3 + 2]);
        }
        return colors;
    }

    function packTextureRGBA(qRGB, qA) {
        var colors = new Array(qA.length * 4);
        for (var i = 0; i < qA.length; i++) {
            colors[i * 4] = qRGB[i * 3];
            colors[i * 4 + 1] = qRGB[i * 3 + 1];
            colors[i * 4 + 2] = qRGB[i * 3 + 2];

            colors[i * 4 + 3] = qA[i];
        }
        return colors;
    }

    function packTexture5Floats(qA, qB, qC, qD, qE) {
        var colors = new Array(qA.length * 4);
        for (var i = 0; i < qA.length; i++) {
            colors[i * 4] = qA[i];
            colors[i * 4 + 1] = qB[i];
            colors[i * 4 + 2] = 0;

            colors[i * 4 + 3] = pack3NFloats(qC[i], qD[i], qE[i]);
        }
        return colors;
    }

    function packTexture2Floats(qA, qB) {
        var colors = new Array(qA.length * 4);
        for (var i = 0; i < qA.length; i++) {
            colors[i * 4] = qA[i];
            colors[i * 4 + 1] = qB[i];
            colors[i * 4 + 2] = 0;
            colors[i * 4 + 3] = 0;
        }
        return colors;
    }

    var ParticleEmitter = function (graphicsDevice, options) {
        this.graphicsDevice = graphicsDevice;
        var gd = graphicsDevice;
        var precision = 32;
        this.precision = precision;

        this._addTimeTime = 0;


        if (!ParticleEmitter.DEFAULT_PARAM_TEXTURE) {
            // White radial gradient
            var resolution = 16;
            var centerPoint = resolution * 0.5 + 0.5;
            var dtex = new Float32Array(resolution * resolution * 4);
            var x, y, xgrad, ygrad, p, c;
            for (y = 0; y < resolution; y++) {
                for (x = 0; x < resolution; x++) {
                    xgrad = (x + 1) - centerPoint;
                    ygrad = (y + 1) - centerPoint;
                    c = saturate((1 - saturate(Math.sqrt(xgrad * xgrad + ygrad * ygrad) / resolution)) - 0.5);
                    p = y * resolution + x;
                    dtex[p * 4] =     1;
                    dtex[p * 4 + 1] = 1;
                    dtex[p * 4 + 2] = 1;
                    dtex[p * 4 + 3] = c;
                }
            }
            ParticleEmitter.DEFAULT_PARAM_TEXTURE = _createTexture(gd, resolution, resolution, dtex, pc.PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.minFilter = pc.FILTER_LINEAR;
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.magFilter = pc.FILTER_LINEAR;
        }

        // Global system parameters
        setPropertyTarget = this;
        setPropertyOptions = options;
        setProperty("numParticles", 1);                          // Amount of particles allocated (max particles = max GL texture width at this moment)

        if (this.numParticles > graphicsDevice.maxTextureSize) {
            console.warn("WARNING: can't create more than " + graphicsDevice.maxTextureSize + " particles on this device.");
            this.numParticles = graphicsDevice.maxTextureSize;
        }

        setProperty("rate", 1);                                  // Emission rate
        setProperty("rate2", this.rate);
        setProperty("lifetime", 50);                             // Particle lifetime
        setProperty("emitterExtents", new pc.Vec3(0, 0, 0));        // Spawn point divergence
        setProperty("emitterExtentsInner", new pc.Vec3(0, 0, 0));   // Volume inside emitterExtents to exclude from reneration
        setProperty("emitterRadius", 0);
        setProperty("emitterRadiusInner", 0);                       // Same as ExtentsInner but for spherical volume
        setProperty("emitterShape", pc.EMITTERSHAPE_BOX);
        setProperty("initialVelocity", 1);
        setProperty("wrap", false);
        setProperty("localSpace", false);
        setProperty("wrapBounds", null);
        setProperty("colorMap", ParticleEmitter.DEFAULT_PARAM_TEXTURE);
        setProperty("normalMap", null);
        setProperty("loop", true);
        setProperty("preWarm", false);
        setProperty("sort", pc.PARTICLESORT_NONE); // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;  Forces CPU mode if not 0
        setProperty("mode", pc.PARTICLEMODE_GPU);
        setProperty("scene", null);
        setProperty("lighting", false);
        setProperty("halfLambert", false);
        setProperty("intensity", 1.0);
        setProperty("stretch", 0.0);
        setProperty("alignToMotion", false);
        setProperty("depthSoftening", 0);
        setProperty("mesh", null);                              // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                                // Leave undefined to use simple quads
        setProperty("particleNormal", new pc.Vec3(0, 1, 0));
        setProperty("orientation", pc.PARTICLEORIENTATION_SCREEN);

        setProperty("depthWrite", false);
        setProperty("noFog", false);
        setProperty("blendType", pc.BLEND_NORMAL);
        setProperty("node", null);
        setProperty("startAngle", 0);
        setProperty("startAngle2", this.startAngle);

        setProperty("animTilesX", 1);
        setProperty("animTilesY", 1);
        setProperty("animNumFrames", 1);
        setProperty("animSpeed", 1);
        setProperty("animLoop", true);

        this.frameRandomUniform = new Float32Array(3);
        this.emitterPosUniform = new Float32Array(3);
        this.wrapBoundsUniform = new Float32Array(3);
        this.emitterScaleUniform = new Float32Array([1, 1, 1]);

        // Time-dependent parameters
        setProperty("colorGraph", default1Curve3);
        setProperty("colorGraph2", this.colorGraph);

        setProperty("scaleGraph", default1Curve);
        setProperty("scaleGraph2", this.scaleGraph);

        setProperty("alphaGraph", default1Curve);
        setProperty("alphaGraph2", this.alphaGraph);

        setProperty("localVelocityGraph", default0Curve3);
        setProperty("localVelocityGraph2", this.localVelocityGraph);

        setProperty("velocityGraph", default0Curve3);
        setProperty("velocityGraph2", this.velocityGraph);

        setProperty("rotationSpeedGraph", default0Curve);
        setProperty("rotationSpeedGraph2", this.rotationSpeedGraph);

        setProperty("radialSpeedGraph", default0Curve);
        setProperty("radialSpeedGraph2", this.radialSpeedGraph);

        // Particle updater constants
        this.constantParticleTexIN = gd.scope.resolve("particleTexIN");
        this.constantParticleTexOUT = gd.scope.resolve("particleTexOUT");
        this.constantEmitterPos = gd.scope.resolve("emitterPos");
        this.constantEmitterScale = gd.scope.resolve("emitterScale");
        this.constantSpawnBounds = gd.scope.resolve("spawnBounds");
        this.constantSpawnPosInnerRatio = gd.scope.resolve("spawnPosInnerRatio");
        this.constantSpawnBoundsSphere = gd.scope.resolve("spawnBoundsSphere");
        this.constantSpawnBoundsSphereInnerRatio = gd.scope.resolve("spawnBoundsSphereInnerRatio");
        this.constantInitialVelocity = gd.scope.resolve("initialVelocity");
        this.constantFrameRandom = gd.scope.resolve("frameRandom");
        this.constantDelta = gd.scope.resolve("delta");
        this.constantRate = gd.scope.resolve("rate");
        this.constantRateDiv = gd.scope.resolve("rateDiv");
        this.constantLifetime = gd.scope.resolve("lifetime");
        this.constantLightCube = gd.scope.resolve("lightCube[0]");
        this.constantGraphSampleSize = gd.scope.resolve("graphSampleSize");
        this.constantGraphNumSamples = gd.scope.resolve("graphNumSamples");
        this.constantInternalTex0 = gd.scope.resolve("internalTex0");
        this.constantInternalTex1 = gd.scope.resolve("internalTex1");
        this.constantInternalTex2 = gd.scope.resolve("internalTex2");
        this.constantInternalTex3 = gd.scope.resolve("internalTex3");
        this.constantEmitterMatrix = gd.scope.resolve("emitterMatrix");
        this.constantEmitterMatrixInv = gd.scope.resolve("emitterMatrixInv");
        this.constantNumParticles = gd.scope.resolve("numParticles");
        this.constantNumParticlesPot = gd.scope.resolve("numParticlesPot");
        this.constantLocalVelocityDivMult = gd.scope.resolve("localVelocityDivMult");
        this.constantVelocityDivMult = gd.scope.resolve("velocityDivMult");
        this.constantRotSpeedDivMult = gd.scope.resolve("rotSpeedDivMult");
        this.constantSeed = gd.scope.resolve("seed");
        this.constantStartAngle = gd.scope.resolve("startAngle");
        this.constantStartAngle2 = gd.scope.resolve("startAngle2");
        this.constantOutBoundsMul = gd.scope.resolve("outBoundsMul");
        this.constantOutBoundsAdd = gd.scope.resolve("outBoundsAdd");
        this.constantInBoundsSize = gd.scope.resolve("inBoundsSize");
        this.constantInBoundsCenter = gd.scope.resolve("inBoundsCenter");
        this.constantMaxVel = gd.scope.resolve("maxVel");
        this.constantFaceTangent = gd.scope.resolve("faceTangent");
        this.constantFaceBinorm = gd.scope.resolve("faceBinorm");

        this.lightCube = new Float32Array(6 * 3);
        this.lightCubeDir = new Array(6);
        this.lightCubeDir[0] = new pc.Vec3(-1, 0, 0);
        this.lightCubeDir[1] = new pc.Vec3(1, 0, 0);
        this.lightCubeDir[2] = new pc.Vec3(0, -1, 0);
        this.lightCubeDir[3] = new pc.Vec3(0, 1, 0);
        this.lightCubeDir[4] = new pc.Vec3(0, 0, -1);
        this.lightCubeDir[5] = new pc.Vec3(0, 0, 1);

        this.animParams = new Float32Array(4);

        this.internalTex0 = null;
        this.internalTex1 = null;
        this.internalTex2 = null;
        this.colorParam = null;

        this.vbToSort = null;
        this.vbOld = null;
        this.particleDistance = null;

        this.camera = null;

        this.swapTex = false;
        this.useMesh = true;
        this.useCpu = false;

        this.pack8 = true;
        this.localBounds = new pc.BoundingBox();
        this.worldBoundsNoTrail = new pc.BoundingBox();
        this.worldBoundsTrail = [new pc.BoundingBox(), new pc.BoundingBox()];
        this.worldBounds = new pc.BoundingBox();
        this.inBoundsCenterUniform = new Float32Array(3);

        this.worldBoundsSize = new pc.Vec3();
        this.inBoundsSizeUniform = new Float32Array(3);

        this.prevWorldBoundsSize = new pc.Vec3();
        this.prevWorldBoundsCenter = new pc.Vec3();
        this.worldBoundsMul = new pc.Vec3();
        this.worldBoundsMulUniform = new Float32Array(3);
        this.worldBoundsAdd = new pc.Vec3();
        this.worldBoundsAddUniform = new Float32Array(3);
        this.timeToSwitchBounds = 0;
        // this.prevPos = new pc.Vec3();

        this.shaderParticleUpdateRespawn = null;
        this.shaderParticleUpdateNoRespawn = null;
        this.shaderParticleUpdateOnStop = null;

        this.numParticleVerts = 0;
        this.numParticleIndices = 0;

        this.material = null;
        this.meshInstance = null;

        this.seed = 0;

        this.fixedTimeStep = 1.0 / 60;
        this.maxSubSteps = 10;
        this.simTime = 0;
        this.simTimeTotal = 0;

        this.beenReset = false;

        this._layer = null;

        this.rebuild();
    };

    function calcEndTime(emitter) {
        var interval = (Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime);
        return Date.now() + interval * 1000;
    }

    function subGraph(A, B) {
        var r = new Float32Array(A.length);
        for (var i = 0; i < A.length; i++) {
            r[i] = A[i] - B[i];
        }
        return r;
    }

    function maxUnsignedGraphValue(A, outUMax) {
        var i, j;
        var chans = outUMax.length;
        var values = A.length / chans;
        for (i = 0; i < values; i++) {
            for (j = 0; j < chans; j++) {
                var a = Math.abs(A[i * chans + j]);
                outUMax[j] = Math.max(outUMax[j], a);
            }
        }
    }

    function normalizeGraph(A, uMax) {
        var chans = uMax.length;
        var i, j;
        var values = A.length / chans;
        for (i = 0; i < values; i++) {
            for (j = 0; j < chans; j++) {
                A[i * chans + j] /= uMax[j];
                A[i * chans + j] *= 0.5;
                A[i * chans + j] += 0.5;
            }
        }
    }

    function divGraphFrom2Curves(curve1, curve2, outUMax) {
        var sub = subGraph(curve2, curve1);
        maxUnsignedGraphValue(sub, outUMax);
        normalizeGraph(sub, outUMax);
        return sub;
    }

    function mat4ToMat3(mat4, mat3) {
        mat3.data[0] = mat4.data[0];
        mat3.data[1] = mat4.data[1];
        mat3.data[2] = mat4.data[2];

        mat3.data[3] = mat4.data[4];
        mat3.data[4] = mat4.data[5];
        mat3.data[5] = mat4.data[6];

        mat3.data[6] = mat4.data[8];
        mat3.data[7] = mat4.data[9];
        mat3.data[8] = mat4.data[10];
    }

    Object.assign(ParticleEmitter.prototype, {

        onChangeCamera: function () {
            this.regenShader();
            this.resetMaterial();
        },

        calculateBoundsMad: function () {
            this.worldBoundsMul.x = 1.0 / this.worldBoundsSize.x;
            this.worldBoundsMul.y = 1.0 / this.worldBoundsSize.y;
            this.worldBoundsMul.z = 1.0 / this.worldBoundsSize.z;

            this.worldBoundsAdd.copy(this.worldBounds.center).mul(this.worldBoundsMul).scale(-1);
            this.worldBoundsAdd.x += 0.5;
            this.worldBoundsAdd.y += 0.5;
            this.worldBoundsAdd.z += 0.5;
        },

        calculateWorldBounds: function () {
            if (!this.node) return;

            this.prevWorldBoundsSize.copy(this.worldBoundsSize);
            this.prevWorldBoundsCenter.copy(this.worldBounds.center);

            this.worldBoundsNoTrail.setFromTransformedAabb(
                this.localBounds, this.localSpace ? pc.Mat4.IDENTITY : this.node.getWorldTransform());

            this.worldBoundsTrail[0].add(this.worldBoundsNoTrail);
            this.worldBoundsTrail[1].add(this.worldBoundsNoTrail);

            var now = this.simTimeTotal;
            if (now > this.timeToSwitchBounds) {
                this.worldBoundsTrail[0].copy(this.worldBoundsTrail[1]);
                this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
                this.timeToSwitchBounds = now + this.lifetime;
            }

            this.worldBounds.copy(this.worldBoundsTrail[0]);

            this.worldBoundsSize.copy(this.worldBounds.halfExtents).scale(2);

            this.meshInstance.mesh.aabb = this.worldBounds;
            this.meshInstance._aabbVer = 1 - this.meshInstance._aabbVer;

            if (this.pack8) this.calculateBoundsMad();
        },

        calculateLocalBounds: function () {
            var minx = Number.MAX_VALUE;
            var miny = Number.MAX_VALUE;
            var minz = Number.MAX_VALUE;
            var maxx = -Number.MAX_VALUE;
            var maxy = -Number.MAX_VALUE;
            var maxz = -Number.MAX_VALUE;
            var maxR = 0;
            var maxScale = 0;
            var stepWeight = this.lifetime / this.precision;
            var vels = [this.qVelocity, this.qVelocity2, this.qLocalVelocity, this.qLocalVelocity2];
            var accumX = [0, 0, 0, 0];
            var accumY = [0, 0, 0, 0];
            var accumZ = [0, 0, 0, 0];
            var accumR = [0, 0];
            var i, j;
            var index;
            var x, y, z;
            for (i = 0; i < this.precision + 1; i++) { // take extra step to prevent position glitches
                index = Math.min(i, this.precision - 1);
                for (j = 0; j < 4; j++) {
                    x = vels[j][index * 3] * stepWeight + accumX[j];
                    y = vels[j][index * 3 + 1] * stepWeight + accumY[j];
                    z = vels[j][index * 3 + 2] * stepWeight + accumZ[j];

                    if (minx > x) minx = x;
                    if (miny > y) miny = y;
                    if (minz > z) minz = z;
                    if (maxx < x) maxx = x;
                    if (maxy < y) maxy = y;
                    if (maxz < z) maxz = z;

                    accumX[j] = x;
                    accumY[j] = y;
                    accumZ[j] = z;
                }
                accumR[0] += this.qRadialSpeed[index] * stepWeight;
                accumR[1] += this.qRadialSpeed2[index] * stepWeight;
                maxR = Math.max(maxR, Math.max(Math.abs(accumR[0]), Math.abs(accumR[1])));

                maxScale = Math.max(maxScale, this.qScale[index]);
            }

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                x = this.emitterExtents.x * 0.5;
                y = this.emitterExtents.y * 0.5;
                z = this.emitterExtents.z * 0.5;
            } else {
                x = this.emitterRadius;
                y = this.emitterRadius;
                z = this.emitterRadius;
            }

            bMin.x = minx - maxScale - x - maxR;
            bMin.y = miny - maxScale - y - maxR;
            bMin.z = minz - maxScale - z - maxR;
            bMax.x = maxx + maxScale + x + maxR;
            bMax.y = maxy + maxScale + y + maxR;
            bMax.z = maxz + maxScale + z + maxR;
            this.localBounds.setMinMax(bMin, bMax);
        },

        rebuild: function () {
            var i;
            var gd = this.graphicsDevice;

            if (this.colorMap === null) this.colorMap = ParticleEmitter.DEFAULT_PARAM_TEXTURE;

            this.spawnBounds = this.emitterShape === pc.EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;

            this.useCpu = this.useCpu || this.sort > pc.PARTICLESORT_NONE ||  // force CPU if desirable by user or sorting is enabled
            gd.maxVertexTextures <= 1 || // force CPU if can't use enough vertex textures
            gd.fragmentUniformsCount < 64 || // force CPU if can't use many uniforms; TODO: change to more realistic value (this one is iphone's)
            gd.forceCpuParticles ||
            !gd.extTextureFloat; // no float texture extension

            this._destroyResources();

            this.pack8 = (this.pack8 || !gd.textureFloatRenderable) && !this.useCpu;

            particleTexHeight = (this.useCpu || this.pack8) ? 4 : 2;

            this.useMesh = false;
            if (this.mesh) {
                var totalVertCount = this.numParticles * this.mesh.vertexBuffer.numVertices;
                if (totalVertCount > 65535) {
                    console.warn("WARNING: particle system can't render mesh particles because numParticles * numVertices is more than 65k. Reverting to quad particles.");
                } else {
                    this.useMesh = true;
                }
            }

            this.numParticlesPot = pc.math.nextPowerOfTwo(this.numParticles);
            this.rebuildGraphs();
            this.calculateLocalBounds();
            if (this.node) {
                // this.prevPos.copy(this.node.getPosition());
                this.worldBounds.setFromTransformedAabb(
                    this.localBounds, this.localSpace ? pc.Mat4.IDENTITY : this.node.getWorldTransform());

                this.worldBoundsTrail[0].copy(this.worldBounds);
                this.worldBoundsTrail[1].copy(this.worldBounds);

                this.worldBoundsSize.copy(this.worldBounds.halfExtents).scale(2);
                this.prevWorldBoundsSize.copy(this.worldBoundsSize);
                this.prevWorldBoundsCenter.copy(this.worldBounds.center);
                if (this.pack8) this.calculateBoundsMad();
            }

            // Dynamic simulation data
            this.vbToSort = new Array(this.numParticles);
            this.particleDistance = new Float32Array(this.numParticles);

            this.frameRandomUniform[0] = Math.random();
            this.frameRandomUniform[1] = Math.random();
            this.frameRandomUniform[2] = Math.random();

            this.particleTex = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
            var emitterPos = (this.node === null || this.localSpace) ? pc.Vec3.ZERO : this.node.getPosition();
            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                if (this.node === null || this.localSpace){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.spawnBounds);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.localScale));
                }
                extentsInnerRatioUniform[0] = this.emitterExtents.x != 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
                extentsInnerRatioUniform[1] = this.emitterExtents.y != 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
                extentsInnerRatioUniform[2] = this.emitterExtents.z != 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
            }
            for (i = 0; i < this.numParticles; i++) {
                this.calcSpawnPosition(emitterPos, i);
                if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1; // hide/show
            }

            this.particleTexStart = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
            for (i = 0; i < this.particleTexStart.length; i++) this.particleTexStart[i] = this.particleTex[i];

            if (!this.useCpu) {
                if (this.pack8) {
                    this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                    this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                    this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                } else {
                    this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                    this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                    this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart);
                }

                this.rtParticleTexIN = new pc.RenderTarget(gd, this.particleTexIN, {
                    depth: false
                });
                this.rtParticleTexOUT = new pc.RenderTarget(gd, this.particleTexOUT, {
                    depth: false
                });
                this.swapTex = false;
            }

            var chunks = pc.shaderChunks;
            var shaderCodeStart = (this.localSpace ? '#define LOCAL_SPACE\n' : '') + chunks.particleUpdaterInitPS +
            (this.pack8 ? (chunks.particleInputRgba8PS + chunks.particleOutputRgba8PS) :
                (chunks.particleInputFloatPS + chunks.particleOutputFloatPS)) +
            (this.emitterShape === pc.EMITTERSHAPE_BOX ? chunks.particleUpdaterAABBPS : chunks.particleUpdaterSpherePS) +
            chunks.particleUpdaterStartPS;
            var shaderCodeRespawn = shaderCodeStart + chunks.particleUpdaterRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeNoRespawn = shaderCodeStart + chunks.particleUpdaterNoRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeOnStop = shaderCodeStart + chunks.particleUpdaterOnStopPS + chunks.particleUpdaterEndPS;


            // Note: createShaderFromCode can return a shader from the cache (not a new shader) so we *should not* delete these shaders
            // when the particle emitter is destroyed
            this.shaderParticleUpdateRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad0" + this.emitterShape + "" + this.pack8);
            this.shaderParticleUpdateNoRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad1" + this.emitterShape + "" + this.pack8);
            this.shaderParticleUpdateOnStop = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeOnStop, "fsQuad2" + this.emitterShape + "" + this.pack8);

            this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
            this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
            this._allocate(this.numParticles);

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = this.vertexBuffer;
            mesh.indexBuffer[0] = this.indexBuffer;
            mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = (this.numParticles * this.numParticleIndices);
            mesh.primitive[0].indexed = true;

            this.material = new pc.Material();
            this.material.name = this.node.name;
            this.material.cull = pc.CULLFACE_NONE;
            this.material.alphaWrite = false;
            this.material.blend = true;
            this.material.blendType = this.blendType;

            this.material.depthWrite = this.depthWrite;
            this.material.emitter = this;

            this.regenShader();
            this.resetMaterial();

            var wasVisible = this.meshInstance ? this.meshInstance.visible : true;
            this.meshInstance = new pc.MeshInstance(this.node, mesh, this.material);
            this.meshInstance.pick = false;
            this.meshInstance.updateKey(); // shouldn't be here?
            this.meshInstance.cull = true;
            this.meshInstance._noDepthDrawGl1 = true;
            this.meshInstance.aabb = this.worldBounds;
            this.meshInstance._updateAabb = false;
            this.meshInstance.visible = wasVisible;

            this._initializeTextures();

            this.addTime(0, false); // fill dynamic textures and constants with initial data
            if (this.preWarm) this.prewarm(this.lifetime);

            this.resetTime();
        },

        _isAnimated: function () {
            return this.animNumFrames >= 1 &&
                   (this.animTilesX > 1 || this.animTilesY > 1) &&
                   (this.colorMap && this.colorMap !== ParticleEmitter.DEFAULT_PARAM_TEXTURE || this.normalMap);
        },

        calcSpawnPosition: function (emitterPos, i) {
            var rX = Math.random();
            var rY = Math.random();
            var rZ = Math.random();
            var rW = Math.random();
            if (this.useCpu) {
                this.particleTex[i * particleTexChannels + 0 + this.numParticlesPot * 2 * particleTexChannels] = rX;
                this.particleTex[i * particleTexChannels + 1 + this.numParticlesPot * 2 * particleTexChannels] = rY;
                this.particleTex[i * particleTexChannels + 2 + this.numParticlesPot * 2 * particleTexChannels] = rZ;
                // this.particleTex[i * 4 + 3 + this.numParticlesPot * 2 * 4] = 1; // hide/show
            }

            randomPos.x = rX - 0.5;
            randomPos.y = rY - 0.5;
            randomPos.z = rZ - 0.5;

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                var max = Math.max(Math.abs(randomPos.x), Math.max(Math.abs(randomPos.y), Math.abs(randomPos.z)));

                // let's find a contour sourface level coresponding to max random component
                // and translate 2 other random components to that surface
                // edge = (1.0 - extentsInnerRatioUniform) * max + 0.5 * extentsInnerRatioUniform;
                var edgeX = max + (0.5 - max) * extentsInnerRatioUniform[0];
                var edgeY = max + (0.5 - max) * extentsInnerRatioUniform[1];
                var edgeZ = max + (0.5 - max) * extentsInnerRatioUniform[2];
                randomPos.x = edgeX * (max == Math.abs(randomPos.x) ? Math.sign(randomPos.x) : 2 * randomPos.x);
                randomPos.y = edgeY * (max == Math.abs(randomPos.y) ? Math.sign(randomPos.y) : 2 * randomPos.y);
                randomPos.z = edgeZ * (max == Math.abs(randomPos.z) ? Math.sign(randomPos.z) : 2 * randomPos.z);

                if (!this.localSpace)
                    randomPosTformed.copy(emitterPos).add( spawnMatrix.transformPoint(randomPos) );
                else
                    randomPosTformed.copy( spawnMatrix.transformPoint(randomPos) );
            } else {
                randomPos.normalize();
                var spawnBoundsSphereInnerRatio = this.emitterRadiusInner / this.emitterRadius;
                var r = rW * (1.0 - spawnBoundsSphereInnerRatio) + spawnBoundsSphereInnerRatio;
                if (!this.localSpace)
                    randomPosTformed.copy(emitterPos).add( randomPos.scale(r * this.emitterRadius) );
                else
                    randomPosTformed.copy( randomPos.scale(r * this.emitterRadius) );
            }

            var particleRate, startSpawnTime;
            if (this.pack8) {
                var packX = (randomPosTformed.x - this.worldBounds.center.x) / this.worldBoundsSize.x + 0.5;
                var packY = (randomPosTformed.y - this.worldBounds.center.y) / this.worldBoundsSize.y + 0.5;
                var packZ = (randomPosTformed.z - this.worldBounds.center.z) / this.worldBoundsSize.z + 0.5;

                var packA = pc.math.lerp(this.startAngle * pc.math.DEG_TO_RAD, this.startAngle2 * pc.math.DEG_TO_RAD, rX);
                packA = (packA % (Math.PI * 2)) / (Math.PI * 2);

                var rg0 = encodeFloatRG(packX);
                this.particleTex[i * particleTexChannels] = rg0[0];
                this.particleTex[i * particleTexChannels + 1] = rg0[1];

                var ba0 = encodeFloatRG(packY);
                this.particleTex[i * particleTexChannels + 2] = ba0[0];
                this.particleTex[i * particleTexChannels + 3] = ba0[1];

                var rg1 = encodeFloatRG(packZ);
                this.particleTex[i * particleTexChannels + 0 + this.numParticlesPot * particleTexChannels] = rg1[0];
                this.particleTex[i * particleTexChannels + 1 + this.numParticlesPot * particleTexChannels] = rg1[1];

                var ba1 = encodeFloatRG(packA);
                this.particleTex[i * particleTexChannels + 2 + this.numParticlesPot * particleTexChannels] = ba1[0];
                this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels] = ba1[1];

                var a2 = 1.0;
                this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels * 2] = a2;

                particleRate = pc.math.lerp(this.rate, this.rate2, rX);
                startSpawnTime = -particleRate * i;
                var maxNegLife = Math.max(this.lifetime, (this.numParticles - 1.0) * (Math.max(this.rate, this.rate2)));
                var maxPosLife = this.lifetime + 1.0;
                startSpawnTime = (startSpawnTime + maxNegLife) / (maxNegLife + maxPosLife);
                var rgba3 = encodeFloatRGBA(startSpawnTime);
                this.particleTex[i * particleTexChannels + 0 + this.numParticlesPot * particleTexChannels * 3] = rgba3[0];
                this.particleTex[i * particleTexChannels + 1 + this.numParticlesPot * particleTexChannels * 3] = rgba3[1];
                this.particleTex[i * particleTexChannels + 2 + this.numParticlesPot * particleTexChannels * 3] = rgba3[2];
                this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels * 3] = rgba3[3];

            } else {
                this.particleTex[i * particleTexChannels] =     randomPosTformed.x;
                this.particleTex[i * particleTexChannels + 1] = randomPosTformed.y;
                this.particleTex[i * particleTexChannels + 2] = randomPosTformed.z;
                this.particleTex[i * particleTexChannels + 3] = pc.math.lerp(this.startAngle * pc.math.DEG_TO_RAD, this.startAngle2 * pc.math.DEG_TO_RAD, rX);

                particleRate = pc.math.lerp(this.rate, this.rate2, rX);
                startSpawnTime = -particleRate * i;
                this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels] = startSpawnTime;
            }
        },

        rebuildGraphs: function () {
            var precision = this.precision;
            var gd = this.graphicsDevice;
            var i;

            this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
            this.qVelocity = this.velocityGraph.quantize(precision);
            this.qColor =         this.colorGraph.quantize(precision);
            this.qRotSpeed =      this.rotationSpeedGraph.quantize(precision);
            this.qScale =         this.scaleGraph.quantize(precision);
            this.qAlpha =         this.alphaGraph.quantize(precision);
            this.qRadialSpeed =   this.radialSpeedGraph.quantize(precision);

            this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
            this.qVelocity2 = this.velocityGraph2.quantize(precision);
            this.qColor2 =         this.colorGraph2.quantize(precision);
            this.qRotSpeed2 =      this.rotationSpeedGraph2.quantize(precision);
            this.qScale2 =         this.scaleGraph2.quantize(precision);
            this.qAlpha2 =         this.alphaGraph2.quantize(precision);
            this.qRadialSpeed2 =   this.radialSpeedGraph2.quantize(precision);

            for (i = 0; i < precision; i++) {
                this.qRotSpeed[i] *= pc.math.DEG_TO_RAD;
                this.qRotSpeed2[i] *= pc.math.DEG_TO_RAD;
            }

            this.localVelocityUMax = new Float32Array(3);
            this.velocityUMax = new Float32Array(3);
            this.colorUMax = new Float32Array(3);
            this.rotSpeedUMax = [0];
            this.scaleUMax =    [0];
            this.alphaUMax =    [0];
            this.radialSpeedUMax = [0];
            this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax);
            this.qVelocityDiv =      divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax);
            this.qColorDiv =         divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax);
            this.qRotSpeedDiv =      divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
            this.qScaleDiv =         divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
            this.qAlphaDiv =         divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);
            this.qRadialSpeedDiv =   divGraphFrom2Curves(this.qRadialSpeed, this.qRadialSpeed2, this.radialSpeedUMax);

            if (this.pack8) {
                var umax = [0, 0, 0];
                maxUnsignedGraphValue(this.qVelocity, umax);
                var umax2 = [0, 0, 0];
                maxUnsignedGraphValue(this.qVelocity2, umax2);

                var lumax = [0, 0, 0];
                maxUnsignedGraphValue(this.qLocalVelocity, lumax);
                var lumax2 = [0, 0, 0];
                maxUnsignedGraphValue(this.qLocalVelocity2, lumax2);

                var rumax = [0];
                maxUnsignedGraphValue(this.qRadialSpeed, rumax);
                var rumax2 = [0];
                maxUnsignedGraphValue(this.qRadialSpeed2, rumax2);

                var maxVel = Math.max(umax[0], umax2[0]);
                maxVel = Math.max(maxVel, umax[1]);
                maxVel = Math.max(maxVel, umax2[1]);
                maxVel = Math.max(maxVel, umax[2]);
                maxVel = Math.max(maxVel, umax2[2]);

                var lmaxVel = Math.max(lumax[0], lumax2[0]);
                lmaxVel = Math.max(lmaxVel, lumax[1]);
                lmaxVel = Math.max(lmaxVel, lumax2[1]);
                lmaxVel = Math.max(lmaxVel, lumax[2]);
                lmaxVel = Math.max(lmaxVel, lumax2[2]);

                var maxRad = Math.max(rumax[0], rumax2[0]);

                this.maxVel = maxVel + lmaxVel + maxRad;
            }


            if (!this.useCpu) {
                this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
                this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
                this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv));
                this.internalTex3 = _createTexture(gd, precision, 1, packTexture2Floats(this.qRadialSpeed, this.qRadialSpeedDiv));
            }
            this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), pc.PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
        },

        _initializeTextures: function () {
            if (this.colorMap) {
                this.material.setParameter('colorMap', this.colorMap);
                if (this.lighting && this.normalMap) {
                    this.material.setParameter('normalMap', this.normalMap);
                }
            }
        },

        regenShader: function () {
            var programLib = this.graphicsDevice.getProgramLibrary();
            var hasNormal = (this.normalMap !== null);
            this.normalOption = 0;
            if (this.lighting) {
                this.normalOption = hasNormal ? 2 : 1;
            }
            // updateShader is also called by pc.Scene when all shaders need to be updated
            this.material.updateShader = function () {

                // The app works like this:
                // 1. Emitter init
                // 2. Update. No camera is assigned to emitters
                // 3. Render; activeCamera = camera; shader init
                // 4. Update. activeCamera is set to emitters
                // -----
                // The problem with 1st frame render is that we init the shader without having any camera set to emitter -
                // so wrong shader is being compiled.
                // To fix it, we need to check activeCamera!=emitter.camera in shader init too
                if (this.emitter.scene) {
                    if (this.emitter.camera != this.emitter.scene._activeCamera) {
                        this.emitter.camera = this.emitter.scene._activeCamera;
                        this.emitter.onChangeCamera();
                    }
                }

                var shader = programLib.getProgram("particle", {
                    useCpu: this.emitter.useCpu,
                    normal: this.emitter.normalOption,
                    halflambert: this.emitter.halfLambert,
                    stretch: this.emitter.stretch,
                    alignToMotion: this.emitter.alignToMotion,
                    soft: this.emitter.depthSoftening,
                    mesh: this.emitter.useMesh,
                    gamma: this.emitter.scene ? this.emitter.scene.gammaCorrection : 0,
                    toneMap: this.emitter.scene ? this.emitter.scene.toneMapping : 0,
                    fog: (this.emitter.scene && !this.emitter.noFog) ? this.emitter.scene.fog : "none",
                    wrap: this.emitter.wrap && this.emitter.wrapBounds,
                    localSpace: this.emitter.localSpace,
                    blend: this.blendType,
                    animTex: this.emitter._isAnimated(),
                    animTexLoop: this.emitter.animLoop,
                    pack8: this.emitter.pack8,
                    customFace: this.emitter.orientation != pc.PARTICLEORIENTATION_SCREEN
                });
                this.shader = shader;
            };
            this.material.updateShader();
        },

        resetMaterial: function () {
            var material = this.material;

            material.setParameter('stretch', this.stretch);
            if (this._isAnimated()) {
                material.setParameter('animTexParams', this.animParams);
            }
            material.setParameter('colorMult', this.intensity);
            if (!this.useCpu) {
                material.setParameter('internalTex0', this.internalTex0);
                material.setParameter('internalTex1', this.internalTex1);
                material.setParameter('internalTex2', this.internalTex2);
                material.setParameter('internalTex3', this.internalTex3);
            }
            material.setParameter('colorParam', this.colorParam);

            material.setParameter('numParticles', this.numParticles);
            material.setParameter('numParticlesPot', this.numParticlesPot);
            material.setParameter('lifetime', this.lifetime);
            material.setParameter('rate', this.rate);
            material.setParameter('rateDiv', this.rate2 - this.rate);
            material.setParameter('seed', this.seed);
            material.setParameter('scaleDivMult', this.scaleUMax[0]);
            material.setParameter('alphaDivMult', this.alphaUMax[0]);
            material.setParameter('radialSpeedDivMult', this.radialSpeedUMax[0]);
            material.setParameter("graphNumSamples", this.precision);
            material.setParameter("graphSampleSize", 1.0 / this.precision);
            material.setParameter("emitterScale", new Float32Array([1, 1, 1]));

            if (this.pack8) {
                this.inBoundsSizeUniform[0] = this.worldBoundsSize.x;
                this.inBoundsSizeUniform[1] = this.worldBoundsSize.y;
                this.inBoundsSizeUniform[2] = this.worldBoundsSize.z;
                material.setParameter("inBoundsSize", this.inBoundsSizeUniform);
                this.inBoundsCenterUniform[0] = this.worldBounds.center.x;
                this.inBoundsCenterUniform[1] = this.worldBounds.center.y;
                this.inBoundsCenterUniform[2] = this.worldBounds.center.z;
                material.setParameter("inBoundsCenter", this.inBoundsCenterUniform);
                material.setParameter("maxVel", this.maxVel);
            }

            if (this.wrap && this.wrapBounds) {
                this.wrapBoundsUniform[0] = this.wrapBounds.x;
                this.wrapBoundsUniform[1] = this.wrapBounds.y;
                this.wrapBoundsUniform[2] = this.wrapBounds.z;
                material.setParameter('wrapBounds', this.wrapBoundsUniform);
            }

            if (this.colorMap) {
                material.setParameter('colorMap', this.colorMap);
            }

            if (this.lighting) {
                if (this.normalMap) {
                    material.setParameter('normalMap', this.normalMap);
                }
            }
            if (this.depthSoftening > 0) {
                material.setParameter('softening', 1.0 / (this.depthSoftening * this.depthSoftening * 100)); // remap to more perceptually linear
            }
            if (this.stretch > 0.0) material.cull = pc.CULLFACE_NONE;

            this._compParticleFaceParams();
        },

        _compParticleFaceParams: function () {
            var tangent, binormal;
            if (this.orientation == pc.PARTICLEORIENTATION_SCREEN) {
                tangent = new Float32Array([1, 0, 0]);
                binormal = new Float32Array([0, 0, 1]);
            } else {
                var n;
                if (this.orientation == pc.PARTICLEORIENTATION_WORLD) {
                    n = this.particleNormal.normalize();
                } else {
                    var emitterMat = this.node === null ?
                        pc.Mat4.IDENTITY : this.node.getWorldTransform();
                    n = emitterMat.transformVector(this.particleNormal).normalize();
                }
                var t = new pc.Vec3(1, 0, 0);
                if (Math.abs(t.dot(n)) == 1)
                    t.set(0, 0, 1);
                var b = new pc.Vec3().cross(n, t).normalize();
                t.cross(b, n).normalize();
                tangent = new Float32Array([t.x, t.y, t.z]);
                binormal = new Float32Array([b.x, b.y, b.z]);
            }
            this.material.setParameter("faceTangent", tangent);
            this.material.setParameter("faceBinorm", binormal);
        },


        // Declares vertex format, creates VB and IB
        _allocate: function (numParticles) {
            var psysVertCount = numParticles * this.numParticleVerts;
            var psysIndexCount = numParticles * this.numParticleIndices;
            var elements, particleFormat;
            var i;

            if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== psysVertCount)) {
                // Create the particle vertex format
                if (!this.useCpu) {
                    // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
                    elements = [{
                        semantic: pc.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }];
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                } else {
                    elements = [{
                        semantic: pc.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR1,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR2,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR3,
                        components: 2,
                        type: pc.TYPE_FLOAT32
                    }];
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                }

                // Fill the vertex buffer
                var data = new Float32Array(this.vertexBuffer.lock());
                var meshData, stride;
                if (this.useMesh) {
                    meshData = new Float32Array(this.mesh.vertexBuffer.lock());
                    stride = meshData.length / this.mesh.vertexBuffer.numVertices;
                }

                var id;
                for (i = 0; i < psysVertCount; i++) {
                    id = Math.floor(i / this.numParticleVerts);
                    if (!this.useMesh) {
                        var vertID = i % 4;
                        data[i * 4] = particleVerts[vertID][0];
                        data[i * 4 + 1] = particleVerts[vertID][1];
                        data[i * 4 + 2] = 0;
                    } else {
                        var vert = i % this.numParticleVerts;
                        data[i * 4] = meshData[vert * stride];
                        data[i * 4 + 1] = meshData[vert * stride + 1];
                        data[i * 4 + 2] = meshData[vert * stride + 2];
                    }

                    data[i * 4 + 3] = id;
                }

                if (this.useCpu) {
                    this.vbCPU = new Float32Array(data);
                    this.vbOld = new Float32Array(this.vbCPU.length);
                }
                this.vertexBuffer.unlock();
                if (this.useMesh) {
                    this.mesh.vertexBuffer.unlock();
                }


                // Fill the index buffer
                var dst = 0;
                var indices = new Uint16Array(this.indexBuffer.lock());
                if (this.useMesh) meshData = new Uint16Array(this.mesh.indexBuffer[0].lock());
                for (i = 0; i < numParticles; i++) {
                    if (!this.useMesh) {
                        var baseIndex = i * 4;
                        indices[dst++] = baseIndex;
                        indices[dst++] = baseIndex + 1;
                        indices[dst++] = baseIndex + 2;
                        indices[dst++] = baseIndex;
                        indices[dst++] = baseIndex + 2;
                        indices[dst++] = baseIndex + 3;
                    } else {
                        for (var j = 0; j < this.numParticleIndices; j++) {
                            indices[i * this.numParticleIndices + j] = meshData[j] + i * this.numParticleVerts;
                        }
                    }
                }
                this.indexBuffer.unlock();
                if (this.useMesh) this.mesh.indexBuffer[0].unlock();
            }
        },

        reset: function () {
            this.beenReset = true;
            this.seed = Math.random();
            this.material.setParameter('seed', this.seed);
            if (this.useCpu) {
                for (var i = 0; i < this.particleTexStart.length; i++) {
                    this.particleTex[i] = this.particleTexStart[i];
                }
            } else {
                this._initializeTextures();
            }
            this.resetTime();
            var origLoop =  this.loop;
            this.loop = true;
            this.addTime(0, false);
            this.loop = origLoop;
            if (this.preWarm) {
                this.prewarm(this.lifetime);
            }
        },

        prewarm: function (time) {
            var lifetimeFraction = time / this.lifetime;
            var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
            var stepDelta = time / iterations;
            for (var i = 0; i < iterations; i++) {
                this.addTime(stepDelta, false);
            }
        },

        resetTime: function () {
            this.endTime = calcEndTime(this);
        },

        finishFrame: function () {
            if (this.useCpu) this.vertexBuffer.unlock();
        },

        _setInputBounds: function () {
            this.inBoundsSizeUniform[0] = this.prevWorldBoundsSize.x;
            this.inBoundsSizeUniform[1] = this.prevWorldBoundsSize.y;
            this.inBoundsSizeUniform[2] = this.prevWorldBoundsSize.z;
            this.constantInBoundsSize.setValue(this.inBoundsSizeUniform);
            this.inBoundsCenterUniform[0] = this.prevWorldBoundsCenter.x;
            this.inBoundsCenterUniform[1] = this.prevWorldBoundsCenter.y;
            this.inBoundsCenterUniform[2] = this.prevWorldBoundsCenter.z;
            this.constantInBoundsCenter.setValue(this.inBoundsCenterUniform);
        },

        addTime: function (delta, isOnStop) {
            var a, b, c, i, j;
            var device = this.graphicsDevice;

            // #ifdef PROFILER
            var startTime = pc.now();
            // #endif

            this.simTimeTotal += delta;

            this.calculateWorldBounds();

            if (this._isAnimated()) {
                var params = this.animParams;
                params[0] = 1.0 / this.animTilesX;
                params[1] = 1.0 / this.animTilesY;
                params[2] = this.animNumFrames * this.animSpeed;
                params[3] = this.animNumFrames - 1;
            }

            if (this.scene) {
                if (this.camera != this.scene._activeCamera) {
                    this.camera = this.scene._activeCamera;
                    this.onChangeCamera();
                }
            }

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                extentsInnerRatioUniform[0] = this.emitterExtents.x != 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
                extentsInnerRatioUniform[1] = this.emitterExtents.y != 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
                extentsInnerRatioUniform[2] = this.emitterExtents.z != 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
                if (this.meshInstance.node === null){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.emitterExtents);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.localScale));
                }
            }

            var emitterPos;
            var emitterScale = this.meshInstance.node === null ? pc.Vec3.ONE : this.meshInstance.node.localScale;
            this.emitterScaleUniform[0] = emitterScale.x;
            this.emitterScaleUniform[1] = emitterScale.y;
            this.emitterScaleUniform[2] = emitterScale.z;
            this.material.setParameter("emitterScale", this.emitterScaleUniform);
            if (this.localSpace && this.meshInstance.node) {
                emitterPos = this.meshInstance.node.getPosition();
                this.emitterPosUniform[0] = emitterPos.x;
                this.emitterPosUniform[1] = emitterPos.y;
                this.emitterPosUniform[2] = emitterPos.z;
                this.material.setParameter("emitterPos", this.emitterPosUniform);
            }

            this._compParticleFaceParams();

            if (!this.useCpu) {
                device.setBlending(false);
                device.setColorWrite(true, true, true, true);
                device.setCullMode(pc.CULLFACE_NONE);
                device.setDepthTest(false);
                device.setDepthWrite(false);

                this.frameRandomUniform[0] = Math.random();
                this.frameRandomUniform[1] = Math.random();
                this.frameRandomUniform[2] = Math.random();

                this.constantGraphSampleSize.setValue(1.0 / this.precision);
                this.constantGraphNumSamples.setValue(this.precision);
                this.constantNumParticles.setValue(this.numParticles);
                this.constantNumParticlesPot.setValue(this.numParticlesPot);
                this.constantInternalTex0.setValue(this.internalTex0);
                this.constantInternalTex1.setValue(this.internalTex1);
                this.constantInternalTex2.setValue(this.internalTex2);
                this.constantInternalTex3.setValue(this.internalTex3);

                if (this.pack8) {
                    this.worldBoundsMulUniform[0] = this.worldBoundsMul.x;
                    this.worldBoundsMulUniform[1] = this.worldBoundsMul.y;
                    this.worldBoundsMulUniform[2] = this.worldBoundsMul.z;
                    this.constantOutBoundsMul.setValue(this.worldBoundsMulUniform);
                    this.worldBoundsAddUniform[0] = this.worldBoundsAdd.x;
                    this.worldBoundsAddUniform[1] = this.worldBoundsAdd.y;
                    this.worldBoundsAddUniform[2] = this.worldBoundsAdd.z;
                    this.constantOutBoundsAdd.setValue(this.worldBoundsAddUniform);

                    this._setInputBounds();

                    var maxVel = this.maxVel * Math.max(Math.max(emitterScale.x, emitterScale.y), emitterScale.z);
                    maxVel = Math.max(maxVel, 1);
                    this.constantMaxVel.setValue(maxVel);
                }

                emitterPos = (this.meshInstance.node === null || this.localSpace) ? pc.Vec3.ZERO : this.meshInstance.node.getPosition();
                var emitterMatrix = this.meshInstance.node === null ? pc.Mat4.IDENTITY : this.meshInstance.node.getWorldTransform();
                if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                    mat4ToMat3(spawnMatrix, spawnMatrix3);
                    this.constantSpawnBounds.setValue(spawnMatrix3.data);
                    this.constantSpawnPosInnerRatio.setValue(extentsInnerRatioUniform);
                } else {
                    this.constantSpawnBoundsSphere.setValue(this.emitterRadius);
                    this.constantSpawnBoundsSphereInnerRatio.setValue(this.emitterRadiusInner / this.emitterRadius);
                }
                this.constantInitialVelocity.setValue(this.initialVelocity);

                mat4ToMat3(emitterMatrix, emitterMatrix3);
                emitterMatrix.invertTo3x3(emitterMatrix3Inv);
                this.emitterPosUniform[0] = emitterPos.x;
                this.emitterPosUniform[1] = emitterPos.y;
                this.emitterPosUniform[2] = emitterPos.z;
                this.constantEmitterPos.setValue(this.emitterPosUniform);
                this.constantFrameRandom.setValue(this.frameRandomUniform);
                this.constantDelta.setValue(delta);
                this.constantRate.setValue(this.rate);
                this.constantRateDiv.setValue(this.rate2 - this.rate);
                this.constantStartAngle.setValue(this.startAngle * pc.math.DEG_TO_RAD);
                this.constantStartAngle2.setValue(this.startAngle2 * pc.math.DEG_TO_RAD);

                this.constantSeed.setValue(this.seed);
                this.constantLifetime.setValue(this.lifetime);
                this.emitterScaleUniform[0] = emitterScale.x;
                this.emitterScaleUniform[1] = emitterScale.y;
                this.emitterScaleUniform[2] = emitterScale.z;
                this.constantEmitterScale.setValue(this.emitterScaleUniform);
                this.constantEmitterMatrix.setValue(emitterMatrix3.data);
                this.constantEmitterMatrixInv.setValue(emitterMatrix3Inv.data);

                this.constantLocalVelocityDivMult.setValue(this.localVelocityUMax);
                this.constantVelocityDivMult.setValue(this.velocityUMax);
                this.constantRotSpeedDivMult.setValue(this.rotSpeedUMax[0]);

                var texIN = this.swapTex ? this.particleTexOUT : this.particleTexIN;
                texIN = this.beenReset ? this.particleTexStart : texIN;
                var texOUT = this.swapTex ? this.particleTexIN : this.particleTexOUT;
                this.constantParticleTexIN.setValue(texIN);
                if (!isOnStop) {
                    pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.loop ? this.shaderParticleUpdateRespawn : this.shaderParticleUpdateNoRespawn);
                } else {
                    pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.shaderParticleUpdateOnStop);
                }
                this.constantParticleTexOUT.setValue(texOUT);

                this.material.setParameter("particleTexOUT", texIN);// OUT);
                this.material.setParameter("particleTexIN", texOUT);// IN);
                this.beenReset = false;

                this.swapTex = !this.swapTex;

                device.setDepthTest(true);
                device.setDepthWrite(true);

                this.prevWorldBoundsSize.copy(this.worldBoundsSize);
                this.prevWorldBoundsCenter.copy(this.worldBounds.center);
                if (this.pack8)
                    this._setInputBounds();
            } else {
                var data = new Float32Array(this.vertexBuffer.lock());
                if (this.meshInstance.node) {
                    var fullMat = this.meshInstance.node.worldTransform;
                    for (j = 0; j < 12; j++) {
                        rotMat.data[j] = fullMat.data[j];
                    }
                    rotMatInv.copy(rotMat);
                    rotMatInv.invert();
                    nonUniformScale = this.meshInstance.node.localScale;
                    uniformScale = Math.max(Math.max(nonUniformScale.x, nonUniformScale.y), nonUniformScale.z);
                }

                // Particle updater emulation
                emitterPos = (this.meshInstance.node === null || this.localSpace) ? pc.Vec3.ZERO : this.meshInstance.node.getPosition();
                var posCam = this.camera ? this.camera._node.getPosition() : pc.Vec3.ZERO;

                var vertSize = 14;
                var cf, cc;
                var rotSpeed, rotSpeed2, scale2, alpha, alpha2, radialSpeed, radialSpeed2;
                var precision1 = this.precision - 1;

                for (i = 0; i < this.numParticles; i++) {
                    var id = Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3]);

                    var rndFactor = this.particleTex[id * particleTexChannels + 0 + this.numParticlesPot * 2 * particleTexChannels];
                    rndFactor3Vec.x = rndFactor;
                    rndFactor3Vec.y = this.particleTex[id * particleTexChannels + 1 + this.numParticlesPot * 2 * particleTexChannels];
                    rndFactor3Vec.z = this.particleTex[id * particleTexChannels + 2 + this.numParticlesPot * 2 * particleTexChannels];

                    var particleRate = this.rate + (this.rate2 - this.rate) * rndFactor;// pc.math.lerp(this.rate, this.rate2, rndFactor);

                    var particleLifetime = this.lifetime;

                    var life = this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels] + delta;
                    var nlife = saturate(life / particleLifetime);

                    var scale = 0;
                    var alphaDiv = 0;
                    var angle = 0;
                    var particleEnabled = life > 0.0 && life < particleLifetime;

                    if (particleEnabled) {
                        c = nlife * precision1;
                        cf = Math.floor(c);
                        cc = Math.ceil(c);
                        c %= 1;

                        // var rotSpeed =           tex1D(this.qRotSpeed, nlife);
                        a = this.qRotSpeed[cf];
                        b = this.qRotSpeed[cc];
                        rotSpeed = a + (b - a) * c;

                        // var rotSpeed2 =          tex1D(this.qRotSpeed2, nlife);
                        a = this.qRotSpeed2[cf];
                        b = this.qRotSpeed2[cc];
                        rotSpeed2 = a + (b - a) * c;

                        // scale =                  tex1D(this.qScale, nlife);
                        a = this.qScale[cf];
                        b = this.qScale[cc];
                        scale = a + (b - a) * c;

                        // var scale2 =             tex1D(this.qScale2, nlife);
                        a = this.qScale2[cf];
                        b = this.qScale2[cc];
                        scale2 = a + (b - a) * c;

                        // var alpha =              tex1D(this.qAlpha, nlife);
                        a = this.qAlpha[cf];
                        b = this.qAlpha[cc];
                        alpha = a + (b - a) * c;

                        // var alpha2 =             tex1D(this.qAlpha2, nlife);
                        a = this.qAlpha2[cf];
                        b = this.qAlpha2[cc];
                        alpha2 = a + (b - a) * c;

                        // var radialSpeed =        tex1D(this.qRadialSpeed, nlife);
                        a = this.qRadialSpeed[cf];
                        b = this.qRadialSpeed[cc];
                        radialSpeed = a + (b - a) * c;
                        // var radialSpeed2 =       tex1D(this.qRadialSpeed2, nlife);
                        a = this.qRadialSpeed2[cf];
                        b = this.qRadialSpeed2[cc];
                        radialSpeed2 = a + (b - a) * c;
                        radialSpeed += (radialSpeed2 - radialSpeed) * ((rndFactor * 100.0) % 1.0);

                        particlePosPrev.x = this.particleTex[id * particleTexChannels];
                        particlePosPrev.y = this.particleTex[id * particleTexChannels + 1];
                        particlePosPrev.z = this.particleTex[id * particleTexChannels + 2];

                        if (!this.localSpace)
                            radialVelocityVec.copy(particlePosPrev).sub(emitterPos);
                        else
                            radialVelocityVec.copy(particlePosPrev);
                        radialVelocityVec.normalize().scale(radialSpeed);

                        cf *= 3;
                        cc *= 3;

                        // localVelocityVec.data =  tex1D(this.qLocalVelocity, nlife, 3, localVelocityVec.data);
                        a = this.qLocalVelocity[cf];
                        b = this.qLocalVelocity[cc];
                        localVelocityVec.x = a + (b - a) * c;
                        a = this.qLocalVelocity[cf + 1];
                        b = this.qLocalVelocity[cc + 1];
                        localVelocityVec.y = a + (b - a) * c;
                        a = this.qLocalVelocity[cf + 2];
                        b = this.qLocalVelocity[cc + 2];
                        localVelocityVec.z = a + (b - a) * c;

                        // localVelocityVec2.data = tex1D(this.qLocalVelocity2, nlife, 3, localVelocityVec2.data);
                        a = this.qLocalVelocity2[cf];
                        b = this.qLocalVelocity2[cc];
                        localVelocityVec2.x = a + (b - a) * c;
                        a = this.qLocalVelocity2[cf + 1];
                        b = this.qLocalVelocity2[cc + 1];
                        localVelocityVec2.y = a + (b - a) * c;
                        a = this.qLocalVelocity2[cf + 2];
                        b = this.qLocalVelocity2[cc + 2];
                        localVelocityVec2.z = a + (b - a) * c;

                        // velocityVec.data =       tex1D(this.qVelocity, nlife, 3, velocityVec.data);
                        a = this.qVelocity[cf];
                        b = this.qVelocity[cc];
                        velocityVec.x = a + (b - a) * c;
                        a = this.qVelocity[cf + 1];
                        b = this.qVelocity[cc + 1];
                        velocityVec.y = a + (b - a) * c;
                        a = this.qVelocity[cf + 2];
                        b = this.qVelocity[cc + 2];
                        velocityVec.z = a + (b - a) * c;

                        // velocityVec2.data =      tex1D(this.qVelocity2, nlife, 3, velocityVec2.data);
                        a = this.qVelocity2[cf];
                        b = this.qVelocity2[cc];
                        velocityVec2.x = a + (b - a) * c;
                        a = this.qVelocity2[cf + 1];
                        b = this.qVelocity2[cc + 1];
                        velocityVec2.y = a + (b - a) * c;
                        a = this.qVelocity2[cf + 2];
                        b = this.qVelocity2[cc + 2];
                        velocityVec2.z = a + (b - a) * c;

                        localVelocityVec.x += (localVelocityVec2.x - localVelocityVec.x) * rndFactor3Vec.x;
                        localVelocityVec.y += (localVelocityVec2.y - localVelocityVec.y) * rndFactor3Vec.y;
                        localVelocityVec.z += (localVelocityVec2.z - localVelocityVec.z) * rndFactor3Vec.z;

                        if (this.initialVelocity > 0) {
                            if (this.emitterShape === pc.EMITTERSHAPE_SPHERE) {
                                randomPos.copy(rndFactor3Vec).scale(2).sub(pc.Vec3.ONE).normalize();
                                localVelocityVec.add(randomPos.scale(this.initialVelocity));
                            } else {
                                localVelocityVec.add(pc.Vec3.FORWARD.scale(this.initialVelocity));
                            }
                        }

                        velocityVec.x += (velocityVec2.x - velocityVec.x) * rndFactor3Vec.x;
                        velocityVec.y += (velocityVec2.y - velocityVec.y) * rndFactor3Vec.y;
                        velocityVec.z += (velocityVec2.z - velocityVec.z) * rndFactor3Vec.z;

                        rotSpeed += (rotSpeed2 - rotSpeed) * rndFactor3Vec.y;
                        scale = (scale + (scale2 - scale) * ((rndFactor * 10000.0) % 1.0)) * uniformScale;
                        alphaDiv = (alpha2 - alpha) * ((rndFactor * 1000.0) % 1.0);

                        if (this.meshInstance.node) {
                            if (!this.localSpace) {
                                rotMat.transformPoint(localVelocityVec, localVelocityVec);
                            } else {
                                localVelocityVec.x /= nonUniformScale.x;
                                localVelocityVec.y /= nonUniformScale.y;
                                localVelocityVec.z /= nonUniformScale.z;
                            }

                        }
                        if (!this.localSpace) {
                            localVelocityVec.add(velocityVec.mul(nonUniformScale));
                            localVelocityVec.add(radialVelocityVec.mul(nonUniformScale));
                        } else {
                            velocityVec.add(radialVelocityVec);
                            rotMatInv.transformPoint(velocityVec, velocityVec);
                            localVelocityVec.add(velocityVec);
                        }

                        moveDirVec.copy(localVelocityVec);

                        particlePos.copy(particlePosPrev).add(localVelocityVec.scale(delta));
                        particleFinalPos.copy(particlePos);

                        this.particleTex[id * particleTexChannels] =      particleFinalPos.x;
                        this.particleTex[id * particleTexChannels + 1] =  particleFinalPos.y;
                        this.particleTex[id * particleTexChannels + 2] =  particleFinalPos.z;
                        this.particleTex[id * particleTexChannels + 3] += rotSpeed * delta;

                        if (this.wrap && this.wrapBounds) {
                            if (!this.localSpace)
                                particleFinalPos.sub(emitterPos);
                            particleFinalPos.x = glMod(particleFinalPos.x, this.wrapBounds.x) - this.wrapBounds.x * 0.5;
                            particleFinalPos.y = glMod(particleFinalPos.y, this.wrapBounds.y) - this.wrapBounds.y * 0.5;
                            particleFinalPos.z = glMod(particleFinalPos.z, this.wrapBounds.z) - this.wrapBounds.z * 0.5;
                            if (!this.localSpace)
                                particleFinalPos.add(emitterPos);
                        }

                        if (this.sort > 0) {
                            if (this.sort === 1) {
                                tmpVec3.copy(particleFinalPos).sub(posCam);
                                this.particleDistance[id] = -(tmpVec3.x * tmpVec3.x + tmpVec3.y * tmpVec3.y + tmpVec3.z * tmpVec3.z);
                            } else if (this.sort === 2) {
                                this.particleDistance[id] = life;
                            } else if (this.sort === 3) {
                                this.particleDistance[id] = -life;
                            }
                        }
                    } else {
                        this.calcSpawnPosition(emitterPos, id);
                    }

                    if (isOnStop) {
                        if (life < 0) {
                            this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = -1;
                        }
                    } else {
                        if (life >= particleLifetime) {
                            // respawn particle by moving it's life back to zero.
                            // OR below zero, if there are still unspawned particles to be emitted before this one.
                            // such thing happens when you have an enormous amount of particles with short lifetime.
                            life -= Math.max(particleLifetime, (this.numParticles - 1) * particleRate);

                            // dead particles in a single-shot system continue their paths, but marked as invisible.
                            // it is necessary for keeping correct separation between particles, based on emission rate.
                            // dying again in a looped system they will become visible on next respawn.
                            this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = this.loop ? 1 : -1;
                        }
                        if (life < 0 && this.loop) {
                            this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1;
                        }
                    }
                    if (this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] < 0) particleEnabled = false;
                    this.particleTex[id * particleTexChannels + 3 + this.numParticlesPot * particleTexChannels] = life;

                    for (var v = 0; v < this.numParticleVerts; v++) {
                        var quadX = this.vbCPU[i * this.numParticleVerts * 4 + v * 4];
                        var quadY = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 1];
                        var quadZ = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 2];
                        if (!particleEnabled) {
                            quadX = quadY = quadZ = 0;
                        }

                        var w = i * this.numParticleVerts * vertSize + v * vertSize;
                        data[w] = particleFinalPos.x;
                        data[w + 1] = particleFinalPos.y;
                        data[w + 2] = particleFinalPos.z;
                        data[w + 3] = nlife;
                        data[w + 4] = this.alignToMotion ? angle : this.particleTex[id * particleTexChannels + 3];
                        data[w + 5] = scale;
                        data[w + 6] = alphaDiv;
                        data[w + 7] = moveDirVec.x;
                        data[w + 8] = quadX;
                        data[w + 9] = quadY;
                        data[w + 10] = quadZ;
                        data[w + 11] = moveDirVec.y;
                        data[w + 12] = moveDirVec.z;
                        // 13 is particle id
                    }
                }

                // Particle sorting
                // TODO: optimize
                if (this.sort > pc.PARTICLESORT_NONE && this.camera) {
                    var particleDistance = this.particleDistance;
                    for (i = 0; i < this.numParticles; i++) {
                        this.vbToSort[i] = [i, particleDistance[Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3])]]; // particle id
                    }

                    this.vbOld.set(this.vbCPU);

                    this.vbToSort.sort(function (p1, p2) {
                        return p1[1] - p2[1];
                    });

                    for (i = 0; i < this.numParticles; i++) {
                        var src = this.vbToSort[i][0] * this.numParticleVerts * 4;
                        var dest = i * this.numParticleVerts * 4;
                        for (j = 0; j < this.numParticleVerts * 4; j++) {
                            this.vbCPU[dest + j] = this.vbOld[src + j];
                        }
                    }
                }

                // this.vertexBuffer.unlock();
            }

            if (!this.loop) {
                if (Date.now() > this.endTime) {
                    if (this.onFinished) this.onFinished();
                    this.meshInstance.visible = false;
                }
            }

            // #ifdef PROFILER
            this._addTimeTime += pc.now() - startTime;
            // #endif
        },

        _destroyResources: function () {
            if (this.particleTexIN) {
                this.particleTexIN.destroy();
                this.particleTexIN = null;
            }

            if (this.particleTexOUT) {
                this.particleTexOUT.destroy();
                this.particleTexOUT = null;
            }

            if (this.particleTexStart && this.particleTexStart.destroy) {
                this.particleTexStart.destroy();
                this.particleTexStart = null;
            }

            if (this.rtParticleTexIN) {
                this.rtParticleTexIN.destroy();
                this.rtParticleTexIN = null;
            }

            if (this.rtParticleTexOUT) {
                this.rtParticleTexOUT.destroy();
                this.rtParticleTexOUT = null;
            }

            if (this.internalTex0) {
                this.internalTex0.destroy();
                this.internalTex0 = null;
            }

            if (this.internalTex1) {
                this.internalTex1.destroy();
                this.internalTex1 = null;
            }

            if (this.internalTex2) {
                this.internalTex2.destroy();
                this.internalTex2 = null;
            }

            if (this.internalTex3) {
                this.internalTex3.destroy();
                this.internalTex3 = null;
            }

            if (this.colorParam) {
                this.colorParam.destroy();
                this.colorParam = null;
            }

            if (this.vertexBuffer) {
                this.vertexBuffer.destroy();
                this.vertexBuffer = undefined; // we are testing if vb is undefined in some code, no idea why
            }

            if (this.indexBuffer) {
                this.indexBuffer.destroy();
                this.indexBuffer = undefined;
            }

            if (this.material) {
                this.material.destroy();
                this.material = null;
            }

            // note: shaders should not be destroyed as they could be shared between emitters
        },

        destroy: function () {
            this.camera = null;

            this._destroyResources();
        }
    });

    return {
        ParticleEmitter: ParticleEmitter
    };
}());
