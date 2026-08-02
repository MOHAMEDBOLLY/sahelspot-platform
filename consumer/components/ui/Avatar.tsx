import Image from "next/image";
import { Icon } from "./Icon";

type AvatarProps = {
  /** Omitted in v1 — there are no user accounts, so there is no photo to show. */
  src?: string;
  alt?: string;
  /** Explore's avatar carries a hairline ring; Home's does not. */
  bordered?: boolean;
  className?: string;
};

/** The 40px circular avatar in the top app bar.
 *
 * v1 has no user accounts, so this always renders its placeholder. The element
 * is kept at full size and styling rather than removed: an unimplemented
 * feature loses its interaction, not its visual presence, or the header stops
 * matching the export and can no longer be diffed against it. */
export function Avatar({ src, alt, bordered = false, className = "" }: AvatarProps) {
  const classes = [
    "relative h-10 w-10 shrink-0 overflow-hidden rounded-full",
    bordered ? "border-2 border-primary/10 bg-surface-container" : "bg-primary-container",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {src ? (
        <Image alt={alt ?? ""} className="object-cover" fill sizes="40px" src={src} />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Icon className="text-primary/60" name="person" size={22} />
        </span>
      )}
    </div>
  );
}
