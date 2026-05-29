import { config } from "../config.js";
import {
  checkOpenWaHealth,
  tryRecoverOpenWaSession,
} from "./openwaHealth.js";

let lastRecoveryAt = 0;
let consecutiveFailures = 0;

export function startOpsWatchdog(): void {
  if (!config.ops.watchdogEnabled) {
    return;
  }

  const intervalMs = config.ops.watchdogIntervalSeconds * 1000;

  setInterval(() => {
    void runWatchdogCheck();
  }, intervalMs);

  console.log(
    `Watchdog operativo cada ${config.ops.watchdogIntervalSeconds}s`,
  );
}

async function runWatchdogCheck(): Promise<void> {
  const health = await checkOpenWaHealth();

  if (health.ok) {
    if (consecutiveFailures > 0) {
      console.log("[watchdog] OpenWA recuperado");
    }
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures += 1;
  console.warn(
    `[watchdog] OpenWA no saludable (${consecutiveFailures}): ${health.reason ?? "desconocido"}`,
  );

  const cooldownMs = config.ops.recoveryCooldownSeconds * 1000;
  const now = Date.now();
  if (now - lastRecoveryAt < cooldownMs) {
    return;
  }

  lastRecoveryAt = now;
  const recovered = await tryRecoverOpenWaSession();
  if (recovered) {
    console.log("[watchdog] Sesión OpenWA reiniciada correctamente");
    consecutiveFailures = 0;
  } else {
    console.warn(
      "[watchdog] No se pudo recuperar OpenWA — ejecuta ./scripts/setup-openwa.sh",
    );
  }
}
