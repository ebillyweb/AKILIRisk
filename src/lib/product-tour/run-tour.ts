"use client";

import { driver, type DriveStep } from "driver.js";
import { TOUR_STEPS } from "@/lib/product-tour/tours/index";
import type { TourId, TourStepDefinition } from "@/lib/product-tour/types";

const STORAGE_PREFIX = "akili-tour-seen:";

function storageKey(tourId: TourId): string {
  return `${STORAGE_PREFIX}${tourId}`;
}

export function hasSeenTour(tourId: TourId): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(storageKey(tourId)) === "1";
}

export function markTourSeen(tourId: TourId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(tourId), "1");
}

function resolveSteps(definitions: TourStepDefinition[]): DriveStep[] {
  return definitions.filter((step) => {
    if (!step.element) return true;
    return document.querySelector(step.element) !== null;
  });
}

export function startProductTour(tourId: TourId): void {
  const definitions = TOUR_STEPS[tourId];
  const steps = resolveSteps(definitions);
  if (steps.length === 0) return;

  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    popoverClass: "akili-driver-popover",
    steps,
    onDestroyed: () => {
      markTourSeen(tourId);
    },
  });

  driverObj.drive();
}
