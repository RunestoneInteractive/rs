import { Option } from "@/types/exercises";

export type PollType = "scale" | "options";

export interface PollOption extends Option {
  id: string;
}
