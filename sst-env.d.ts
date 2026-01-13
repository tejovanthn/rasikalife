/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "RasikaBucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "RasikaTRPC": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "RasikaTable": {
      "name": string
      "type": "sst.aws.Dynamo"
    }
    "RasikaWeb": {
      "type": "sst.aws.Remix"
      "url": string
    }
  }
}
export {}
