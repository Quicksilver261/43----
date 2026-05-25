// script.js — Lightweight Three.js scene with binary STL fallback and drag+inertia
// Copy-paste this entire file to replace your current script.js
(function(){
  const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';
  const MOBILE_BREAKPOINT = 800;      // px
  const MOBILE_SCALE = 0.6;           // モバイル時の縮小率（0.5〜0.8 等で調整）

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
      offset += 12; // skip normal (3 floats)
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

    function applyMobileScale(){
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const scale = isMobile ? MOBILE_SCALE : 1.0;
      logoGroup.scale.set(scale, scale, scale);
      // re-frame so camera fits after scaling
      frameObject(logoGroup);
    }

    function addFallback(){
      const geo = new THREE.TorusKnotGeometry(20,6,128,24);
      const mesh = new THREE.Mesh(geo, material);
      logoGroup.add(mesh);
      frameObject(mesh);
      applyMobileScale();
    }

    async function loadModel(){
      for(const p of candidates){
        try{
          const buf = await tryFetchSTL(p);
          const geom = parseBinarySTL(buf);
          const mesh = new THREE.Mesh(geom, material);
          logoGroup.add(mesh);
          frameObject(mesh);
          applyMobileScale();
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

    function onPointerDown(e){
      // preventDefault so touch doesn't scroll
      if(e.cancelable) e.preventDefault();
      dragging=true;
      lastX = e.clientX; lastY = e.clientY;
      // disable page scroll while dragging
      document.body.style.overflow = 'hidden';
      // optional: capture pointer on the canvas
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch(_){}
    }
    function onPointerMove(e){
      if(!dragging) return;
      if(e.cancelable) e.preventDefault();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      logoGroup.rotation.y += dx * 0.01;
      logoGroup.rotation.x += dy * 0.01;
      velX = dx * 0.01; velY = dy * 0.01;
    }
    function onPointerUp(e){
      dragging=false;
      document.body.style.overflow = '';
      try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch(_){}
    }
    function onWheel(e){
      if(e.cancelable) e.preventDefault();
      camera.position.z += e.deltaY * 0.05;
      camera.position.z = Math.max(20, Math.min(2000, camera.position.z));
    }

    // Attach handlers to renderer DOM element for better touch behavior
    renderer.domElement.style.touchAction = 'none'; // also add in CSS: #logo3d { touch-action: none; }
    renderer.domElement.addEventListener('pointerdown', onPointerDown, {passive:false});
    renderer.domElement.addEventListener('pointermove', onPointerMove, {passive:false});
    renderer.domElement.addEventListener('pointerup', onPointerUp, {passive:false});
    renderer.domElement.addEventListener('pointercancel', onPointerUp, {passive:false});
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
      applyMobileScale();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    loadThreeIfMissing(()=>{
      const container = document.getElementById('logo3d') || document.body;
      createScene(container);
    });
  });
})();
