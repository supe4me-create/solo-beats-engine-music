import type { ReactNode } from "react";
import OwnerOnlyV2Nav from "./OwnerOnlyV2Nav";

export default function ControlRoomV2Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050505] lg:flex lg:items-start">
      <OwnerOnlyV2Nav />
      <div
        className="min-w-0 flex-1 lg:min-h-screen"
        data-workspace="SOLO_CONTROL_ROOM_WORKSPACE_V3"
      >
        {children}
      </div>
    </div>
  );
}