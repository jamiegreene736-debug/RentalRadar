import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "RentalRadar.ai AI agents with headed Chrome and booking data";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #050816 0%, #0a1638 48%, #001f33 100%)",
          color: "white",
          padding: 72,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #22d3ee, #2dd4bf)",
              boxShadow: "0 0 48px rgba(34, 211, 238, 0.65)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>RentalRadar.ai</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, lineHeight: 0.96, fontWeight: 800, maxWidth: 920 }}>
            Next-Generation Vacation Rental Pricing
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#a7f3ff", maxWidth: 940 }}>
            Playwright AI agents, real headed Chrome, live market evidence, and actual booking data.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#d7fbff" }}>
          <span>Headed Chrome agents</span>
          <span>•</span>
          <span>Real booking data</span>
          <span>•</span>
          <span>$3-$9/property</span>
        </div>
      </div>
    ),
    size,
  );
}
