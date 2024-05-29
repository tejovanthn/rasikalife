/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "rasika",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("RasikaBucket", {
      public: true
    });

    new sst.aws.Remix("RasikaWeb", {
      link: [bucket],
      path: "packages/web/"
    });
  },
});
