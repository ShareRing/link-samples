export interface AttributeVerificationResult {
  verificationLevel: string;
  attributeHashMatched: boolean;
  merkleOnchainMatched: boolean;
  merkleOffchainMatched: boolean;
}

export interface VerificationResult {
  ownerAddress: string;
  ownerMatched: boolean;
  attributes: {
    [prop: string]: AttributeVerificationResult;
  };
}
