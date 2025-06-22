import { useState } from "react";
import { UseFormSetValue } from "react-hook-form";

import { Assignment, KindOfAssignment } from "@/types/assignment";

export const useAssignmentState = () => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleTypeSelect = (type: KindOfAssignment, setValue: UseFormSetValue<Assignment>) => {
    // Reset all type-specific settings first
    setValue("is_timed", false);
    setValue("is_peer", false);
    setValue("nopause", false);
    setValue("nofeedback", false);
    setValue("time_limit", null);
    setValue("peer_async_visible", false);

    // Set type-specific defaults
    if (type === "Timed") {
      setValue("is_timed", true);
      setValue("time_limit", 60); // Default 1 hour
      setValue("nopause", false); // Default to allowing pause
      setValue("nofeedback", false); // Default to allowing feedback
    } else if (type === "Peer") {
      setValue("is_peer", true);
      setValue("peer_async_visible", false);
    }

    setValue("kind", type);
  };

  return {
    globalFilter,
    setGlobalFilter,
    isCollapsed,
    setIsCollapsed,
    handleTypeSelect
  };
};
