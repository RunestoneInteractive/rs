import { ErrorState } from "@components/routes/AssignmentBuilder/components/ErrorState/ErrorState";

interface ErrorDisplayProps {
  refetch: () => void;
}

export const ErrorDisplay = ({ refetch }: ErrorDisplayProps) => {
  return (
    <ErrorState
      title="Error loading exercises"
      message="There was a problem loading the exercises."
      retryLabel="Try again"
      onRetry={refetch}
    />
  );
};
