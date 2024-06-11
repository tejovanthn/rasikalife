/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    RasikaBucket: {
      name: string
      type: "sst.aws.Bucket"
    }
    RasikaWeb: {
      type: "sst.aws.Remix"
      url: string
    }
  }
}
export {}