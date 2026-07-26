import { redis } from "@/shared/redis";
import {
  getJson,
  newId,
  now,
  reviveDates,
  setJson,
} from "@/shared/db/helpers";
import { buildSystemAutoReply } from "@/content/support";
import { recordAdminAction } from "@/modules/admin/admin-log";
import type {
  SupportLocationArea,
  SupportMessage,
  SupportMessageAuthor,
  SupportTicket,
  SupportTicketStatus,
} from "@/shared/types";

const TICKET_ENTITY = "supportTicket";
const MESSAGE_ENTITY = "supportMessage";
const MAX_USER_TICKETS = 100;
const MAX_STATUS_TICKETS = 300;
const MAX_MESSAGES = 200;

function ticketKey(id: string) {
  return `${TICKET_ENTITY}:${id}`;
}

function messageKey(id: string) {
  return `${MESSAGE_ENTITY}:${id}`;
}

function userChronKey(userId: string) {
  return `idx:${TICKET_ENTITY}:user:${userId}:chron`;
}

function statusChronKey(status: SupportTicketStatus) {
  return `idx:${TICKET_ENTITY}:status:${status}:chron`;
}

function messagesChronKey(ticketId: string) {
  return `idx:${MESSAGE_ENTITY}:ticket:${ticketId}:chron`;
}

async function loadMessages(ticketId: string): Promise<SupportMessage[]> {
  const ids = (await redis.lrange(messagesChronKey(ticketId), 0, MAX_MESSAGES - 1)) ?? [];
  if (ids.length === 0) return [];
  const rows = await redis.mget<SupportMessage[]>(
    ...[...ids].reverse().map((id) => messageKey(id)),
  );
  return (rows ?? []).filter(Boolean).map((r) => reviveDates(r!));
}

async function addMessage(
  ticketId: string,
  author: SupportMessageAuthor,
  body: string,
): Promise<SupportMessage> {
  const msg: SupportMessage = {
    id: newId(),
    ticketId,
    author,
    body: body.trim(),
    createdAt: now(),
  };
  await setJson(messageKey(msg.id), msg);
  await redis.lpush(messagesChronKey(ticketId), msg.id);
  await redis.ltrim(messagesChronKey(ticketId), 0, MAX_MESSAGES - 1);
  return msg;
}

async function setStatus(
  ticket: SupportTicket,
  status: SupportTicketStatus,
): Promise<SupportTicket> {
  if (ticket.status === status) {
    const updated = { ...ticket, updatedAt: now() };
    await setJson(ticketKey(ticket.id), updated);
    return updated;
  }
  await redis.lrem(statusChronKey(ticket.status), 0, ticket.id);
  const updated: SupportTicket = { ...ticket, status, updatedAt: now() };
  await setJson(ticketKey(ticket.id), updated);
  await redis.lpush(statusChronKey(status), ticket.id);
  await redis.ltrim(statusChronKey(status), 0, MAX_STATUS_TICKETS - 1);
  return updated;
}

export type CreateTicketInput = {
  userId: string;
  subject: string;
  body: string;
  page: string;
  dashboardTab?: string | null;
  subTab?: string | null;
  locationArea: SupportLocationArea;
  locationHint?: string | null;
};

export async function createTicket(input: CreateTicketInput) {
  const ts = now();
  const ticket: SupportTicket = {
    id: newId(),
    userId: input.userId,
    subject: input.subject.trim(),
    status: "OPEN",
    page: input.page.trim() || "/dashboard",
    dashboardTab: input.dashboardTab?.trim() || null,
    subTab: input.subTab?.trim() || null,
    locationArea: input.locationArea,
    locationHint: input.locationHint?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
  };

  await setJson(ticketKey(ticket.id), ticket);
  await redis.lpush(userChronKey(ticket.userId), ticket.id);
  await redis.ltrim(userChronKey(ticket.userId), 0, MAX_USER_TICKETS - 1);
  await redis.lpush(statusChronKey("OPEN"), ticket.id);
  await redis.ltrim(statusChronKey("OPEN"), 0, MAX_STATUS_TICKETS - 1);

  const userMsg = await addMessage(ticket.id, "USER", input.body);
  const systemMsg = await addMessage(
    ticket.id,
    "SYSTEM",
    buildSystemAutoReply(ticket.dashboardTab),
  );

  return { ticket, messages: [userMsg, systemMsg] };
}

export async function listTicketsForUser(userId: string) {
  const ids = (await redis.lrange(userChronKey(userId), 0, MAX_USER_TICKETS - 1)) ?? [];
  if (ids.length === 0) return [];
  const rows = await redis.mget<SupportTicket[]>(
    ...ids.map((id) => ticketKey(id)),
  );
  return (rows ?? []).filter(Boolean).map((r) => reviveDates(r!));
}

export async function listTicketsByStatus(
  status?: SupportTicketStatus | "ALL",
  limit = 80,
) {
  const statuses: SupportTicketStatus[] =
    !status || status === "ALL"
      ? ["OPEN", "WAITING_USER", "CLOSED"]
      : [status];

  const collected: SupportTicket[] = [];
  for (const s of statuses) {
    const ids = (await redis.lrange(statusChronKey(s), 0, limit - 1)) ?? [];
    if (ids.length === 0) continue;
    const rows = await redis.mget<SupportTicket[]>(
      ...ids.map((id) => ticketKey(id)),
    );
    for (const r of rows ?? []) {
      if (r) collected.push(reviveDates(r));
    }
  }

  collected.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return collected.slice(0, limit);
}

export async function getTicket(id: string): Promise<SupportTicket | null> {
  return getJson<SupportTicket>(ticketKey(id));
}

export async function getTicketWithMessages(id: string) {
  const ticket = await getTicket(id);
  if (!ticket) return null;
  const messages = await loadMessages(id);
  return { ticket, messages };
}

export async function addUserMessage(ticketId: string, userId: string, body: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.userId !== userId) return null;
  if (ticket.status === "CLOSED") {
    return { error: "closed" as const };
  }
  const message = await addMessage(ticketId, "USER", body);
  const updated = await setStatus(ticket, "OPEN");
  return { ticket: updated, message };
}

export async function addAdminMessage(ticketId: string, body: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket) return null;
  if (ticket.status === "CLOSED") {
    return { error: "closed" as const };
  }
  const message = await addMessage(ticketId, "ADMIN", body);
  const updated = await setStatus(ticket, "WAITING_USER");
  void recordAdminAction({
    targetUserId: ticket.userId,
    action: "SUPPORT_REPLY",
    label: `Ответ в тикете: ${ticket.subject}`,
    detail: { ticketId, messageId: message.id },
  });
  return { ticket: updated, message };
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
) {
  const ticket = await getTicket(ticketId);
  if (!ticket) return null;
  const updated = await setStatus(ticket, status);
  void recordAdminAction({
    targetUserId: ticket.userId,
    action: "SUPPORT_STATUS",
    label: `Тикет ${status}: ${ticket.subject}`,
    detail: { ticketId, status },
  });
  return updated;
}
