/** Wire contracts shared by the API and field client. All instants are ISO 8601. */
export type Role = "admin" | "stage" | "technician" | "gate" | "attendee";
export type TaskStatus = "todo" | "doing" | "done";
export interface Actor {
  id: string;
  orgId: string;
  name: string;
  role: Role;
  team: string;
  email?: string;
}
export interface QueuedMutation {
  id: string;
  userId: string;
  action: string;
  input: Record<string, unknown>;
  createdAt: string;
  error?: string;
}
export function festivalDate(value: string) {
  return new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 10);
}
export function festivalInput(value: string) {
  return new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16);
}
