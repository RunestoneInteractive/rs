import React from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "../Grader.module.css";

interface ReleaseStatusBadgeProps {
  released: boolean;
}

export const ReleaseStatusBadge: React.FC<ReleaseStatusBadgeProps> = ({ released }) => (
  <span
    className={`${styles.chip} ${released ? styles.chipCorrect : styles.chipUnknown}`}
    title={released ? "Students can see their scores" : "Scores are hidden from students"}
  >
    <Icon name={released ? "eye" : "eye-slash"} size={12} />
    {released ? "Released" : "Hidden"}
  </span>
);

export default ReleaseStatusBadge;
