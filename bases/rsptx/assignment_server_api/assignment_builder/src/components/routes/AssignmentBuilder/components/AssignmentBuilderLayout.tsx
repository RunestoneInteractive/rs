import {
  useGetAutoGradeOptionsQuery,
  useGetLanguageOptionsQuery,
  useGetQuestionTypeOptionsQuery,
  useGetWhichToGradeOptionsQuery
} from "@store/dataset/dataset.logic.api";
import { useGetAvailableReadingsQuery } from "@store/readings/readings.logic.api";
import { ReactNode } from "react";

interface AssignmentBuilderLayoutProps {
  children: ReactNode;
}

export const AssignmentBuilderLayout = ({ children }: AssignmentBuilderLayoutProps) => {
  useGetAutoGradeOptionsQuery();
  useGetWhichToGradeOptionsQuery();
  useGetLanguageOptionsQuery();
  useGetQuestionTypeOptionsQuery();
  useGetAvailableReadingsQuery({
    skipreading: false,
    from_source_only: false,
    pages_only: false
  });

  return <div className="root">{children}</div>;
};
