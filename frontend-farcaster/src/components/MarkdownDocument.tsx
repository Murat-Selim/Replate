import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";

function renderInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-black text-white">{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  );
}

export default function MarkdownDocument({ fileName }: { fileName: string }) {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "content", fileName), "utf8");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index].trim();
    if (!raw) {
      index++;
      continue;
    }
    if (raw === "---") {
      blocks.push(<hr key={index} className="border-brand-primary/15" />);
      index++;
      continue;
    }
    if (raw.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index++;
      }
      blocks.push(
        <ul key={index} className="list-disc space-y-2 pl-6 leading-8 text-brand-text/70">
          {items.map((item) => <li key={item}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }
    if (raw.startsWith("# ")) {
      blocks.push(<h1 key={index} className="text-3xl font-black text-white sm:text-4xl">{renderInline(raw.slice(2))}</h1>);
      index++;
      continue;
    }
    if (raw.startsWith("## ") || /^\d+\.\s/.test(raw)) {
      const title = raw.startsWith("## ") ? raw.slice(3) : raw;
      blocks.push(<h2 key={index} className="pt-3 text-xl font-black text-brand-primary">{renderInline(title)}</h2>);
      index++;
      continue;
    }
    if (raw.startsWith("### ")) {
      blocks.push(<h3 key={index} className="pt-2 text-lg font-black text-white">{renderInline(raw.slice(4))}</h3>);
      index++;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line || line === "---" || line.startsWith("- ") || line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### ") || /^\d+\.\s/.test(line)) break;
      paragraph.push(line);
      index++;
    }
    blocks.push(<p key={index} className="leading-8 text-brand-text/70">{renderInline(paragraph.join(" "))}</p>);
  }

  return <div className="space-y-5">{blocks}</div>;
}

