import type { DetectionResult, GpuNode } from "./types";

export function evaluateNode(node: GpuNode): DetectionResult | null {
  if (!node.metrics.heartbeat) {
    return {
      ruleId: "node-heartbeat",
      title: `${node.label} stopped reporting`,
      evidence: "DCGM heartbeat absent for 2 consecutive samples; cluster quorum is at risk.",
      severity: "critical",
    };
  }

  if (node.metrics.temperature >= 88) {
    return {
      ruleId: "gpu-thermal",
      title: `${node.label} exceeded its thermal policy`,
      evidence: `GPU temperature reached ${Math.round(node.metrics.temperature)}°C; policy limit is 88°C.`,
      severity: "critical",
    };
  }

  if (node.metrics.eccErrors >= 4) {
    return {
      ruleId: "gpu-ecc",
      title: `${node.label} reported uncorrectable ECC errors`,
      evidence: `${node.metrics.eccErrors} uncorrectable errors observed in the current detection window.`,
      severity: "critical",
    };
  }

  if (node.metrics.networkLoss >= 4) {
    return {
      ruleId: "fabric-loss",
      title: `${node.label} has degraded fabric connectivity`,
      evidence: `${node.metrics.networkLoss.toFixed(1)}% packet loss exceeds the 4% fabric threshold.`,
      severity: "warning",
    };
  }

  return null;
}
