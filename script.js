// Lightweight Three.js scene with binary STL fallback and drag+inertia
// Creates a rotating 3D logo area; will try to fetch STL from common paths

(function(){
  const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';

  function loadThreeIfMissing(cb){
    if(window.THREE) return cb();
    const s = document.createElement('script');
    s.src = THREE_CDN;
    s.onload = cb;
    s.onerror = ()=>{ console.error('Failed to load THREE from CDN'); cb(); };
    document.head.appendChild(s);
  }

  function parseBinarySTL(buffer){
    const view = new DataView(buffer);
    const triangles = view.getUint32(80, true);
    const positions = [];
    let offset = 84;
    for(let i=0;i<triangles;i++){
      // skip normal (3 floats)
      offset += 12;
      for(let v=0;v<3;v++){
        const x = view.getFloat32(offset, true); offset +=4;
        const y = view.getFloat32(offset, true); offset +=4;
        const z = view.getFloat32(offset, true); offset +=4;
        positions.push(x,y,z);
      }
      offset += 2; // attribute byte count
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }

  function tryFetchSTL(url){
    return fetch(url).then(r=>{
      if(!r.ok) throw new Error('not ok');
      return r.arrayBuffer();
    });
  }

  function createScene(container){
    const width = window.innerWidth;
    const height = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(width,height);
    renderer.setClearColor(0x000000,1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 2000);
    camera.position.set(0,0,150);

    const light = new THREE.DirectionalLight(0xffffff,1.0);
    light.position.set(1,1,1).normalize();
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    const logoGroup = new THREE.Group();
    scene.add(logoGroup);

    const material = new THREE.MeshStandardMaterial({color:0xaaaaaa, metalness:0.6, roughness:0.3});

    const candidates = ['./assets/logo.stl','./Assets/logo.stl','./43.stl','./Assets/43.stl','./assets/43.stl','./logo.stl'];

    function addFallback(){
      const geo = new THREE.TorusKnotGeometry(20,6,128,24);
      const mesh = new THREE.Mesh(geo, material);
      logoGroup.add(mesh);
      frameObject(mesh);
    }

    async function loadModel(){
      for(const p of candidates){
        try{
          const buf = await tryFetchSTL(p);
          const geom = parseBinarySTL(buf);
          const mesh = new THREE.Mesh(geom, material);
          logoGroup.add(mesh);
          frameObject(mesh);
          console.log('Loaded STL from', p);
          return;
        }catch(e){ /* try next */ }
      }
      console.warn('No STL found; using fallback geometry');
      addFallback();
    }

    function frameObject(obj){
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      camera.position.z = Math.max(80, size*1.5);
    }

    // Interaction: drag to rotate with inertia; wheel to zoom
    let dragging=false, lastX=0, lastY=0, velX=0, velY=0;
    function onPointerDown(e){ dragging=true; lastX=e.clientX; lastY=e.clientY; }
    function onPointerMove(e){ if(!dragging) return; const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX=e.clientX; lastY=e.clientY; logoGroup.rotation.y += dx * 0.01; logoGroup.rotation.x += dy * 0.01; velX = dx * 0.01; velY = dy * 0.01; }
    function onPointerUp(){ dragging=false; }
    function onWheel(e){ e.preventDefault(); camera.position.z += e.deltaY * 0.05; camera.position.z = Math.max(20, Math.min(2000, camera.position.z)); }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, {passive:false});

    function animate(){
      requestAnimationFrame(animate);
      // inertia
      if(Math.abs(velX) > 1e-4 || Math.abs(velY) > 1e-4){
        logoGroup.rotation.y += velX; logoGroup.rotation.x += velY;
        velX *= 0.92; velY *= 0.92;
      }
      renderer.render(scene, camera);
    }

    loadModel().then(()=>animate()).catch(()=>{ addFallback(); animate(); });

    window.addEventListener('resize', ()=>{
      const w = window.innerWidth; const h = window.innerHeight;
      renderer.setSize(w,h);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    loadThreeIfMissing(()=>{
      const container = document.getElementById('logo3d') || document.body;
      createScene(container);
    });
  });
})();
