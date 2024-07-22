/* tslint:disable */
 
import "sst"
declare module "sst" {
  export interface Resource {
    RasikaBucket: {
      name: string
      type: "sst.aws.Bucket"
    }
    RasikaTable: {
      name: string
      type: "sst.aws.Dynamo"
    }
    RasikaWeb: {
      type: "sst.aws.Remix"
      url: string
    }
  }
}
export {}