// Turns a checkout into the static GitHub Pages demo. Run only in CI or a throwaway copy: it rewrites files in place.
// The real app in src/ needs no changes and is unaffected on main.
//   BASE_PATH=/repo-name node demo/prepare.mjs && npm run build   -> static site in out/
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

const base = process.env.BASE_PATH || "";
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, "utf8")));

// No server on Pages: drop the routes, keep the screens.
rmSync("src/app/api", { recursive: true, force: true });
rmSync("scripts", { recursive: true, force: true }); // server tests import the routes above

mkdirSync("src/lib/demo", { recursive: true });
for (const f of ["data.ts", "engine.ts", "boot.tsx"]) copyFileSync(`demo/${f}`, `src/lib/demo/${f}`);

writeFileSync("next.config.mjs", `/** @type {import('next').NextConfig} */
export default {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: ${JSON.stringify(base)},
  env: { NEXT_PUBLIC_BASE_PATH: ${JSON.stringify(base)} },
  reactCompiler: true,
  agentRules: false,
};
`);

edit("src/app/layout.tsx", (s) => s
  .replace('import "./globals.css";', 'import { DemoBoot } from "@/lib/demo/boot";\n\nimport "./globals.css";')
  .replace("<Toaster />", "<Toaster />\n            <DemoBoot />"));

// Reading cookies needs a server, so the sidebar simply starts open.
writeFileSync("src/app/desk/layout.tsx", `import type { ReactNode } from "react";

import { DeskShell } from "@/components/desk/desk-shell";

export default function DeskLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DeskShell defaultOpen>{children}</DeskShell>;
}
`);

// Server actions are not allowed in a static export. Nothing uses server-cookie persistence here.
writeFileSync("src/server/server-actions.ts", `export async function setValueToCookie(_key: string, _value: string): Promise<void> {}\n`);

edit("src/components/desk/app-sidebar.tsx", (s) => s.replace('window.location.href = "/login"', `window.location.href = "${base}/login/"`));

writeFileSync("src/app/page.tsx", `"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/desk"); }, [router]);
  return null;
}
`);

// Dynamic pages must list their ids at build time.
for (const [dir, ids] of [["d", "DECK_IDS"], ["m", "MOU_IDS"]]) {
  const page = `src/app/${dir}/[id]/page.tsx`;
  if (!existsSync(page)) throw new Error(`missing ${page}`);
  renameSync(page, `src/app/${dir}/[id]/view.tsx`);
  writeFileSync(page, `import { Suspense } from "react";

import { ${ids} } from "@/lib/demo/data";

import View from "./view";

export const generateStaticParams = () => ${ids}.map((id) => ({ id }));

export default function Page() {
  return <Suspense><View /></Suspense>;
}
`);
}
console.log("Demo prepared with base path", JSON.stringify(base));
