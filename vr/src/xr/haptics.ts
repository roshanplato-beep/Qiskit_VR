import { xrStore } from './xrStore';

/** Short controller haptic pulse on every connected controller (safe no-op outside XR / without actuators). */
export function haptic(intensity = 0.6, ms = 30): void {
  try {
    const session = xrStore.getState().session;
    if (!session) return;
    for (const src of session.inputSources) {
      const gp: any = src.gamepad;
      if (!gp) continue;
      const act = gp.hapticActuators?.[0];
      if (act?.pulse) void act.pulse(intensity, ms);
      else gp.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity });
    }
  } catch { /* haptics are optional */ }
}
