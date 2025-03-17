import { ShareledgerSettings } from "../../providers/shareledger/domain/ShareledgerSettings";

export default <ShareledgerSettings>{
  rpcEndpoint: process.env.SHARELEDGER_RPC_ENDPOINT,
  vctContractAddress: process.env.SHARELEDGER_VCT_CONTRACT_ADDRESS
};
