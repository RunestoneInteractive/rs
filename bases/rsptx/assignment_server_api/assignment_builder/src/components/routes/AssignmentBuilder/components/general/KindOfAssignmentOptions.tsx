import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { JSX } from "react";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { KindOfAssignment } from "@/types/assignment";

export const KindOfAssignmentOptions = () => {
  const { selectedAssignment, updateAssignment } = useSelectedAssignment();

  if (!selectedAssignment) {
    return null;
  }

  const config: Record<KindOfAssignment, () => JSX.Element> = {
    Regular: () => {
      return (
        <div className="field col-12">
          <label>No additional options</label>
        </div>
      );
    },
    Peer: () => {
      return (
        <div className="field col-3 md:col-3  flex">
          <div className="flex align-items-center flex-shrink-1 gap-1">
            <label className="label mb-0" htmlFor="showAsyncPeer">
              Show Async Peer
            </label>
            <InputSwitch
              className="flex-shrink-0"
              id="showAsyncPeer"
              checked={selectedAssignment.peer_async_visible}
              onChange={(e) => updateAssignment({ peer_async_visible: e.value })}
            />
          </div>
        </div>
      );
    },
    Timed: () => {
      return (
        <>
          <div className="field col-12 md:col-8  flex">
            <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-clock"></i>
              </span>
              <InputNumber
                placeholder="Time Limit (minutes)"
                value={selectedAssignment.time_limit}
                min={0}
                onChange={(e) => updateAssignment({ time_limit: e.value })}
              />
              <span className="p-inputgroup-addon">minutes</span>
            </div>
          </div>
          <div className="field col-6 md:col-2  flex">
            <div className="flex align-items-center flex-shrink-1 gap-1">
              <label className="label mb-0" htmlFor="allowFeedback">
                Allow Feedback
              </label>
              <InputSwitch
                className="flex-shrink-0"
                id="allowFeedback"
                checked={!selectedAssignment.nofeedback}
                onChange={(e) => updateAssignment({ nofeedback: !e.value })}
              />
            </div>
          </div>
          <div className="field col-6 md:col-2  flex">
            <div className="flex align-items-center flex-shrink-1 gap-1">
              <label className="label mb-0" htmlFor="allowPause">
                Allow Pause
              </label>
              <InputSwitch
                className="flex-shrink-0"
                id="allowPause"
                checked={!selectedAssignment.nopause}
                onChange={(e) => updateAssignment({ nopause: !e.value })}
              />
            </div>
          </div>
        </>
      );
    }
  };

  return (config[selectedAssignment.kind] ?? config.Regular)();
};
