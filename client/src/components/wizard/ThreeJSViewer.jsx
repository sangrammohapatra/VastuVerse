import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Stack, Typography, IconButton, ToggleButton, ToggleButtonGroup, ButtonGroup, Button, Tooltip, Snackbar, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { api } from '../../utils/axiosInstance';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/* ─── Constants ─────────────────────────────────────────────────────── */

const WALL_HEIGHT_FT = 10;        // typical Indian residential
const SLAB_THICKNESS_FT = 1;       // visual gap between floors
const FLOOR_SPACING = WALL_HEIGHT_FT + SLAB_THICKNESS_FT;
const WALL_OPACITY = 0.35;         // see-through enough to view interior
const VIEWER_HEIGHT = 520;

/* ─── Helper colour utilities ──────────────────────────────────────── */

function lighten(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return c.getHex();
}

/* ─── Build a single floor group ───────────────────────────────────── */

function buildFloorGroup({ rooms, plotW, plotH, yOffset, palette, labelsEnabled, theme }) {
  const group = new THREE.Group();
  group.position.y = yOffset;

  // Slab (floor plate)
  const slabGeom = new THREE.BoxGeometry(plotW, 0.4, plotH);
  const slabColor = palette?.colors?.[2] || '#F0E9D6';
  const slabMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(slabColor),
    roughness: 0.85,
    metalness: 0.05,
  });
  const slab = new THREE.Mesh(slabGeom, slabMat);
  slab.position.set(plotW / 2, -0.2, plotH / 2);
  slab.receiveShadow = true;
  group.add(slab);

  // Plot perimeter (subtle outline)
  const perimeter = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(plotW, 0.05, plotH)),
    new THREE.LineBasicMaterial({ color: 0x2E7D32, transparent: true, opacity: 0.6 })
  );
  perimeter.position.set(plotW / 2, 0, plotH / 2);
  group.add(perimeter);

  // Each room: a coloured floor patch + four wall planes + a label
  rooms.forEach((r) => {
    const baseColor = r.color || '#9E9E9E';
    const cx = r.x + r.w / 2;
    const cz = r.y + r.h / 2;

    // Room subgroup so we can attach userData for the raycaster
    const roomGroup = new THREE.Group();
    roomGroup.userData = { roomId: r.id, label: r.label, kind: r.kind, w: r.w, h: r.h };

    // Coloured floor patch
    const patchGeom = new THREE.PlaneGeometry(r.w - 0.3, r.h - 0.3);
    const patchMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      transparent: true,
      opacity: 0.55,
      roughness: 0.7,
    });
    const patch = new THREE.Mesh(patchGeom, patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(cx, 0.05, cz);
    patch.receiveShadow = true;
    roomGroup.add(patch);

    // Walls (4 planes)
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(lighten(baseColor, 0.18)),
      transparent: true,
      opacity: WALL_OPACITY,
      side: THREE.DoubleSide,
      roughness: 0.75,
    });

    // North wall (small z)
    const wN = new THREE.Mesh(new THREE.PlaneGeometry(r.w, WALL_HEIGHT_FT), wallMat);
    wN.position.set(cx, WALL_HEIGHT_FT / 2, r.y);
    wN.rotation.y = 0;
    roomGroup.add(wN);

    // South wall (large z)
    const wS = new THREE.Mesh(new THREE.PlaneGeometry(r.w, WALL_HEIGHT_FT), wallMat);
    wS.position.set(cx, WALL_HEIGHT_FT / 2, r.y + r.h);
    wS.rotation.y = Math.PI;
    roomGroup.add(wS);

    // West wall (small x)
    const wW = new THREE.Mesh(new THREE.PlaneGeometry(r.h, WALL_HEIGHT_FT), wallMat);
    wW.position.set(r.x, WALL_HEIGHT_FT / 2, cz);
    wW.rotation.y = -Math.PI / 2;
    roomGroup.add(wW);

    // East wall
    const wE = new THREE.Mesh(new THREE.PlaneGeometry(r.h, WALL_HEIGHT_FT), wallMat);
    wE.position.set(r.x + r.w, WALL_HEIGHT_FT / 2, cz);
    wE.rotation.y = Math.PI / 2;
    roomGroup.add(wE);

    // Label sprite (CSS2D)
    if (labelsEnabled) {
      const labelEl = document.createElement('div');
      labelEl.className = 'room-label-3d';
      labelEl.textContent = r.label;
      labelEl.style.cssText = `
        background: rgba(0,0,0,0.72);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        border-left: 3px solid ${baseColor};
        font-family: Inter, system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      const labelObj = new CSS2DObject(labelEl);
      labelObj.position.set(cx, WALL_HEIGHT_FT + 0.6, cz);
      roomGroup.add(labelObj);
    }

    // Invisible raycast target sitting at room centre (so hovers feel "the room")
    const hitGeom = new THREE.BoxGeometry(r.w * 0.9, WALL_HEIGHT_FT * 0.6, r.h * 0.9);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hit = new THREE.Mesh(hitGeom, hitMat);
    hit.position.set(cx, WALL_HEIGHT_FT * 0.4, cz);
    hit.userData = { isRoomHit: true, roomId: r.id, label: r.label, kind: r.kind, w: r.w, h: r.h };
    roomGroup.add(hit);

    group.add(roomGroup);
  });

  return group;
}

/* ─────────────────────────────────────────────────────────────────── */

export default function ThreeJSViewer({ planId, plan, option, palette, onShare }) {
  const theme = useTheme();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const labelRendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(null);
  const pointerRef = useRef(new THREE.Vector2());
  const hitTargetsRef = useRef([]);
  const initialCamRef = useRef(null);
  const rafRef = useRef(null);

  const [viewMode, setViewMode] = useState('perspective'); // perspective | top
  const [labelsEnabled, setLabelsEnabled] = useState(true);
  const [tooltip, setTooltip] = useState(null); // { x, y, label, kind, w, h }
  const [shareState, setShareState] = useState({ open: false, url: '', error: '' });
  const [sharing, setSharing] = useState(false);

  const plotW = option?.plotDimensions?.plotW || 30;
  const plotH = option?.plotDimensions?.plotH || 30;
  const totalFloors = option?.floors?.length || 1;
  const sceneSize = Math.max(plotW, plotH, FLOOR_SPACING * totalFloors);

  /* ─── Initialise scene ──────────────────────────────────────────── */
  useEffect(() => {
    if (!mountRef.current || !option) return undefined;
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = VIEWER_HEIGHT;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.palette.mode === 'dark' ? 0x0A0E1A : 0xEEF4EE);

    // Camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
    camera.position.set(plotW * 1.4, sceneSize * 0.9, plotH * 1.4);
    camera.lookAt(plotW / 2, FLOOR_SPACING * (totalFloors - 1) / 2, plotH / 2);
    initialCamRef.current = {
      position: camera.position.clone(),
      target: new THREE.Vector3(plotW / 2, FLOOR_SPACING * (totalFloors - 1) / 2, plotH / 2),
    };

    // Lights — AmbientLight + south-facing DirectionalLight (India: sun mostly in southern sky)
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4d6, 1.0);
    sun.position.set(plotW * 0.3, sceneSize * 1.4, -plotH * 0.6); // south-facing
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -plotW;
    sun.shadow.camera.right = plotW * 2;
    sun.shadow.camera.top = sceneSize;
    sun.shadow.camera.bottom = -sceneSize;
    scene.add(sun);

    // Ground (subtle)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(plotW * 3, plotH * 3),
      new THREE.MeshStandardMaterial({
        color: theme.palette.mode === 'dark' ? 0x132016 : 0xCDE3CD,
        roughness: 0.95,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(plotW / 2, -0.4, plotH / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Floors — stacked vertically
    for (let f = 1; f <= totalFloors; f++) {
      const rooms = (option.rooms || []).filter((r) => r.floor === f);
      const grp = buildFloorGroup({
        rooms,
        plotW, plotH,
        yOffset: (f - 1) * FLOOR_SPACING,
        palette,
        labelsEnabled,
        theme,
      });
      scene.add(grp);
    }

    // North-arrow marker — small red cone above plot top edge
    const arrowGeom = new THREE.ConeGeometry(0.7, 1.8, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xE63946 });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.position.set(plotW * 0.92, 0.2, plotH * 0.08);
    arrow.rotation.x = Math.PI / 2;
    arrow.rotation.z = Math.PI; // point toward smaller-z = "north"
    scene.add(arrow);

    // WebGL renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // CSS2D label renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = sceneSize * 0.4;
    controls.maxDistance = sceneSize * 3;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // can't go under the ground
    controls.target.copy(initialCamRef.current.target);
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN, // pinch = zoom, two-finger drag = pan
    };

    // Collect hit targets for raycaster
    const hits = [];
    scene.traverse((obj) => { if (obj.userData?.isRoomHit) hits.push(obj); });

    // Save refs
    sceneRef.current = scene;
    rendererRef.current = renderer;
    labelRendererRef.current = labelRenderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    raycasterRef.current = new THREE.Raycaster();
    hitTargetsRef.current = hits;

    // Resize handling
    const resize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = VIEWER_HEIGHT;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Pointer (hover/tap) handling
    const onPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      pointerRef.current.x = x * 2 - 1;
      pointerRef.current.y = -y * 2 + 1;

      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(hits, false);
      if (intersects.length > 0) {
        const d = intersects[0].object.userData;
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          label: d.label, kind: d.kind, w: d.w, h: d.h,
        });
      } else {
        setTooltip(null);
      }
    };
    const onLeave = () => setTooltip(null);
    renderer.domElement.addEventListener('pointermove', onPointer);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    // Render loop
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    /* ─── Cleanup ───────────────────────────────────────────────── */
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointer);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();

      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      if (mount.contains(labelRenderer.domElement)) mount.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option?.id, palette?.id, labelsEnabled, theme.palette.mode]);

  /* ─── Reset view ────────────────────────────────────────────────── */
  const resetView = useCallback(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const init = initialCamRef.current;
    if (!cam || !ctrl || !init) return;
    cam.position.copy(init.position);
    ctrl.target.copy(init.target);
    ctrl.enableRotate = true;
    setViewMode('perspective');
  }, []);

  /* ─── Top / Perspective toggle ──────────────────────────────────── */
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (viewMode === 'top') {
      cam.position.set(plotW / 2, sceneSize * 1.6, plotH / 2 + 0.001); // slight offset to avoid gimbal lock
      ctrl.target.set(plotW / 2, 0, plotH / 2);
      ctrl.enableRotate = false;
    } else {
      ctrl.enableRotate = true;
    }
  }, [viewMode, plotW, plotH, sceneSize]);

  /* ─── Share ─────────────────────────────────────────────────────── */
  const handleShare = async () => {
    if (!planId) return;
    setSharing(true);
    try {
      const { data } = await api.post(`/plans/${planId}/share-3d`);
      const url = data.url;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
      setShareState({ open: true, url, error: '' });
      onShare?.(data);
    } catch (e) {
      setShareState({ open: true, url: '', error: e.response?.data?.error || 'Could not create share link' });
    } finally {
      setSharing(false);
    }
  };

  if (!option) {
    return (
      <Alert severity="info" sx={{ borderRadius: 3 }}>
        Select a floor plan in Step 3 before opening the 3D view.
      </Alert>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        background: theme.vastu.cardBg,
        border: theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        boxShadow: theme.vastu.cardShadow,
      }}
    >
      {/* Overlay controls */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          position: 'absolute',
          top: 12, left: 12, right: 12,
          zIndex: 10, pointerEvents: 'none',
        }}
      >
        <Box sx={{ pointerEvents: 'auto' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_e, v) => v && setViewMode(v)}
            sx={{
              background: theme.palette.background.paper + 'D0',
              backdropFilter: 'blur(8px)',
              boxShadow: theme.vastu.cardShadow,
            }}
          >
            <ToggleButton value="perspective">Perspective</ToggleButton>
            <ToggleButton value="top">Top</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={0.8} sx={{ pointerEvents: 'auto' }}>
          <Tooltip title={labelsEnabled ? 'Hide labels' : 'Show labels'}>
            <IconButton
              size="small"
              onClick={() => setLabelsEnabled((v) => !v)}
              sx={{
                background: theme.palette.background.paper + 'D0',
                backdropFilter: 'blur(8px)',
                boxShadow: theme.vastu.cardShadow,
              }}
            >
              {labelsEnabled ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset view">
            <IconButton
              size="small"
              onClick={resetView}
              sx={{
                background: theme.palette.background.paper + 'D0',
                backdropFilter: 'blur(8px)',
                boxShadow: theme.vastu.cardShadow,
              }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            startIcon={sharing ? null : <ShareIcon />}
            onClick={handleShare}
            disabled={sharing}
            sx={{
              fontWeight: 700,
              boxShadow: theme.vastu.glowPrimary,
              '&:hover': { boxShadow: `0 0 28px ${theme.palette.primary.main}` },
            }}
          >
            {sharing ? 'Creating link…' : 'Share 3D'}
          </Button>
        </Stack>
      </Stack>

      {/* Canvas mount */}
      <Box
        ref={mountRef}
        sx={{
          width: '100%',
          height: VIEWER_HEIGHT,
          position: 'relative',
          background: theme.palette.mode === 'dark' ? '#0A0E1A' : '#EEF4EE',
        }}
      />

      {/* Tooltip */}
      {tooltip && (
        <Box
          sx={{
            position: 'absolute',
            left: Math.min(Math.max(0, tooltip.x + 12), 320),
            top: tooltip.y + 12,
            zIndex: 12,
            background: theme.palette.background.paper + 'EE',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1.5,
            px: 1.4,
            py: 0.8,
            boxShadow: theme.vastu.cardShadow,
            pointerEvents: 'none',
            minWidth: 130,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            {tooltip.label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {tooltip.kind} · {tooltip.w}′ × {tooltip.h}′
          </Typography>
        </Box>
      )}

      {/* Footer hint */}
      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Drag to rotate · Scroll to zoom · Right-click to pan · Pinch on mobile
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {totalFloors > 1 ? `${totalFloors} floors stacked` : 'Single floor'} · {plotW}′ × {plotH}′
        </Typography>
      </Stack>

      {/* Share-link snackbar */}
      <Snackbar
        open={shareState.open}
        autoHideDuration={shareState.error ? 4000 : 6000}
        onClose={() => setShareState({ ...shareState, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {shareState.error ? (
          <Alert severity="error" onClose={() => setShareState({ ...shareState, open: false })}>
            {shareState.error}
          </Alert>
        ) : (
          <Alert
            severity="success"
            icon={<ContentCopyIcon fontSize="small" />}
            onClose={() => setShareState({ ...shareState, open: false })}
            sx={{ minWidth: 320 }}
          >
            Link copied — valid for 30 days
          </Alert>
        )}
      </Snackbar>
    </Card>
  );
}
