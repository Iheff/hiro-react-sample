import { AppConfig, UserSession, showConnect } from "@stacks/connect";
import { StacksMainnet } from "@stacks/network";
import axios from "axios";
import * as btc from "@scure/btc-signer";
import { bytesToHex } from '@noble/hashes/utils';

export function extractAccountNumber(path) {
  const segments = path.split("/");
  const accountNum = parseInt(segments[3].replaceAll("'", ""), 10);
  if (isNaN(accountNum))
    throw new Error("Cannot parse account number from path");
  return accountNum;
}

const appConfig = new AppConfig();
const userSession = new UserSession({ appConfig });

export const getUserAddresssDetails = async () => {
  return new Promise(async (resolve, reject) => {
    const userAddresses = await window.btc
      ?.request("getAddresses")
      .catch(() => {
        return window.btc?.request("getAddresses");
      });
    console.log({ userAddresses });
    if (
      userAddresses &&
      userAddresses.result &&
      userAddresses.result.addresses
    ) {
      const theACC = extractAccountNumber(
        userAddresses.result.addresses[0].derivationPath
      );
      console.log({ theACC });
      return resolve(userAddresses.result.addresses);
    } else {
      return reject();
    }
  }); // promisewrapper
}; // getUserAddresssDetails

export const connectUser = async () => {
  return new Promise((resolve, reject) => {
    console.log("connectUser...... ");

    if (!userSession.isUserSignedIn()) {
      showConnect({
        userSession,
        network: StacksMainnet,
        appDetails: {
          name: "Assetic.io",
          icon: window.location.origin + "/Assetic-500.png",
        },
        onFinish: () => {
          console.log("finished auth in");
          resolve({
            cardinalAddress:
              userSession.loadUserData().profile.btcAddress.p2wpkh.mainnet,
            ordinalAddress:
              userSession.loadUserData().profile.btcAddress.p2tr.mainnet,
            pubKey: userSession.loadUserData().profile.btcPublicKey,
          });
        },
        onCancel: () => {
          reject();
        },
      });
    } else {
      const cardinalAddress =
        userSession.loadUserData().profile.btcAddress.p2wpkh.mainnet;
      const ordinalAddress =
        userSession.loadUserData().profile.btcAddress.p2tr.mainnet;
      const pubKey = userSession.loadUserData().profile.btcPublicKey;
      resolve({ cardinalAddress, ordinalAddress, pubKey });
    }
  }); // promise wrapper
}; // connect User

export const loadUTXOs = async (address) => {
  return new Promise(async (resolve, reject) => {
    const utxoRes = await axios
      .get("https://mempool.space/api/address/" + address + "/utxo")
      .catch((err) => console.log({ err }));

    if (utxoRes && utxoRes.data && utxoRes.data.length) {
      return resolve(utxoRes.data);
    } else {
      return reject();
    }
  });
};

export const doSimpleTX = (
  inputs,
  receivers,
  accountNo,
  addresses,
  estimatedFee
) => {
  return new Promise(async (resolve, reject) => {
    console.log("creating simple PBST");
    const txHiro = new btc.Transaction();
    console.log({inputs});
    
    for (let i = 0; i < inputs.length; i++) {
        console.log(inputs[i])
        console.log("||||||||||||")
      txHiro.addInput({...inputs[i], index:i});
    }
    console.log({receivers});
    txHiro.addOutputAddress(receivers[0].address, BigInt(receivers[0].value))

    console.log('all inputs add to: '+ inputs.reduce((acc, curr)=>{
        console.log({acc, curr});
        return acc+curr.value;
    },0))
    txHiro.addOutputAddress(addresses[0].address, BigInt((( inputs.reduce((acc, curr)=>acc+curr.value,0) )-estimatedFee)-receivers[0].value))
    
    
    console.log({ txHiro });

    const psbt = txHiro.toPSBT();
    console.log({psbt});

   const psbtHex =bytesToHex(psbt) 
   console.log({psbtHex});

    // const result = await window.btc.request('signPsbt', {publicKey:user.pubKey.p2wpkh, hex: bytesToHex(psbt)}).catch(err=>{
    //   console.log({err});
    //   if(err.error){
    //    alert(`ERROR: ${err.error.message}`);
    //   }
    // });
    // console.log({result});


    resolve(psbtHex);
  });
};
export const testMempool = (signedTxHex)=>{
  return new Promise(async(resolve, reject)=>{

    const testResponse = await axios.post('https://docs-demo.btc.quiknode.pro/', {"method": "testmempoolaccept","params": [[signedTxHex]]})
    .catch((err)=>{
      console.log(err)
      reject(err)
    });
    if (testResponse){
      resolve(testResponse)
    }
  })
}