import path from "node:path";
import type {NextConfig} from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
};

export default config;
