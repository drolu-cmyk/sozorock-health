import type {ConfigContext, ExpoConfig} from "expo/config";

const mobileConfig = ({config}: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PROJECT_ID?.trim();
  const owner = process.env.EXPO_OWNER?.trim();

  return {
    ...config,
    ...(owner ? {owner} : {}),
    extra: {
      ...(config.extra ?? {}),
      ...(projectId ? {eas: {projectId}} : {}),
    },
  } as ExpoConfig;
};

export default mobileConfig;
