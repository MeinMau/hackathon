"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import ScreenOS from "../ScreenOS";
import {
  LAPTOP_MOTION,
  SCROLL_PHASES,
  clamp01,
  lerp,
  phaseProgress,
} from "./laptopAnimation";
import styles from "./LaptopExperience.module.css";

type LaptopLayout = {
  screenWidth: number;
  screenHeight: number;
  lidWidth: number;
  lidHeight: number;
  baseWidth: number;
  baseDepth: number;
  baseThickness: number;
  bezel: number;
};

function createLaptopMaterials() {
  return {
    base: new THREE.MeshStandardMaterial({
      color: 0x07194d,
      roughness: 0.62,
      metalness: 0.22,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: 0x0d2d7b,
      roughness: 0.48,
      metalness: 0.28,
    }),
    screenGlass: new THREE.MeshStandardMaterial({
      color: 0x06113d,
      roughness: 0.26,
      metalness: 0.08,
      emissive: 0x102b72,
      emissiveIntensity: 0.34,
    }),
    hinge: new THREE.MeshStandardMaterial({
      color: 0x334eac,
      roughness: 0.5,
      metalness: 0.38,
    }),
  };
}

function calculateLayout(width: number, height: number): LaptopLayout {
  const viewportAspect = width / Math.max(height, 1);
  const screenHeight = LAPTOP_MOTION.screenHeight;
  const screenWidth = screenHeight * viewportAspect;
  const bezel = LAPTOP_MOTION.bezel;

  return {
    screenWidth,
    screenHeight,
    lidWidth: screenWidth + bezel * 2,
    lidHeight: screenHeight + bezel * 2,
    baseWidth: screenWidth + 0.62,
    baseDepth: LAPTOP_MOTION.baseDepth,
    baseThickness: LAPTOP_MOTION.baseThickness,
    bezel,
  };
}

function setBoxGeometry(mesh: THREE.Mesh, width: number, height: number, depth: number) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BoxGeometry(width, height, depth);
}

function setPlaneGeometry(mesh: THREE.Mesh, width: number, height: number) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width, height);
}

