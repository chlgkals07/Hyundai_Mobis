// 팔 + 그리퍼 결합 점검 (헤드리스): 대표 자세에서 soft 열림 제한각별 팔-그리퍼 간섭, 도달 가능 여부
// 결과: docs/arm-check.md  (params/arm/R4.json 을 실측값으로 바꾼 뒤 다시 실행)
import { writeFileSync } from "node:fs";
import { Matrix4 } from "three";
import { ALL } from "../src/core/designs";
import { findCollisions } from "../src/core/collide";
import { ARM, armFK, armIK, combinedDesign, transformAssembly } from "../src/core/arm";
import B5Nc from "../calc/out/B5N.json";

const grip = ALL.find((d) => d.id === ARM.gripper.design)!;
const dv = B5Nc.derived as unknown as Record<string, number>;
const phiMin = dv.soft_phi_min_deg;
const aForOpen = (lim: number) => Math.max(0, (90 - lim) / (90 - phiMin)); // soft 실 A 당김으로 열림 제한 흉내
const H = dv.rigid_palm_height;

export function poseCheck(r: number, roll: number, lim: number, hardB = 0, obj: "battery" | null = null) {
  const wristZ = H + 6 + ARM.mount.h + ARM.wrist.h;
  const ik = armIK(ARM, r, wristZ);
  if (!ik) return { reach: false, cols: [] as string[] };
  const arm = armFK(ARM, { base: 0, shoulder: ik.shoulder, elbow: ik.elbow, wristPitch: "level", roll });
  const ctrl = { ...grip.preset("open", null), a: aForOpen(lim), b: hardB, palmH: H, obj };
  const gAsm = grip.build(ctrl);
  const world = transformAssembly(gAsm, arm.Mgrip as Matrix4);
  const asm = { ...world, parts: [...world.parts, ...arm.parts], lines: [] };
  const cols = findCollisions(asm, combinedDesign(grip)).filter((c) => c.includes("arm_"));
  return { reach: true, cols, ik };
}

if (process.argv[1]?.endsWith("arm-check.ts")) {
  const LIMS = [90, 75, 60, 45, 30, 20];
  const RS = [130, 170, 210, 250];
  const lines: string[] = [
    "# 팔 + 그리퍼 결합 점검 (자동 생성)",
    "",
    `팔 치수: \`params/arm/R4.json\` (${ARM._status === "placeholder" ? "**가정값 — R4 실측으로 교체 후 재실행**" : "실측"}) · 그리퍼 ${grip.id} · 손바닥 높이 ${H.toFixed(1)} mm (Rigid 건전지 자세)`,
    "",
    "## soft 열림 제한각별 팔 간섭 (hard 는 완전 개방)",
    "",
    "| 수평거리 r (mm) | roll | " + LIMS.map((l) => `${l}°`).join(" | ") + " |",
    "|---|---|" + LIMS.map(() => "---|").join(""),
  ];
  for (const r of RS) {
    for (const roll of [0, 90]) {
      const cells = LIMS.map((l) => {
        const c = poseCheck(r, (roll * Math.PI) / 180, l);
        if (!c.reach) return "도달 X";
        return c.cols.length ? `✗ ${c.cols.length}` : "✓";
      });
      lines.push(`| ${r} | ${roll}° | ${cells.join(" | ")} |`);
    }
  }
  const ex = poseCheck(170, 0, 90);
  lines.push("", "### 예: r=170, roll 0°, soft 90° 에서 간섭", "", ...(ex.cols.length ? ex.cols.map((c) => `- ${c}`) : ["- 없음"]), "");
  lines.push("✓ = 팔(손목·장착 기둥·전완)과 그리퍼 부품 간섭 없음, ✗ n = 간섭 건수, 도달 X = 그 거리·높이에 손목이 닿지 않음 (팔 길이 부족).", "");
  writeFileSync("docs/arm-check.md", lines.join("\n"));
  console.log(lines.join("\n"));
}
