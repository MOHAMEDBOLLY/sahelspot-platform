import { IconButton } from "@/components/ui/IconButton";

type MapControlsProps = {
  onLocate: () => void;
  onToggleLayers: () => void;
};

/** The two floating FABs on the Map's right edge — locate and layers, per
 * `interactive_map_1/code.html`. */
export function MapControls({ onLocate, onToggleLayers }: MapControlsProps) {
  return (
    <div className="absolute top-1/2 right-4 z-20 flex -translate-y-1/2 flex-col gap-2">
      <IconButton icon="my_location" label="Show my location" onClick={onLocate} variant="glass" />
      <IconButton icon="layers" label="Change map style" onClick={onToggleLayers} variant="glass" />
    </div>
  );
}
