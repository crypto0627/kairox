import "server-only";
import { db } from "./client";
import type { DeskReport } from "@/lib/agent/report";

export interface ReportRow extends DeskReport {
  id: string;
  createdAt: string;
  instruments: number;
  simulated: number;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface RecordReportInput extends DeskReport {
  instruments: number;
  simulated: number;
  provider: string;
  model: string;
  latencyMs: number;
}

export async function recordReport(input: RecordReportInput): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into desk_report
      (headline, summary, agreement, watch, caveat,
       instruments, simulated, provider, model, latency_ms)
    values
      (${input.headline}, ${input.summary}, ${input.agreement},
       ${db.array(input.watch)}, ${input.caveat},
       ${input.instruments}, ${input.simulated},
       ${input.provider}, ${input.model}, ${input.latencyMs})
    returning id::text
  `;
  return row.id;
}

export async function recentReports(limit = 10): Promise<ReportRow[]> {
  return db<ReportRow[]>`
    select
      id::text    as "id",
      created_at  as "createdAt",
      headline, summary, agreement, watch, caveat,
      instruments, simulated, provider, model,
      latency_ms  as "latencyMs"
    from desk_report
    order by created_at desc
    limit ${limit}
  `;
}
