import { useEffect, useState } from "react";
import { Buffer } from 'buffer';
import "./App.css";
import {
  getUserAddresssDetails,
  connectUser,
  loadUTXOs,
  doSimpleTX,
  extractAccountNumber,
  testMempool,
  selectUtxos,
  getTransaction,
  createPSBTTransaction,
} from "./interactions";

import * as btc from "@scure/btc-signer"
import { hexToBytes } from "@noble/hashes/utils";

window.Buffer = Buffer;


function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [accountNo, setAccount] = useState(null);
  const [userAddressDetails, SetUserAddressDetails] = useState(null);
  const [utxos, setUtxos] = useState([]);
  const [utxosForSend, setUtxosForSend] = useState([]);
  const [testSendAmount, setTestSendAmount] = useState(2000);
  const [estimatedFee, setEstimatedFee] = useState(1000);
  const [satsToUse, setSatsToUse] = useState(0);
  const [sendAddress1, setSendAddress1] = useState(
    "18mxQdLxcLstD6ttbHykvEoAYdu4eADtEf" // replace with your own receiving address
  );
  const [sendAddress2, setSendAddress2] = useState(null);
  const [hiroTX, setHiroTX] = useState(null);
  const [hiroPBST, setHiroPBST] = useState(null);

  const [txInputs, setTxInputs] = useState([])
  const [txOutputs, setTxOutputs] = useState([])

  async function auth() {
    //setIsAuthed(true);
    connectUser().then((user) => {
      setIsAuthed(true);
      setUser(user);
      getUserAddresssDetails().then((addresses) => {
        SetUserAddressDetails(addresses);
        setAccount(extractAccountNumber(addresses[0].derivationPath));
        setSendAddress2(addresses[0].address);
      });
    });
  }

  useEffect(() => {}, []);

  const createTransaction = async () => {
    const loadedUTXOs = await loadUTXOs(user.cardinalAddress);
    setUtxos(loadedUTXOs);
    console.log({loadedUTXOs});
    console.log(loadedUTXOs.length);
    
    const sortedUtxos = loadedUTXOs.sort((a, b) => b.value - a.value)
    
    const vouts = []
    // vouts.push({ address: sendAddress2, value: 555 });
    
    // Do your counterparty stuff here.......
    
    vouts.push({ address: sendAddress1, value: testSendAmount }); // charge address...

    
    let feeTotal = 0
    for (let vout of vouts) {
      feeTotal += vout.value
    }
    console.log({feeTotal})
    
    const { inputs, fee, change } = selectUtxos(sortedUtxos, vouts, 20)
    setTxInputs(inputs);
    setTxOutputs(vouts);

    vouts.push({ address: sendAddress2, value: change }); // change collect
    
    console.log({ inputs, fee, change});

    const psbtInputs = [];

    for (let input of inputs) {
      const txDetails = await getTransaction(input.txid)
      console.log({txDetails});
      const inputDetails = txDetails.vout[input.vout];
      console.log({inputDetails})
      const isWitnessUtxo = inputDetails.scriptPubKey.type.startsWith('witness')

        let psbtInput = {
          txid: input.txid,
          index: input.vout,
        }
        if (isWitnessUtxo) {
          psbtInput.witnessUtxo = {
            script: Buffer.from(inputDetails.scriptPubKey.hex, 'hex'),
            amount: BigInt(input.value),
          }
        } else {
          psbtInput.nonWitnessUtxo = Buffer.from(txDetails.hex, 'hex')
        }
        psbtInputs.push(psbtInput);
      }
      
      const tx =  createPSBTTransaction(psbtInputs, vouts);
      console.log({tx})
     const result = await window.btc
      .request("signPsbt", {
        publicKey: user.pubKey.p2wpkh,
        hex: tx,
        account: accountNo,
        signAtIndex: inputs.map((e,i)=>i),
      })
      .catch((err) => {
        console.log({ err });
        if (err.error) {
          alert(`ERROR: ${err.error.message}`);
        }
      });
      if(result){
        console.log({ result });

        const newTxFromPSBT = btc.Transaction.fromPSBT(hexToBytes(result.result.hex));
        newTxFromPSBT.finalize();
        console.log({newTxFromPSBT});
        const testMempoolResponse = await testMempool(newTxFromPSBT.hex).catch(
            (err) => {
              console.log(err);
              alert(err.message + " " + err.response.data.error.message);
            }
          );
          if (testMempoolResponse) {
            console.log({ testMempoolResponse });
          }
      }
   

    };
  
    
    //     for (const utxo in utxos) {
    //       console.log(utxos[utxo]);

    //       // can utxo cover required sats?
    //       if (testSendAmount + estimatedFee <= utxos[utxo].value) {
    //         console.log(
    //           "has a single utxo @ index " + utxo + " that covers costs of tx."
    //         );
    //         setUtxosForSend([utxos[utxo]]);
    //         setSatsToUse(utxos[utxo].value);
    //         return [utxos[utxo]];
    //       } else {
    //         console.log("doesnt have a single utxo to cover costs of tx.");
    //         // Here we would then loop over to combine some utxos to meet criteria, but
    //         // as this is a simple test using low value sends its assumed a single utxo will cover it.
    //         return [];
    //       }
    //     }
    //   }
    // );
    // console.log({ loadedUTXOs });
    // if (!loadedUTXOs.length) {
    //   alert("no utxos to work with...");
    // }
    // console.log("doing trancations creation stuff...");
    // const txHiro = await doSimpleTX(
    //   loadedUTXOs,
    //   [{ address: sendAddress1, value: testSendAmount }],
    //   accountNo,
    //   userAddressDetails,
    //   estimatedFee
    // ).catch((err) => {
    //   console.log({ err });
    // });
    // console.log({ txHiro });
    // setHiroPBST(txHiro);

    // const result = await window.btc
    //   .request("signPsbt", {
    //     publicKey: user.pubKey.p2wpkh,
    //     hex: txHiro,
    //     account: accountNo,
    //     signAtIndex: loadedUTXOs.map((e,i)=>i),
    //   })
    //   .catch((err) => {
    //     console.log({ err });
    //     if (err.error) {
    //       alert(`ERROR: ${err.error.message}`);
    //     }
    //   });
    // console.log({ result });

    // const newTxFromPSBT = btc.Transaction.fromPSBT(hexToBytes(result.result.hex));
    // newTxFromPSBT.finalize()
    
    

    // const testMempoolResponse = await testMempool(newTxFromPSBT.hex).catch(
    //   (err) => {
    //     console.log(err);
    //     alert(err.message + " " + err.response.data.error.message);
    //   }
    // );
    // if (testMempoolResponse) {
    //   console.log({ testMempoolResponse });
    // }
    // we are testing, lets not try to actually broadcast before we are getting valid mempool test responses.
  //};

  return (
    <div className="App">
      <h1>Hiro TEST</h1>
      {!isAuthed ? (
        <button onClick={auth}>Auth</button>
      ) : (
        <div>
          <p>Is authed...</p>
          {user && <pre>{JSON.stringify(user, null, 2)}</pre>}

          {userAddressDetails && (
            <>
              <pre>{JSON.stringify(userAddressDetails, null, 2)}</pre>
              <pre>Account: {JSON.stringify(accountNo, null, 2)}</pre>
              <label htmlFor="sendAddress">Send Address 1</label>
              <br />
              <input
                id="sendAddress"
                type="text"
                value={sendAddress1}
                onChange={(e) => {
                  setSendAddress1(e.target.value);
                }}
              />
              <br />
              <label htmlFor="sendAddress2">
                Change Address (your receiving address)
              </label>
              <br />
              <input
                readOnly
                id="sendAddress2"
                type="text"
                value={sendAddress2}
              />
              <br />
              <button onClick={createTransaction}>Make a Simple PBST</button>
              {txInputs && txInputs.length > 0 && (
                <pre>
                  Inputs:
                  <br /> {JSON.stringify(txInputs, null, 2)}
                </pre>
              )}
              {txOutputs && txOutputs.length > 0 && (
                <pre>
                  Outputs:
                  <br /> {JSON.stringify(txOutputs, null, 2)}
                </pre>
              )}
              
              {utxos && utxos.length > 0 && (
                <pre>
                  UTXOS:
                  <br /> {JSON.stringify(utxos, null, 2)}
                </pre>
              )}
              {utxosForSend && utxosForSend.length > 0 && (
                <pre>
                  UTXOS For Send:
                  <br /> {JSON.stringify(utxosForSend, null, 2)}
                </pre>
              )}
              {hiroTX && (
                <pre>
                  Hiro TX: (contains BigInt that can't be stringify'd so check
                  logs.)
                  <br />
                </pre>
              )}
              {hiroPBST && (
                <pre>
                  Hiro PBST:
                  <br />
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
