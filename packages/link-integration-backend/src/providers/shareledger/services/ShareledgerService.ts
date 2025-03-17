import { ShareledgerClient } from "@shareledgerjs/client";
import { Constant, Inject, InjectorService, Service } from "@tsed/di";
import { Logger } from "@tsed/logger";
import { BinaryLike, BinaryToTextEncoding, createHash } from "crypto";
import MerkleTree from "merkletreejs";
import { SessionRepository } from "../../../repositories";
import { ShareledgerSettings } from "../domain/ShareledgerSettings";
import { StartVerification } from "../domain/StartVerification";
import { VerificationResult } from "../domain/VerificationResult";

@Service()
export class ShareledgerService implements StartVerification {
  @Inject(Logger)
  private readonly logger: Logger;

  @Inject(InjectorService)
  private readonly injector: InjectorService;

  @Inject(SessionRepository)
  private readonly sessionRepository: SessionRepository;

  @Inject(ShareledgerClient)
  private readonly shareledgerClient: ShareledgerClient;

  @Constant("shareledger")
  private readonly shareledgerSettings: ShareledgerSettings;

  async getAttributeData(tokenId: string, attrNameHash: string) {
    try {
      const { verification_level, ref_documents, cur_ref_document } = await this.shareledgerClient.wasm.smartContractState<{
        cur_ref_document: string;
        ref_documents: { dvct_address: string; dvct_token_id: string }[];
        verification_level: string;
      }>(this.shareledgerSettings.vctContractAddress, { attribute_data: { token_id: tokenId, attribute: attrNameHash } });
      return {
        verification_level,
        dvct: ref_documents.find((doc) => doc.dvct_token_id === cur_ref_document)
      };
    } catch (err) {
      this.logger.error(err);
      return undefined;
    }
  }

  async getMekleRoot(tokenId: string) {
    try {
      const { merkle_root } = await this.shareledgerClient.wasm.smartContractState<{ merkle_root: string | null }>(
        this.shareledgerSettings.vctContractAddress,
        { merkle_root: { token_id: tokenId } }
      );
      return merkle_root;
    } catch (err) {
      this.logger.error(err);
      return undefined;
    }
  }

  async ownerOf(tokenId: string) {
    try {
      const { owner } = await this.shareledgerClient.wasm.smartContractState<{ owner: string }>(
        this.shareledgerSettings.vctContractAddress,
        { owner_of: { token_id: tokenId } }
      );
      return owner;
    } catch (err) {
      this.logger.error(err);
      return undefined;
    }
  }

  async verifyMerkleProof(tokenId: string, merkleRoot: string, valueHash: string, proofs: string[]) {
    // Implement the merkle proof verification logic here
    // Return true if the proof is valid, false otherwise
    const merkleTree = new MerkleTree([], sha256, { sort: true }); // sort: true is required to match with the implementation on contracts
    const merkleRootMatchedLocal = merkleTree.verify(proofs, valueHash, merkleRoot);
    const merkleRootMatched = await this.verifyAttribute(tokenId, valueHash, proofs);
    return {
      merkleRootMatchedLocal,
      merkleRootMatched
    };
  }

  getAttribute(key: string, value: any) {
    // work out attribute name
    let attrName = key;
    const attrNameArr = key.split(".");
    if (attrNameArr.length === 1) {
      // <attr>
      attrName = key;
    } else if (attrNameArr.length < 3) {
      // <attr>.<level>
      attrName = attrNameArr[0];
    } else {
      // <doc>.<attr>.<level>.<something>...
      attrName = attrNameArr[1];
    }

    // work out attribute value
    let parsedValue: any = value;
    try {
      parsedValue = JSON.parse(value);
    } catch (err) {
      this.logger.debug(err);
      this.logger.debug(value);
    }

    if (Array.isArray(parsedValue)) {
      // verifiable proof
      const [attrValue, valueHashLocal, proofs] = parsedValue;
      let attrNameHash;
      let attrValueHash;

      if (Array.isArray(attrValue)) {
        const [countryCode, docType, value] = attrValue;
        attrNameHash = sha256(`${countryCode.toLowerCase()}.${docType.toLowerCase()}.${attrName}`, "hex");
        attrValueHash = sha256(`${countryCode.toLowerCase()}.${docType.toLowerCase()}.${attrName}.${value}`, "hex");
      } else {
        attrNameHash = sha256(`${attrName}`, "hex");
        attrValueHash = sha256(`${attrName}.${attrValue}`, "hex");
      }

      return {
        name: attrName,
        nameHash: attrNameHash,
        value: attrValue,
        valueHash: attrValueHash,
        valueHashLocal,
        proofs
      };
    }

    return {
      name: attrName,
      nameHash: sha256(`${attrName}`, "hex"),
      value: parsedValue,
      valueHash: sha256(`${attrName}.${parsedValue}`, "hex")
    };
  }