export default function LaptopExperience() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const screenHost = screenHostRef.current;

    if (!section || !stage || !canvas || !screenHost) {
      return;
    }

    const sectionElement = section;
    const stageElement = stage;
    const screenElement = screenHost;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(LAPTOP_MOTION.initialFov, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    const materials = createLaptopMaterials();
    const laptopGroup = new THREE.Group();
    const lidPivot = new THREE.Group();
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.base);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.edge);
    const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), materials.screenGlass);
    const hingeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 18), materials.hinge);
    const rimMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.hinge);
    const resizeObserver = new ResizeObserver(() => resize());
    let layout = calculateLayout(window.innerWidth, window.innerHeight);
    let animationFrameId = 0;
    let progress = 0;
    let disposed = false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.HemisphereLight(0xd0e3ff, 0x081f5c, 2.4));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(1.8, 4, 4.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7096d1, 1.2);
    fillLight.position.set(-3, 2, 2);
    scene.add(fillLight);

    laptopGroup.rotation.y = -0.24;
    laptopGroup.rotation.x = -0.04;
    laptopGroup.position.y = -0.52;
    scene.add(laptopGroup);

    laptopGroup.add(baseMesh);
    laptopGroup.add(hingeMesh);
    laptopGroup.add(lidPivot);

    lidPivot.add(lidMesh);
    lidPivot.add(glassMesh);
    lidPivot.add(rimMesh);

    function applyLayout(nextLayout: LaptopLayout) {
      layout = nextLayout;

      setBoxGeometry(baseMesh, layout.baseWidth, layout.baseThickness, layout.baseDepth);
      baseMesh.position.set(0, 0, 0);

      hingeMesh.geometry.dispose();
      hingeMesh.geometry = new THREE.CylinderGeometry(0.045, 0.045, layout.baseWidth * 0.94, 18);
      hingeMesh.rotation.z = Math.PI / 2;
      hingeMesh.position.set(0, layout.baseThickness * 0.72, -layout.baseDepth / 2 + 0.08);

      lidPivot.position.set(0, layout.baseThickness * 0.75, -layout.baseDepth / 2 + 0.08);

      setBoxGeometry(lidMesh, layout.lidWidth, layout.lidHeight, 0.12);
      lidMesh.position.set(0, layout.lidHeight / 2, 0);

      setPlaneGeometry(glassMesh, layout.screenWidth, layout.screenHeight);
      glassMesh.position.set(0, layout.bezel + layout.screenHeight / 2, 0.064);

      setBoxGeometry(rimMesh, layout.lidWidth, 0.04, 0.14);
      rimMesh.position.set(0, layout.lidHeight + 0.01, 0.012);
    }

    function resize() {
      if (disposed) {
        return;
      }

      const rect = stageElement.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      applyLayout(calculateLayout(width, height));
      scheduleRender();
    }

    function getScrollProgress() {
      const rect = sectionElement.getBoundingClientRect();
      const distance = Math.max(sectionElement.offsetHeight - window.innerHeight, 1);
      return clamp01(-rect.top / distance);
    }

    function renderScene() {
      animationFrameId = 0;
      progress = getScrollProgress();

      const opening = phaseProgress(
        SCROLL_PHASES.openingStart,
        SCROLL_PHASES.openingEnd,
        progress,
      );
      const settle = phaseProgress(0, SCROLL_PHASES.openHoldEnd, progress);
      const zoom = phaseProgress(SCROLL_PHASES.zoomStart, SCROLL_PHASES.zoomEnd, progress);
      const fullscreen = phaseProgress(
        SCROLL_PHASES.fullscreenStart,
        SCROLL_PHASES.fullscreenEnd,
        progress,
      );

      lidPivot.rotation.x = lerp(LAPTOP_MOTION.closedAngle, LAPTOP_MOTION.openAngle, opening);
      laptopGroup.rotation.y = lerp(-0.24, 0, zoom);
      laptopGroup.rotation.x = lerp(-0.04, 0, zoom);
      laptopGroup.position.y = lerp(-0.52, -0.2, settle) - zoom * 0.18;
      laptopGroup.position.z = lerp(0.28, 0, settle);

      laptopGroup.updateMatrixWorld(true);
      lidPivot.updateMatrixWorld(true);
      glassMesh.updateMatrixWorld(true);

      const initialCamera = new THREE.Vector3(0.65, 2.1, 6.2);
      const openCamera = new THREE.Vector3(0.36, 1.48, 5.45);
      const initialTarget = new THREE.Vector3(0, 0.08, -0.24);
      const openTarget = new THREE.Vector3(0, 0.22, -0.46);
      const screenCenter = new THREE.Vector3();
      const screenNormal = new THREE.Vector3(0, 0, 1);
      const screenUp = new THREE.Vector3(0, 1, 0);

      glassMesh.getWorldPosition(screenCenter);
      screenNormal.applyQuaternion(glassMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
      screenUp.applyQuaternion(glassMesh.getWorldQuaternion(new THREE.Quaternion())).normalize();

      camera.fov = lerp(LAPTOP_MOTION.initialFov, LAPTOP_MOTION.finalFov, zoom);
      camera.updateProjectionMatrix();

      const finalDistance =
        (layout.screenHeight / 2) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const finalCamera = screenCenter.clone().addScaledVector(screenNormal, finalDistance * lerp(1.22, 1, fullscreen));
      const cameraStart = initialCamera.lerp(openCamera, settle);
      const targetStart = initialTarget.lerp(openTarget, settle);

      camera.position.copy(cameraStart.lerp(finalCamera, zoom));
      const target = targetStart.lerp(screenCenter, zoom);
      camera.up.set(0, 1, 0).lerp(screenUp, zoom).normalize();
      camera.lookAt(target);

      const stageWidth = stageElement.clientWidth;
      const stageHeight = stageElement.clientHeight;
      const screenAspect = stageWidth / Math.max(stageHeight, 1);
      const closedWidth = Math.min(stageWidth * 0.48, 700);
      const openWidth = Math.min(stageWidth * 0.62, 900);
      const zoomWidth = lerp(openWidth, stageWidth, zoom);
      const surfaceWidth = lerp(lerp(closedWidth, openWidth, opening), zoomWidth, zoom);
      const surfaceHeight = lerp(surfaceWidth / screenAspect, stageHeight, fullscreen);
      const surfaceLeft = lerp(stageWidth * 0.49, stageWidth * 0.5, zoom);
      const surfaceTop = lerp(
        lerp(stageHeight * 0.62, stageHeight * 0.47, opening),
        stageHeight * 0.5,
        zoom,
      );
      const rotateX = lerp(78, 0, opening);
      const rotateY = lerp(-10, 0, zoom);
      const rotateZ = lerp(-2, 0, zoom);
      const perspective = lerp(980, 2200, zoom);
      const interactive = progress > 0.985;
      screenElement.style.left = `${surfaceLeft}px`;
      screenElement.style.top = `${surfaceTop}px`;
      screenElement.style.width = `${surfaceWidth}px`;
      screenElement.style.height = `${surfaceHeight}px`;
      screenElement.style.transform = `translate3d(-50%, -50%, 0) perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
      screenElement.style.pointerEvents = interactive ? "auto" : "none";
      screenElement.dataset.interactive = interactive ? "true" : "false";
      screenElement.dataset.fullscreen = progress > 0.94 ? "true" : "false";

      renderer.render(scene, camera);
    }

    function scheduleRender() {
      if (!animationFrameId) {
        animationFrameId = window.requestAnimationFrame(renderScene);
      }
    }

    applyLayout(layout);
    resizeObserver.observe(stageElement);
    window.addEventListener("scroll", scheduleRender, { passive: true });
    window.addEventListener("resize", resize);
    resize();

    return () => {
      disposed = true;
      window.removeEventListener("scroll", scheduleRender);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      renderer.dispose();

      [baseMesh, lidMesh, glassMesh, hingeMesh, rimMesh].forEach((mesh) => mesh.geometry.dispose());
      Object.values(materials).forEach((material) => material.dispose());
    };
  }, []);

  return (
    <section id="terminal" className={styles.section} ref={sectionRef}>
      <div className={styles.stickyScene} ref={stageRef}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div
          className={styles.screenSurface}
          data-interactive="false"
          ref={screenHostRef}
        >
          <ScreenOS />
        </div>
      </div>
    </section>
  );
}
