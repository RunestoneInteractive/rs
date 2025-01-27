import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { JSX } from "react";
import { Controller } from "react-hook-form";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { AssignmentFormProps, KindOfAssignment } from "@/types/assignment";

export const KindOfAssignmentOptions = ({ control, setValue, getValues }: AssignmentFormProps) => {
  const { selectedAssignment } = useSelectedAssignment();

  if (!selectedAssignment) {
    return null;
  }

  const config: Record<KindOfAssignment, () => JSX.Element> = {
    Regular: () => {
      return (
        <div className="field col-12">
          <span className="label mb-0">No additional options</span>
        </div>
      );
    },
    Peer: () => {
      return (
        <div className="field col-3 md:col-3 flex">
          <div className="flex align-items-center flex-shrink-1 gap-1">
            <span className="label mb-0">Show Async Peer</span>
            <Controller
              name="peer_async_visible"
              control={control}
              render={({ field }) => (
                <InputSwitch
                  className="flex-shrink-0"
                  name="peer_async_visible"
                  checked={field.value}
                  onChange={(e) => setValue("peer_async_visible", e.value)}
                />
              )}
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
              <Controller
                name="time_limit"
                control={control}
                render={({ field }) => (
                  <InputNumber
                    {...field}
                    id="time_limit"
                    placeholder="Time Limit (minutes)"
                    value={field.value}
                    min={0}
                    onChange={(e) => setValue("time_limit", e.value)}
                  />
                )}
              />
              <span className="p-inputgroup-addon">minutes</span>
            </div>
          </div>
          <div className="field col-6 md:col-2  flex">
            <div className="flex align-items-center flex-shrink-1 gap-1">
              <span className="label mb-0">Allow Feedback</span>
              <Controller
                name="nofeedback"
                control={control}
                render={({ field }) => (
                  <InputSwitch
                    className="flex-shrink-0"
                    name="nofeedback"
                    checked={!field.value}
                    onChange={(e) => setValue("nofeedback", !e.value)}
                  />
                )}
              />
            </div>
          </div>
          <div className="field col-6 md:col-2  flex">
            <div className="flex align-items-center flex-shrink-1 gap-1">
              <span className="label mb-0">Allow Pause</span>
              <Controller
                name="nopause"
                control={control}
                render={({ field }) => (
                  <InputSwitch
                    className="flex-shrink-0"
                    name="nopause"
                    checked={!field.value}
                    onChange={(e) => setValue("nopause", !e.value)}
                  />
                )}
              />
            </div>
          </div>
        </>
      );
    }
  };

  return (config[getValues().kind] ?? config.Regular)();
};
