import React from 'react';
import { useState } from 'react';
import styles from "./DocRegistrationModal.module.css";
import Modal from "./Modal";
import Panel from "./Panel";
import Image from "next/image";

interface Props {  
    bot: string;  
    addProgressPair: (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles?: { file: File; isUploaded: boolean }[], failedFilesString?: string[]) => void;  
}

const DocRegistrationModal:React.FC<Props> = ({ bot, addProgressPair }) => {
    const [isOpenModal, setIsOpenModal] = useState(false);
    const toggleModalkari = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.target === e.currentTarget) {
            setIsOpenModal(!isOpenModal);
        }
    };

    return (
        <div className="App">
            <div className={styles.btn_radius_gradient_wrap}>
                <span className={`${styles.btn} ${styles.btn_radius_gradient}`} onClick={toggleModalkari}>
                    <Image className={styles.plus_icon} src="/plus_icon.png" width={15} height={15} alt="plus_icon" />
                    ドキュメント登録
                </span>
            </div>
            {isOpenModal && (
                <Modal close={toggleModalkari}>
                    <Panel  
                        bot={bot}  
                        addProgressPair={addProgressPair}
                    />  
                </Modal>
            )}
        </div>
    );
}

export default DocRegistrationModal;