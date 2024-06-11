/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "rasika",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("RasikaBucket", {
      public: true
    });

    new sst.aws.Remix("RasikaWeb", {
      link: [bucket],
      path: "packages/web/",
      domain: {
        name: $app.stage === "prod" ? "rasika.life" : `${$app.stage}.rasika.life`,
        redirects: $app.stage === "prod" ? ["www.rasika.life"] : [`www.${$app.stage}.rasika.life`],
        dns: sst.aws.dns({
          zone: "Z0190677U1NK4BAEXE0M"
        })
      }
    });
  },
});
