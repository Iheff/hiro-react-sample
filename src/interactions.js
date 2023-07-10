import { AppConfig, UserSession, showConnect } from "@stacks/connect";
import { StacksMainnet } from "@stacks/network";
import axios from "axios";
import * as btc from "@scure/btc-signer";
import { bytesToHex } from '@noble/hashes/utils';
import {sum} from 'lodash'
import * as bitcoin from 'bitcoinjs-lib'
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
    .get(`https://blockstream.info/api/address/${address}/utxo`)
    //.get("https://blockchain.info/unspent?active=" + address)
    //.get("https://mempool.space/api/address/" + address + "/utxo")
      .catch((err) => console.log({ err }));
    console.log({utxoRes})
    //if (utxoRes && utxoRes.data && utxoRes.data.length) {
    if (utxoRes && utxoRes.data  ) {
    
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
      txHiro.addInput({txid:inputs[i].tx_hash_big_endian, index:inputs[i].tx_output_n, finalScriptSig:inputs[i].script});
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
    

    resolve(psbtHex);
  });
};

export function publicKeyToAddress(publicKey) {
  const publicKeyBuffer = new Buffer(publicKey, 'hex')
  const publicKeyHash160 = bitcoin.crypto.hash160(publicKeyBuffer)
  const address = bitcoin.address.toBase58Check(publicKeyHash160, 0x00)
  return address
}

export const createPSBTTransaction = (inputs, outputs)=>{
  const txHiro = new btc.Transaction();
  //const psbt = new bitcoin.Psbt()
  for (let input of inputs) {
    console.log({input})
    //psbt.addInput(input);
    txHiro.addInput(input)
  }
  for (let output of outputs) {
    //console.log({output})
    //psbt.addOutput(output);
    //console.log({OutputAddress:output.address})
    
    // const script = btc.p2pkh("0201f41179941a9332568aa5c39f9fe0e11e0fe2c398552f38858d8ba8306b498a").script;
    // txHiro.addOutput(output.address,BigInt(output.value) )
    // console.log( bitcoin.address.toOutputScript(output.address))
    //txHiro.addOutputAddress(output.address, BigInt(output.value))

    txHiro.addOutput({script:bitcoin.address.toOutputScript(output.address), amount: BigInt(output.value)})
    
    //const script = btc.p2pkh(output.address).script;
    // txHiro.addOutput({script, amount: BigInt(output.value)})
  
  }


  const psbt = txHiro.toPSBT();
  //console.log({output0:txHiro.getOutput(0)})
  console.log({output0:btc.Script.decode(txHiro.getOutput(0).script)})
  let pubKeyIn = '';
let chunksIn = bitcoin.script.decompile(btc.Script.decode(txHiro.getOutput(0).script));
     let hash = bitcoin.crypto.hash160(chunksIn[chunksIn.length - 1])
     console.log({hash})
     pubKeyIn = bitcoin.address.toBase58Check(hash, bitcoin.networks.bitcoin.scriptHash)
    console.log("pubKeyIn", pubKeyIn);

  console.log({output1:txHiro.getOutput(0)})
  console.log({output2:txHiro.getOutput(1)})
  console.log({psbt});

  const psbtHex =bytesToHex(psbt) 
  return psbtHex;
}



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


//TODO: fix this
const getOutputVbytes = (vout) => {
  return 31
}

//TODO: fix this
const getInputVbytes = (utxo) => {
  return 68
}



export const selectUtxos = (utxos, vouts, feeRate, message = null) => {
  const sortedUtxos = utxos.sort((a, b) => b.value - a.value)
  const outValueSum = sum(vouts.map((e) => e.value))

  let vbTotal = 0
  const vbOverHead = 10.5

  vbTotal += vbOverHead

  for (let vout of vouts) {
    vbTotal += getOutputVbytes(vout)
  }
  vbTotal += getOutputVbytes({ address: 'change address', value: 'change value' })
  if (message) {
    vbTotal += 2 + message.length
  }

  let utxoValueSum = 0
  let inputs = []

  for (let i in sortedUtxos) {
    const utxo = sortedUtxos[i]
    const vbUtxo = getInputVbytes(utxo)

    inputs.push(utxo)
    vbTotal += vbUtxo
    utxoValueSum += utxo.value
    const feeSum = feeRate * vbTotal

    if (utxoValueSum >= outValueSum + feeSum) {
      return {
        fee: feeSum,
        inputs: inputs,
        change: parseInt(utxoValueSum - (outValueSum + feeSum)),
      }
    }
  }
  return { fee: feeRate * vbTotal }
}



// export  const getTransaction = async (txId) => {
//   return new Promise(async(resolve, reject)=>{

//     const testResponse = await axios.get('https://blockstream.info/api/tx/'+txId)
//     .catch((err)=>{
//       console.log(err)
//       reject(err)
//     });
//     if (testResponse){
//       resolve(testResponse.data)
//     }
//   })
// }




export const getTransaction = (address)=>{
  return new Promise(async(resolve, reject)=>{

    const testResponse = await axios.post('https://docs-demo.btc.quiknode.pro/', {"method": "getrawtransaction","params": [address,true]})
    .catch((err)=>{
      console.log(err)
      reject(err)
    });
    if (testResponse && testResponse.data && testResponse.data.result){
      resolve(testResponse.data.result)
    }
  })
}

// export const selectUtxos = ()=>{

// }