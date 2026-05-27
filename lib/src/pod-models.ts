export interface ButtonPosition {
  name: string;
  anchorPct: { x: number; y: number };
  cssClass: string;
}

export interface PodModel {
  name: string;
  wiredButtons: readonly string[];
  displayName: string;
  imageUrl?: string;
  buttonPositions: readonly ButtonPosition[];
}

export const POD_MODELS: Record<string, PodModel> = {
  "NXS MTB Pod": {
    name: "NXS MTB Pod",
    displayName: "MTB Pod",
    wiredButtons: ["02", "00", "01"],
    buttonPositions: [
      { name: "tune", anchorPct: { x: 52, y: 37 }, cssClass: "pod-button-tune" },
      { name: "up",   anchorPct: { x: 76, y: 37 }, cssClass: "pod-button-up" },
      { name: "down", anchorPct: { x: 81, y: 75 }, cssClass: "pod-button-down" },
      { name: "pair", anchorPct: { x: 55, y: 65 }, cssClass: "pod-button-pair" },
    ],
  },
};

export function getPodModel(deviceName: string): PodModel | undefined {
  return POD_MODELS[deviceName];
}

export function isButtonWired(
  model: PodModel | undefined,
  buttonCode: string,
): boolean {
  if (!model) return true;
  return model.wiredButtons.includes(buttonCode.toUpperCase());
}
