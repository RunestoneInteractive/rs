export const getHexValueUtil = (value: number) => {
  const v = value.toString(16);

  return v.length === 1 ? "0" + v : v;
};

export const rgbaHexUtil = (hex: string, opacity: number): string =>
  hex + getHexValueUtil(Math.floor(opacity * 255));
