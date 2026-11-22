export interface CompareRow {
  id: string;
  name: string;
  scores: Record<string, number>;
  total: number;
  cells: Record<string, string>;
  verdict: string;
}
export interface ViewerData {
  generated: string;
  criteria: { key: string; label: string; weight: number; how: string }[];
  rows: CompareRow[];
  recommendation: string[];
  patterns: { id: string; name: string; sheets: string[]; bom: string[]; steps: string[] }[];
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function renderCompare(el: HTMLElement, data: unknown) {
  const d = data as ViewerData;
  if (!d.rows?.length) {
    el.innerHTML = `<div class="box"><p>비교표가 아직 생성되지 않았습니다. <code>npm run score</code> 후 다시 빌드하세요.</p></div>`;
    return;
  }
  const cellKeys = Object.keys(d.rows[0].cells);
  el.innerHTML = `
  <div class="box prose">
    <h2>추천</h2>
    ${d.recommendation.map((p) => `<p>${p}</p>`).join("")}
  </div>
  <div class="box">
    <h2>점수 (자동 계산, 각 항목 0–5 × 가중치)</h2>
    <div class="scroll"><table class="cmp">
      <thead><tr><th>설계안</th>${d.criteria.map((c) => `<th title="${esc(c.how)}">${c.label} ×${c.weight}</th>`).join("")}<th>합계</th></tr></thead>
      <tbody>${d.rows
        .map(
          (r) =>
            `<tr><td><b>${r.id}</b><br><span class="note">${esc(r.name.split(" — ")[1] ?? r.name)}</span></td>${d.criteria
              .map((c) => `<td class="n">${r.scores[c.key].toFixed(1)}</td>`)
              .join("")}<td class="score">${r.total.toFixed(1)}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <p class="note">${d.criteria.map((c) => `<b>${c.label}</b>: ${esc(c.how)}`).join(" · ")}</p>
  </div>
  <div class="box">
    <h2>세부 지표</h2>
    <div class="scroll"><table class="cmp">
      <thead><tr><th>설계안</th>${cellKeys.map((k) => `<th>${k}</th>`).join("")}<th>판정</th></tr></thead>
      <tbody>${d.rows
        .map((r) => `<tr><td><b>${r.id}</b></td>${cellKeys.map((k) => `<td>${esc(r.cells[k])}</td>`).join("")}<td>${esc(r.verdict)}</td></tr>`)
        .join("")}</tbody>
    </table></div>
    <p class="note">생성: ${d.generated}</p>
  </div>`;
}

export function renderPatterns(el: HTMLElement, data: unknown) {
  const d = data as ViewerData;
  if (!d.patterns?.length) {
    el.innerHTML = `<div class="box"><p>전개도가 아직 생성되지 않았습니다.</p></div>`;
    return;
  }
  el.innerHTML = `
  <div class="box prose">
    <h2>전개도 읽는 법</h2>
    <p>실선 = 칼로 자르기, 파란 점선 = 접는 선(자 대고 볼펜으로 눌러 score), 빗금 = 풀칠, 원 = 빨대·실 구멍, 화살표 = 골 방향. 모든 도면은 1:1 mm 이고 각 장에 100 mm 눈금자가 있습니다. 인쇄용 PDF(A4, 100%)는 레포 <code>patterns/</code> 폴더에 있습니다.</p>
  </div>
  <div class="patterns">${d.patterns
    .map(
      (p) => `<div class="box">
      <h2>${esc(p.name)}</h2>
      <div class="prose"><p><b>재료</b></p><ul>${p.bom.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <p><b>조립 순서</b></p><ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
      ${p.sheets.map((s) => `<div class="sheet">${s}</div>`).join("")}
    </div>`,
    )
    .join("")}</div>`;
}
