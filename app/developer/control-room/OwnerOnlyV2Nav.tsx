"use client";

import { useAuth } from "../../auth/AuthContext";
import ControlRoomV2Nav from "./ControlRoomV2Nav";

const OWNER_EMAIL = "supe4.me@gmail.com";

export default function OwnerOnlyV2Nav() {
  const { user, loading } = useAuth();

  const isOwner =
    !loading &&
    !!user &&
    user.email?.toLowerCase() === OWNER_EMAIL;

  if (!isOwner) {
    return null;
  }

  return <ControlRoomV2Nav />;
}