  async verifyAttribute(tokenId: string, attrValueHash: string, proofs: string[]) {
    try {
      const { valid } = await this.shareledgerClient.wasm.smartContractState<{ valid: boolean }>(
        this.shareledgerSettings.vctContractAddress,
        { verify_attribute: { token_id: tokenId, attribute_value_hash: attrValueHash, merkle_proof: proofs } }
      );
      return valid;
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  async $startVerification(sessionId: string, attributes: any) {
    const session = await this.sessionRepository.find({ uuid: sessionId });
    if (!session) {
      return;
    }
    // verification
    // this can also be done on the frontend side

    try {
      const verificationResult: VerificationResult = {
        ownerMatched: false,
        ownerAddress: "",
        attributes: {}
      };

      // extract attributes, take vct token id (did) and addresses
      const { vct, ShareLedger_Address: shareledgerAddress, ...rest } = attributes;

      /// verify owner
      const owner = await this.ownerOf(vct);
      verificationResult.ownerAddress = owner ? owner : shareledgerAddress;
      verificationResult.ownerMatched = owner ? owner.toLowerCase() === shareledgerAddress.toLowerCase() : false;

      // verify attributes
      const merkleRoot = await this.getMekleRoot(vct);
      if (!merkleRoot) {
        throw new Error("Merkle root cannot be retrieved from blockchain");
      }

      for (const k of Object.keys(rest)) {
        const { name, nameHash, value, valueHash, valueHashLocal, proofs } = this.getAttribute(k, rest[k]);
        if (valueHashLocal && proofs) {
          // verifiable proofs
          const valueHashMatched = valueHash.toLowerCase() === valueHashLocal.toLowerCase();

          this.logger.info(name, nameHash, value, valueHash);
          const [attributeData, { merkleRootMatched, merkleRootMatchedLocal }] = await Promise.all([
            // get verification level
            this.getAttributeData(vct, nameHash),
            // verify proofs on chain
            this.verifyMerkleProof(vct, merkleRoot, valueHash, proofs)
          ]);
          verificationResult.attributes[k] = {
            attributeHashMatched: valueHashMatched,
            verificationLevel: attributeData?.verification_level || "undefined",
            merkleOnchainMatched: merkleRootMatched,
            merkleOffchainMatched: merkleRootMatchedLocal
          };
        } else {
          const attributeData = await this.getAttributeData(vct, nameHash);
          verificationResult.attributes[k] = {
            attributeHashMatched: false,
            verificationLevel: attributeData?.verification_level || "undefined",
            merkleOnchainMatched: false,
            merkleOffchainMatched: false
          };
        }
      }

      session.verificationResult = verificationResult;

      this.logger.info("Verification finished");
    } catch (err) {
      this.logger.error(err);
    } finally {
      session.status = "completed";
      await this.sessionRepository.save(session);
    }
  }
}

function sha256(value: BinaryLike): Buffer;
function sha256(value: BinaryLike, encoding: BinaryToTextEncoding): string;
function sha256(value: BinaryLike, encoding?: BinaryToTextEncoding) {
  const hash = createHash("sha256").update(value);
  return encoding ? hash.digest(encoding) : hash.digest();
}
