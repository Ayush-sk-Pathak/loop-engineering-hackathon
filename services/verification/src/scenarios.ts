import type { ScenarioId, VendorCandidate } from "@continuim/contracts";
import { DEMO_VENDORS } from "./fixtures.ts";

export interface ScenarioProfile {
  id: ScenarioId;
  label: string;
  industry: string;
  trigger: string;
  item: {
    sku: string;
    displayName: string;
    currentQty: number;
    threshold: number;
    critical: true;
    downtimeCostCentsPerMinute: number;
  };
  vendors: VendorCandidate[];
}

export const SCENARIOS: Record<ScenarioId, ScenarioProfile> = {
  datacenter: {
    id: "datacenter",
    label: "On-prem compute spares",
    industry: "Regulated datacenter",
    trigger: "Node failure drains the critical spares pool",
    item: {
      sku: "DDR5-ECC-64GB",
      displayName: "64 GB DDR5 ECC Memory Module",
      currentQty: 5,
      threshold: 2,
      critical: true,
      downtimeCostCentsPerMinute: 18_000,
    },
    vendors: DEMO_VENDORS,
  },
  apparel: {
    id: "apparel",
    label: "Sock line dye supply",
    industry: "Apparel manufacturing",
    trigger: "Supplier shipment delay drains the navy dye reserve",
    item: {
      sku: "NAVY-DYE-20L",
      displayName: "Navy textile dye (20L drum)",
      currentQty: 5,
      threshold: 2,
      critical: true,
      downtimeCostCentsPerMinute: 5_000,
    },
    vendors: [
      {
        id: "vendor-pacificdye",
        legalName: "Pacific Dye C0. Inc",
        tradingName: "Pacific Dyes",
        domain: "pacificdye-co.example",
        phone: "+1-555-010-0877",
        synthetic: true,
        quote: {
          id: "quote-pacificdye-1",
          sku: "NAVY-DYE-20L",
          payeeName: "Cascadia Trade Holdings Ltd",
          payeeAccountRef: "demo-payee-pacificdye",
          unitPriceCents: 900_00,
          currency: "USD",
          availableQty: 20,
          leadTimeDays: 1,
        },
      },
      {
        id: "vendor-meridian",
        legalName: "Meridian Colorants Ltd",
        tradingName: "Meridian Colorants",
        domain: "meridian-colorants.example",
        phone: "+1-555-010-0362",
        synthetic: true,
        quote: {
          id: "quote-meridian-1",
          sku: "NAVY-DYE-20L",
          payeeName: "Meridian Colorants Ltd",
          payeeAccountRef: "demo-payee-meridian",
          unitPriceCents: 965_00,
          currency: "USD",
          availableQty: 20,
          leadTimeDays: 2,
        },
      },
    ],
  },
};
