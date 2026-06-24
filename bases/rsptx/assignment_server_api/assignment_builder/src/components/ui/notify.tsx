import { notifications, NotificationData } from "@mantine/notifications";

import { Icon } from "./Icon";

type NotifyInput = string | (Omit<NotificationData, "color"> & { color?: string });

const toData = (input: NotifyInput, defaults: Partial<NotificationData>): NotificationData => {
  if (typeof input === "string") {
    return { ...defaults, message: input };
  }
  return { ...defaults, ...input };
};

const POLITE = { role: "status" } as const;

export const notify = {
  show: (input: NotifyInput): string =>
    notifications.show(toData(input, { color: "brand", ...POLITE })) as string,

  success: (input: NotifyInput): string =>
    notifications.show(
      toData(input, { color: "teal", icon: <Icon name="check" size={16} />, ...POLITE })
    ) as string,

  error: (input: NotifyInput): string =>
    notifications.show(
      toData(input, {
        color: "red",
        icon: <Icon name="exclamation-triangle" size={16} />,
        autoClose: false
      })
    ) as string,

  info: (input: NotifyInput): string =>
    notifications.show(
      toData(input, { color: "blue", icon: <Icon name="info-circle" size={16} />, ...POLITE })
    ) as string,

  update: (id: string, input: NotifyInput): void => {
    notifications.update({ id, ...toData(input, { color: "brand" }) });
  },

  hide: (id: string): void => {
    notifications.hide(id);
  },

  clean: (): void => {
    notifications.clean();
  }
};
