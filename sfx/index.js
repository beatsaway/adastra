/**
 * Ship procedural SFX — doors, ambience, hub year tones.
 */

export { resumeAudio, getAudioCtx } from "./ctx.js";
export { playDoorOpen, playDoorClose, playDoorDenied, playDoorAuth } from "./door.js";
export { playBriefStart } from "./brief.js";
export { ShipAmbience } from "./ambience.js";
export { ProximityTransformerHum } from "./transformer.js";
export {
  playYearReveal,
  playYearCollapse,
  playYearHover,
  playYearPick,
} from "./hub.js";
