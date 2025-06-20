import { useAssignmentRouting } from "../hooks/useAssignmentRouting";

export const RoutingDebug = () => {
  const routing = useAssignmentRouting();

  //test feature to debug routing
  if (true) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        background: "#f0f0f0",
        padding: "10px",
        fontSize: "12px",
        borderRadius: "4px",
        zIndex: 9999,
        maxWidth: "300px",
        fontFamily: "monospace"
      }}
    >
      <strong>Routing Debug:</strong>
      <div>Mode: {routing.mode}</div>
      <div>Assignment ID: {routing.selectedAssignmentId || "none"}</div>
      <div>Wizard Step: {routing.wizardStep}</div>
      <div>Active Tab: {routing.activeTab}</div>
      <div>Exercise View: {routing.exerciseViewMode}</div>
      <div>Exercise Type: {routing.exerciseType || "none"}</div>
      <div>Exercise SubType: {routing.exerciseSubType || "none"}</div>
      <div>Exercise Step: {routing.exerciseStep}</div>
      <div>Exercise ID: {routing.exerciseId || "none"}</div>
      <div>URL: {window.location.pathname}</div>
      <div>VITE_BASE_URL: {import.meta.env.VITE_BASE_URL}</div>
      <div>Mode: {import.meta.env.MODE}</div>
    </div>
  );
};
