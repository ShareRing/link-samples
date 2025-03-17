export interface ShareledgerSettings {
  rpcEndpoint: string;
  vctContractAddress: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace TsED {
    interface Configuration {
      shareledger?: ShareledgerSettings;
    }
  }
}
