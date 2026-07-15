import { getJson } from "@/shared/db/helpers";

const ENTITY_KEY: Record<
  "asset" | "liability" | "income" | "expense" | "goal" | "scenario",
  string
> = {
  asset: "asset",
  liability: "liability",
  income: "income",
  expense: "expense",
  goal: "goal",
  scenario: "scenario",
};

export async function assertOwned(
  model: "asset" | "liability" | "income" | "expense" | "goal" | "scenario",
  id: string,
  userId: string,
): Promise<boolean> {
  const row = await getJson<{ userId: string }>(`${ENTITY_KEY[model]}:${id}`);
  return row?.userId === userId;
}
