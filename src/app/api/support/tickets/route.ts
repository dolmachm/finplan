import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/shared/api-validation";
import { requireViewerUserId, isErrorResponse } from "@/shared/session";
import {
  createTicket,
  listTicketsForUser,
} from "@/modules/support/support.service";

const createSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(5).max(4000),
  page: z.string().trim().min(1).max(200),
  dashboardTab: z.string().trim().max(40).nullable().optional(),
  subTab: z.string().trim().max(40).nullable().optional(),
  locationArea: z.enum(["nav", "form", "chart", "export", "other"]),
  locationHint: z.string().trim().max(200).nullable().optional(),
});

export async function GET() {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  const tickets = await listTicketsForUser(userId);
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const userId = await requireViewerUserId();
  if (isErrorResponse(userId)) return userId;
  const parsed = parseJsonBody(createSchema, await req.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  const result = await createTicket({
    userId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    page: parsed.data.page,
    dashboardTab: parsed.data.dashboardTab ?? null,
    subTab: parsed.data.subTab ?? null,
    locationArea: parsed.data.locationArea,
    locationHint: parsed.data.locationHint ?? null,
  });

  return NextResponse.json(result, { status: 201 });
}
