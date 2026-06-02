import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setPublicDir("remotion/public");
Config.overrideWebpackConfig((c) => c);
