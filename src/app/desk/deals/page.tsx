"use client";

import { FileSignature, Handshake, Wallet } from "lucide-react";

import { CompanyAvatar, EmptyState, PageHeader, Stat } from "@/components/desk/bits";
import { useDesk } from "@/components/desk/desk-provider";
import { type Any, brandName, inr, lakh } from "@/components/desk/format";

export default function DealsPage() {
  const { data, openCompany } = useDesk();
  const co = (id: string) => data.companies.find((c: Any) => c.id === id) || { name: id };
  const total = data.deals.reduce((s: number, d: Any) => s + Number(d.cash_inr || 0), 0);
  const goal = Number(data.event?.goal_inr || 0);
  return (
    <>
      <PageHeader eyebrow="Agent A6 · Close" title="Deals and MOUs" description="Every MOU drafted from a deal sheet. Open a company to redraft or send it for signature." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Handshake} label="MOUs drafted" value={data.deals.length} />
        <Stat icon={Wallet} tone="gold" label="cash in drafted MOUs" value={lakh(total)} />
        <Stat icon={FileSignature} tone="success" label="of your goal" value={goal ? `${Math.round((total / goal) * 100)}%` : "–"} sub={goal ? `goal ${lakh(goal)}` : undefined} />
      </div>
      {!data.deals.length ? <EmptyState icon={FileSignature} title="No MOUs yet">Draft one from a company's Next steps tab once terms are agreed.</EmptyState> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{["Sponsor", "Tier", "Cash", "In-kind", "Status", "MOU"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {data.deals.map((d: Any) => (
                <tr key={d.company_id} onClick={() => openCompany(d.company_id)} className="cursor-pointer border-t hover:bg-muted/40">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><CompanyAvatar name={brandName(co(d.company_id))} size={28} /><b>{brandName(co(d.company_id))}</b></div></td>
                  <td className="px-4 py-2.5">{d.tier}</td>
                  <td className="px-4 py-2.5 font-semibold num text-gold-foreground dark:text-gold">{inr(d.cash_inr)}</td>
                  <td className="max-w-60 px-4 py-2.5 text-xs">{d.in_kind || "–"}</td>
                  <td className="px-4 py-2.5"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{d.status}</span></td>
                  <td className="px-4 py-2.5">{d.share_id && <a className="font-semibold text-primary hover:underline" href={`/m/${d.share_id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
