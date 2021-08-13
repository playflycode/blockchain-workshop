/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useCallback, useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';

import { SimpleStorageWrapper } from '../lib/contracts/SimpleStorageWrapper';
import { CONFIG } from '../config';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [storages, setStorages] = useState<string[]>([]);
    const [contract, setContract] = useState<SimpleStorageWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [selectedStorage, setSelectedStorage] = useState<string>(); // contract id
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const [readValueInProgress, setReadValueInProgress] = useState(false);
    const toastId = React.useRef(null);
    const [newStoredStringInputValue, setNewStoredStringInputValue] = useState<
        string | undefined
    >();

    useEffect(() => {
        if (storages.length > 0) localStorage.setItem('storages', JSON.stringify(storages));
    }, [storages]);

    useEffect(() => {
        setStorages(JSON.parse(localStorage.getItem('storages')) || []);
    }, []);

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog.' +
                    'The contract is deployed on Nervos Layer 2 - Godwoken + Polyjuice. ' +
                    'After each transaction you might need to wait up to 120 seconds for the status to be reflected.',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    async function deployContract() {
        const _contract = new SimpleStorageWrapper(web3);

        try {
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);
            const { address } = _contract;
            console.log({ address, transactionHash });
            addStorage(address);
            openStorage(address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    function addStorage(contractAddress: string) {
        if (storages.indexOf(contractAddress) < 0) setStorages(st => [...st, contractAddress]);
    }

    async function openStorage(contractAddress: string) {
        const _contract = new SimpleStorageWrapper(web3);
        _contract.useDeployed(contractAddress.trim());
        setContract(_contract);
    }

    useEffect(() => {
        if (!contract) return;
        (async () => getStoredValue())();
    }, [contract]);

    const getStoredValue = useCallback(async () => {
        try {
            setReadValueInProgress(true);
            const value = await contract.getStoredValue(account);
            toast('Successfully read latest stored value.', { type: 'success' });
            setNewStoredStringInputValue(value);
        } catch (error) {
            console.error(error);
            toast.error('There was an error reading your storage. Please check developer console.');
        } finally {
            setReadValueInProgress(false);
        }
    }, [contract]);

    async function setNewStoredValue() {
        try {
            setTransactionInProgress(true);
            await contract.setStoredValue(newStoredStringInputValue, account);
            toast('Successfully saved latest stored value.', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div className="root">
            <h1>String Storages</h1>
            <div className="container mx-auto">
                <div>
                    Your ETH address: <b>{accounts?.[0]}</b>
                    <br />
                    <br />
                    Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
                    <br />
                    <br />
                    Nervos Layer 2 balance:{' '}
                    <b>
                        {l2Balance ? (l2Balance / 10n ** 8n).toString() : <LoadingIndicator />} CKB
                    </b>
                </div>
            </div>
            <hr />
            <div className="d-flex mx-auto" style={{ width: 800 }}>
                <div className="container">
                    <h2>Storages list</h2>
                    <button onClick={deployContract} disabled={!l2Balance}>
                        Add new storage
                    </button>
                    <br />
                    <br />
                    <input
                        placeholder="Existing contract id"
                        onChange={e => setSelectedStorage(e.target.value)}
                    />
                    <button
                        disabled={!selectedStorage || !l2Balance}
                        onClick={() => addStorage(selectedStorage)}
                    >
                        add storage
                    </button>
                    <br />
                    <br />
                    <div className="storages-list">
                        {storages.map((storage, i) => (
                            <div key={storage} onClick={e => openStorage(storage)}>
                                {i + 1}. <b>{storage}</b>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="container">
                    <h2>
                        Storage
                        <br />
                        <span className="address">{contract?.address || ''}</span>
                    </h2>
                    <textarea
                        onChange={e => setNewStoredStringInputValue(e.target.value)}
                        value={newStoredStringInputValue}
                        disabled={readValueInProgress}
                    />
                    <br />
                    <button onClick={setNewStoredValue} disabled={!contract}>
                        Save
                    </button>
                </div>
            </div>
            <ToastContainer />
        </div>
    );
}
