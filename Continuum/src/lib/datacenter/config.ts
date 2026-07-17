import type { FaultType, GpuNode, NodeMetrics, NumericMetricKey } from "./types";

const nodeMetrics = (
  gpuUtil: number,
  memoryUtil: number,
  temperature: number,
  powerWatts: number,
): NodeMetrics => ({
  gpuUtil,
  memoryUtil,
  temperature,
  powerWatts,
  heartbeat: true,
  eccErrors: 0,
  networkLoss: 0.02,
});

export const DATACENTER = {
  company: "Meridian Financial",
  site: "US East · Ashburn 02",
  cluster: "Risk Compute",
  provider: "Synthetic client telemetry · live Continuim control plane",
  sla: "99.99%",
};

export const INITIAL_NODES: GpuNode[] = [
  { id: "gpu-01", label: "gpu-01", rack: "Rack A", model: "NVIDIA H100 SXM", workload: "Market risk · shard 1", health: "healthy", metrics: nodeMetrics(78, 71, 64, 616) },
  { id: "gpu-02", label: "gpu-02", rack: "Rack A", model: "NVIDIA H100 SXM", workload: "Market risk · shard 2", health: "healthy", metrics: nodeMetrics(74, 68, 62, 598) },
  { id: "gpu-03", label: "gpu-03", rack: "Rack A", model: "NVIDIA H100 SXM", workload: "Counterparty model", health: "healthy", metrics: nodeMetrics(83, 77, 67, 642) },
  { id: "gpu-04", label: "gpu-04", rack: "Rack A", model: "NVIDIA H100 SXM", workload: "Liquidity simulation", health: "healthy", metrics: nodeMetrics(69, 65, 60, 574) },
  { id: "gpu-05", label: "gpu-05", rack: "Rack B", model: "NVIDIA H100 SXM", workload: "Stress testing · shard 1", health: "healthy", metrics: nodeMetrics(88, 81, 70, 671) },
  { id: "gpu-06", label: "gpu-06", rack: "Rack B", model: "NVIDIA H100 SXM", workload: "Stress testing · shard 2", health: "healthy", metrics: nodeMetrics(81, 75, 66, 628) },
  { id: "gpu-07", label: "gpu-07", rack: "Rack B", model: "NVIDIA H100 SXM", workload: "Intraday VaR", health: "healthy", metrics: nodeMetrics(76, 70, 64, 603) },
  { id: "gpu-08", label: "gpu-08", rack: "Rack B", model: "NVIDIA H100 SXM", workload: "Failover reserve", health: "healthy", metrics: nodeMetrics(12, 18, 44, 238) },
];

export const FAULT_OPTIONS: Array<{
  id: FaultType;
  label: string;
  description: string;
}> = [
  { id: "node_offline", label: "Node offline", description: "Stop heartbeat and GPU output" },
  { id: "thermal_runaway", label: "Thermal runaway", description: "Raise GPU temperature above 90°C" },
  { id: "ecc_spike", label: "ECC error spike", description: "Emit uncorrectable memory errors" },
  { id: "network_loss", label: "Fabric packet loss", description: "Degrade east-west GPU traffic" },
  { id: "power_failure", label: "Power interruption", description: "Drop node power and capacity" },
];

export const METRIC_OPTIONS: Array<{
  id: NumericMetricKey;
  label: string;
  unit: string;
}> = [
  { id: "gpuUtil", label: "GPU utilization", unit: "%" },
  { id: "memoryUtil", label: "HBM utilization", unit: "%" },
  { id: "temperature", label: "Temperature", unit: "°C" },
  { id: "powerWatts", label: "Power draw", unit: "W" },
  { id: "networkLoss", label: "Network loss", unit: "%" },
  { id: "eccErrors", label: "ECC errors", unit: "" },
];
