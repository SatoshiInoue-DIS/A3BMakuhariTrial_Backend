import styles from './DocRegistration.module.css';
import DocRegistrationModal from '@/components/DocRegistrationModal';

import { uploadApi } from "../../api";

const DocRegistration = () => {
    return (
        <div className={styles.container}>
            <div className={styles.containerTable}>
                <div className={styles.commandsContainer}>
                    <div className={styles.titleAndSelectArea}>
                        <h3>ドキュメント登録</h3>
                        <p>Bot選択 幕張トライアル</p>
                    </div>
                    <div className={styles.DocRegistrationButtonArea}>
                        <DocRegistrationModal />
                    </div>
                    <div className={styles.registrationDeletionArea}>
                        <div>
                            <p>一括削除</p>
                        </div>
                    </div>
                </div>
                <div>
                    <div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default DocRegistration