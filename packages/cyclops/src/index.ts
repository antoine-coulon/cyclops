import { Cyclops, CyclopsConfig, CyclopsInstance } from "./cyclops/main.js";

export default async function cyclops(
  config: CyclopsConfig
): Promise<CyclopsInstance> {
  const cyclopsInstance = await new Cyclops(config).initialize();

  return cyclopsInstance;
}
