import styles from './Home.module.css';
import Image from "next/image"

const Home: React.FC = ({}) => {
    const chatbot: string = "A3B_FAQ"
    return (
        <div className={styles.container}>
            <div className={styles.containerTable}>
                <div className={styles.displayArea}>
                    <div className={styles.RecordingArea}>
                        <h3>ドキュメントの管理について</h3>
                        <div className={styles.explainArea}>
                            <p>このアプリは{chatbot}におけるドキュメントを登録するためのアプリです。</p>
                            <p>
                                ドキュメントを登録する方法は、
                                <span className={styles.standOutText1}>
                                    【<Image src="./add_file_document_icon.png" width={20} height={20} alt="add_file_document_icon"></Image>ドキュメント登録】
                                </span>
                                で行います。
                            </p>
                            <p>登録できるファイルの種類は以下の8種類です。</p>
                            <hr className={styles.border}></hr>
                            <ol className={styles.fileTypeBox}>
                                <li>PDF</li>
                                <li>Excel</li>
                                <li>Word</li>
                                <li>PowerPoint</li>
                                <li>Text</li>
                                <li>jpg</li>
                                <li>jpeg</li>
                                <li>png</li>
                            </ol>
                            <hr className={styles.border}></hr>
                        </div>
                        <p className={styles.subTitle}>PDFファイルに関して</p>
                        <div className={styles.explainArea}>
                            <p>PDFファイルを登録する際、各ページごとに分解を行います。</p>
                            <p>分解した際、元のファイル名と拡張子の間に-0、-1のように連番を取り付けて登録されます。</p>
                            <p className={styles.example}>例)</p>
                            <div className={styles.exampleBox}>
                                <p className={styles.exampleBefore}>003_ネットワーク基礎.pdf</p>
                                <p className={styles.exampleArrow}>↓</p>
                                <p className={styles.exampleAfter}>003_ネットワーク基礎.pdf-0.pdf、003_ネットワーク基礎.pdf-1.pdf、...</p>
                            </div>
                        </div>

                        <p className={styles.subTitle}>Excelファイルに関して</p>
                        <div className={styles.explainArea}>
                            <p>Excelファイルを登録する際、シートごとに分解を行います。</p>
                            <p>シート別に分解したファイルはファイル名の後ろに-sheet1、-sheet2のように取り付けて、区別できるようにします。</p>
                            <p>更に各シートの印刷範囲ページレイアウトごとに分解し、PDF変換を行い元のファイル名と拡張子の間に-0、-1のように連番を取り付けて登録されます。</p>
                            <p className={styles.example}>例)</p>
                            <div className={styles.exampleBox}>
                                <p className={styles.exampleBefore}> 003_ネットワーク基礎.xlsx</p>
                                <p className={styles.exampleArrow}>↓</p>
                                <p className={styles.exampleAfter}>003_ネットワーク基礎.xlsx-目次-0.pdf、003_ネットワーク基礎.xlsx-目次-1.pdf、...</p>
                            </div>
                            <p className={styles.note}>※必ず<span className={styles.standOutText2}>印刷範囲設定を行ってから</span>登録してください。設定を行っていない場合、空白のセルも全てPDF化され非常に処理が重たくなります。</p>
                            <p>※設定せずに登録した場合は一度【削除】してから再度ご登録ください。</p>
                        </div>

                        <p className={styles.subTitle}>Wordファイルに関して</p>
                        <div className={styles.explainArea}>
                            <p>Wordファイルを登録する際、各ページごとに分解を行いPDFに変換します。</p>
                            <p>変換を行う際、元のファイル名と拡張子の間に-0、-1のように連番を取り付けて登録されます。</p>
                            <p className={styles.example}>例)</p>
                            <div className={styles.exampleBox}>
                                <p className={styles.exampleBefore}>003_ネットワーク基礎.docx</p>
                                <p className={styles.exampleArrow}>↓</p>
                                <p className={styles.exampleAfter}>003_ネットワーク基礎.docx-0.pdf、003_ネットワーク基礎.docx-1.pdf、...</p>
                            </div>
                        </div>

                        <p className={styles.subTitle}>PowrPointファイルに関して</p>
                        <div className={styles.explainArea}>
                            <p>PowerPointファイルを登録する際、各ページごとに分解を行いノート部分も含めPDFに変換します。</p>
                            <p>変換を行う際、元のファイル名と拡張子の間に-0、-1のように連番を取り付けて登録されます。</p>
                            <p className={styles.example}>例)</p>
                            <div className={styles.exampleBox}>
                                <p className={styles.exampleBefore}>003_ネットワーク基礎.pptx</p>
                                <p className={styles.exampleArrow}>↓</p>
                                <p className={styles.exampleAfter}>003_ネットワーク基礎.pptx-0.pdf、003_ネットワーク基礎.pptx-1.pdf、...</p>
                            </div>
                        </div>

                        <p className={styles.subTitle}>Text/jpg/jpeg/pndファイルに関して</p>
                        <div className={styles.explainArea}>
                            <p>これら各ファイルを登録する際、元のファイル名と拡張子の間に-0が取り付いて登録されます。</p>
                            <p className={styles.example}>例)</p>
                            <div className={styles.exampleBox}>
                                <p className={styles.exampleBefore}>003_ネットワーク基礎.txt</p>
                                <p className={styles.exampleArrow}>↓</p>
                                <p className={styles.exampleAfter}>003_ネットワーク基礎-0.txt</p>
                            </div>
                        </div>
                        <p className={styles.subSummary}>これらの分解されたPDF及びText/jpg/jpeg/pndファイルが{chatbot}のソースドキュメントとして表示されます。</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home