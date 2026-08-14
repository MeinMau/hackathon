"use client";

import { useEffect } from "react";

const scrollOffset = 118;
const revealThreshold = 120;
const scrollDelta = 8;

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function getAnchorFromClick(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLAnchorElement>("a[href]");
}

export default function SmoothHashNavigation() {
  useEffect(() => {
    let animationFrame = 0;
    let glowTimeout = 0;
    let activeTarget: HTMLElement | null = null;
    let lastScrollY = window.scrollY;
    let navRevealFrame = 0;

    function setNavRevealState(state: "visible" | "hidden", mode: "top" | "floating") {
      document.documentElement.setAttribute("data-nav-reveal", state);
      document.documentElement.setAttribute("data-nav-mode", mode);
    }

    function updateNavReveal() {
      navRevealFrame = 0;

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY < revealThreshold) {
        setNavRevealState("visible", "top");
      } else if (delta > scrollDelta) {
        setNavRevealState("hidden", "floating");
      } else if (delta < -scrollDelta) {
        setNavRevealState("visible", "floating");
      }

      if (Math.abs(delta) > scrollDelta) {
        lastScrollY = currentScrollY;
      }
    }

    function scheduleNavRevealUpdate() {
      if (!navRevealFrame) {
        navRevealFrame = window.requestAnimationFrame(updateNavReveal);
      }
    }

    function clearActiveTarget() {
      if (activeTarget) {
        activeTarget.removeAttribute("data-anchor-focus");
        activeTarget = null;
      }
    }

    function highlightTarget(target: HTMLElement | null) {
      window.clearTimeout(glowTimeout);
      clearActiveTarget();

      if (!target) {
        return;
      }

      activeTarget = target;
      activeTarget.setAttribute("data-anchor-focus", "true");
      glowTimeout = window.setTimeout(clearActiveTarget, 1300);
    }

    function focusTarget(target: HTMLElement | null) {
      if (!target) {
        return;
      }

      const hadTabIndex = target.hasAttribute("tabindex");
      const previousTabIndex = target.getAttribute("tabindex");

      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });

      if (hadTabIndex && previousTabIndex !== null) {
        target.setAttribute("tabindex", previousTabIndex);
      } else {
        target.removeAttribute("tabindex");
      }
    }

    function animateScroll(targetY: number, target: HTMLElement | null) {
      window.cancelAnimationFrame(animationFrame);

      const startY = window.scrollY;
      const distance = targetY - startY;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion || Math.abs(distance) < 2) {
        window.scrollTo(0, targetY);
        highlightTarget(target);
        focusTarget(target);
        return;
      }

      const duration = Math.min(950, Math.max(520, Math.abs(distance) * 0.58));
      const startTime = performance.now();

      document.documentElement.setAttribute("data-anchor-scrolling", "true");
      highlightTarget(target);

      function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);

        window.scrollTo(0, startY + distance * eased);

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(step);
          return;
        }

        document.documentElement.removeAttribute("data-anchor-scrolling");
        focusTarget(target);
      }

      animationFrame = window.requestAnimationFrame(step);
    }

    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = getAnchorFromClick(event.target);

      if (!anchor) {
        return;
      }

      const rawHref = anchor.getAttribute("href");
      const isTopLink = rawHref === "#";
      const url = new URL(anchor.href, window.location.href);
      const samePage =
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search;

      if (!samePage || (!url.hash && !isTopLink)) {
        return;
      }

      const targetId = isTopLink ? "" : decodeURIComponent(url.hash.slice(1));
      const target = targetId ? document.getElementById(targetId) : null;

      if (targetId && !target) {
        return;
      }

      event.preventDefault();

      const targetY = target
        ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - scrollOffset)
        : 0;
      const nextUrl = targetId
        ? `${window.location.pathname}${window.location.search}#${encodeURIComponent(targetId)}`
        : `${window.location.pathname}${window.location.search}`;

      window.history.pushState(null, "", nextUrl);
      animateScroll(targetY, target);
    }

    setNavRevealState("visible", window.scrollY < revealThreshold ? "top" : "floating");
    window.addEventListener("scroll", scheduleNavRevealUpdate, { passive: true });
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("scroll", scheduleNavRevealUpdate);
      document.removeEventListener("click", handleClick);
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(navRevealFrame);
      window.clearTimeout(glowTimeout);
      document.documentElement.removeAttribute("data-anchor-scrolling");
      document.documentElement.removeAttribute("data-nav-reveal");
      document.documentElement.removeAttribute("data-nav-mode");
      clearActiveTarget();
    };
  }, []);

  return null;
}
