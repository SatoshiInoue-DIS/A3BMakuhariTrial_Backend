import React from 'react'
import { useState } from 'react'
import styles from './DocRegistrationModal.module.css'
import Modal from "./Modal";
import Panel from "./Panel";

interface props {
    bot:string;
}
const DocRegistrationModal:React.FC<props> = ({bot}) => {
    const [isOpenModal, setIsOpenModal] = useState(false);

    const toggleModalkari = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.target === e.currentTarget) {
            setIsOpenModal(!isOpenModal);
        }
    };

    return (
        <div className="App">
            <button type="button" onClick={toggleModalkari}>
                ドキュメント登録
            </button>
            {isOpenModal && (
                <Modal close={toggleModalkari}>
                    <Panel bot={bot}/>
                </Modal>
            )}
        </div>
    );
}

export default DocRegistrationModal;