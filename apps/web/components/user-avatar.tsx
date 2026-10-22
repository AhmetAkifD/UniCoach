import type { AuthUser } from "@unicoach/shared";
import { cn } from "@/lib/cn";

function initials(user: Pick<AuthUser, "firstName" | "lastName">) {
  return [user.firstName, user.lastName]
    .map((part) => part.trim().charAt(0).toLocaleUpperCase("tr"))
    .join("");
}

/** Profil fotoğrafı; yüklenmemişse ad ve soyadın baş harfleri. Boyut ve yazı büyüklüğü `className` ile verilir. */
export function UserAvatar({
  user,
  className,
}: {
  user: Pick<AuthUser, "firstName" | "lastName" | "avatarUrl">;
  className?: string;
}) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- oturum çereziyle API'den gelen küçük kişisel resim
      <img src={user.avatarUrl} alt="" aria-hidden className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-soft-text",
        className,
      )}
    >
      {initials(user)}
    </span>
  );
}
