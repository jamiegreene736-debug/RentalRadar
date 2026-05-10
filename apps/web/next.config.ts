import type { NextConfig } from "next";
import path from "node:path";

type WebpackAssetSource = {
  new (source: string): unknown;
};

type WebpackRuntime = {
  Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: number };
  sources: { RawSource: WebpackAssetSource };
};

type WebpackCompilation = {
  getAsset(name: string): unknown;
  emitAsset(name: string, source: unknown): void;
  hooks: {
    processAssets: {
      tap(options: { name: string; stage: number }, callback: () => void): void;
    };
  };
};

type WebpackCompiler = {
  hooks: {
    thisCompilation: {
      tap(name: string, callback: (compilation: WebpackCompilation) => void): void;
    };
  };
};

type WebpackPlugin = {
  apply(compiler: WebpackCompiler): void;
};

type WebpackConfig = {
  plugins?: WebpackPlugin[];
};

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  webpack(config: WebpackConfig, { dev, isServer, webpack }: { dev: boolean; isServer: boolean; webpack: WebpackRuntime }) {
    if (isServer && !dev) {
      config.plugins = config.plugins ?? [];
      const ensurePagesManifestPlugin: WebpackPlugin = {
        apply(compiler) {
          compiler.hooks.thisCompilation.tap("EnsurePagesManifestPlugin", (compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: "EnsurePagesManifestPlugin",
                stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
              },
              () => {
                if (!compilation.getAsset("pages-manifest.json")) {
                  compilation.emitAsset(
                    "pages-manifest.json",
                    new webpack.sources.RawSource(
                      JSON.stringify({
                        "/_app": "pages/_app.js",
                        "/_document": "pages/_document.js",
                        "/_error": "pages/_error.js",
                      }),
                    ),
                  );
                }
              },
            );
          });
        },
      };
      config.plugins.push(ensurePagesManifestPlugin);
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
