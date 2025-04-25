import { Button } from "primereact/button";

interface ErrorDisplayProps {
  refetch: () => void;
}

export const ErrorDisplay = ({ refetch }: ErrorDisplayProps) => {
  return (
    <div className="surface-card p-4 border-round shadow-1">
      <div className="flex flex-column align-items-center gap-3">
        <i className="pi pi-exclamation-triangle text-6xl text-yellow-500" />
        <h2>Error Loading Exercises</h2>
        <p className="text-700">There was a problem loading the exercises.</p>
        <Button label="Try Again" icon="pi pi-refresh" onClick={refetch} />
      </div>
    </div>
  );
};
