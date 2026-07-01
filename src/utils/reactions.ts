import { BeerCheckIn, ReactionUser } from "@/types";

export function reactionUsersForCheckIn(item: BeerCheckIn, currentUserId: string): ReactionUser[] {
  const usersById = new Map<string, ReactionUser>();
  (item.reactionUsers ?? []).forEach((reactionUser) => {
    usersById.set(reactionUser.id, reactionUser);
  });
  item.reactedBy.forEach((id) => {
    if (!usersById.has(id)) {
      usersById.set(id, {
        id,
        name: id === currentUserId ? "You" : "Pintly user",
        avatar: id === currentUserId ? "YO" : "PU"
      });
    }
  });
  return Array.from(usersById.values());
}
