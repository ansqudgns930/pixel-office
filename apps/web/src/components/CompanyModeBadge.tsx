import type { CompanyMode } from "../types.ts";

export default function CompanyModeBadge({ mode }: { mode: CompanyMode }) {
  const isDemo = mode === "demo";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "3px 9px",
        borderRadius: 999,
        marginLeft: 8,
        color: isDemo ? "#2b1a4a" : "#04101f",
        background: isDemo ? "#c4a6f7" : "#3fb950"
      }}
    >
      {isDemo ? "DEMO COMPANY" : "LIVE COMPANY"}
    </span>
  );
}
