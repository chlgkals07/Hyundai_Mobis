/**
 * 아주 작은 Markdown → HTML (제작 설명서 전용): 제목, 문단, 목록(중첩 1단·체크박스), 표, 굵게, `코드`, 이미지.
 * 이미지 `![..](diagrams/B5E/<id>.svg)` 는 figs[id] 의 인라인 SVG 로 바꿈 (Artifact 에선 외부 파일 대신).
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

export function mdToHtml(md: string, figs: Record<string, { title: string; svg: string }>): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  const listBlock = (ordered: boolean) => {
    const items: string[] = [];
    const re = ordered ? /^(\d+)\. (.*)$/ : /^- (.*)$/;
    while (i < lines.length && re.test(lines[i])) {
      const m = lines[i].match(re)!;
      let text = ordered ? m[2] : m[1];
      i++;
      const sub: string[] = [];
      while (i < lines.length && /^ {2,4}- /.test(lines[i])) sub.push(lines[i++].replace(/^ {2,4}- /, ""));
      const box = /^\[( |x)\] /.exec(text);
      if (box) text = text.slice(4);
      items.push(`<li${box ? ' class="chk"' : ""}>${box ? `<span class="box">${box[1] === "x" ? "☑" : "☐"}</span> ` : ""}${inline(text)}${sub.length ? `<ul>${sub.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>` : ""}</li>`);
    }
    out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
  };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(l);
    if (h) {
      const lv = h[1].length + 1;
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(l);
    if (img) {
      const id = img[2].split("/").pop()!.replace(/\.svg$/, "");
      const f = figs[id];
      out.push(f ? `<figure class="fig"><figcaption>${esc(f.title)}</figcaption>${f.svg}</figure>` : `<p class="note">[그림: ${esc(img[1])}]</p>`);
      i++;
      continue;
    }
    if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(`<div class="tw"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(l)) {
      listBlock(false);
      continue;
    }
    if (/^\d+\. /.test(l)) {
      listBlock(true);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\. |!\[)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}
